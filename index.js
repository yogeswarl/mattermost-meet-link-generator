const express = require('express');
const dotenv = require('dotenv');
const fsPromise = require('fs').promises;
const fs = require('fs');
const path = require('path');
const process = require('process');
const { google } = require('googleapis');
const { SpacesServiceClient } = require('@google-apps/meet').v2;
const { auth } = require('google-auth-library');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const serverless = require('serverless-http')
const app = express();
const AWS = require('aws-sdk');
AWS.config.update({ region: 'ca-central-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const PORT = process.env.PORT || 3000;

dotenv.config();

// general
const BOT_NAME = 'google-meet-generator';
const tokenTypeToTokenMap = {
  CALL: process.env.MM_CALL_HANDLER_TOKEN,
  REGISTER: process.env.MM_REGISTER_TOKEN,
  DB_NAME: process.env.TABLE_NAME
}

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/meetings.space.created'];

app.use(express.urlencoded({ extended: true }));
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
let keys = { redirect_uris: [''] };
if (fs.existsSync(CREDENTIALS_PATH)) {
  keys = require(CREDENTIALS_PATH).web;
}

const oauth2Client = new google.auth.OAuth2(
  keys.client_id,
  keys.client_secret,
  keys.redirect_uris[0]
);
/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist(userId) {
  try {
    const params = {
      TableName: tokenTypeToTokenMap.DB_NAME,
      Key: { user_id: userId }
    };
    const result = await dynamodb.get(params).promise();
    if (result.Item && result.Item.credentials) {
      return auth.fromJSON(result.Item.credentials);
    }
    return null;
  } catch (err) {
    console.log(err);
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client, userId) {
  const content = await fsPromise.readFile(CREDENTIALS_PATH);
  if(client.credentials.refresh_token === undefined){
    oauth2Client.on('tokens', (tokens) => {
      if(tokens.refresh_token) {
        client.credentials.refresh_token = tokens.refresh_token;
      }
    });
  }
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  let tokens = {};
  try {
    const params = {
      TableName: tokenTypeToTokenMap.DB_NAME,
      Key :{user_id: userId}
    }
    const result = await dynamodb.get(params).promise();
    tokens = result.Item || {};
  } catch (err) {
    console.log('No Existing tokens file, creating a new one.');
  }
  tokens[userId] = payload;

  const putParams = {
    TableName: tokenTypeToTokenMap.DB_NAME,
    Item: {
      user_id: userId,
      credentials: payload
    }
  }
  try {
    await dynamodb.put(putParams).promise();
    console.log(`Successfully stored token for user_id: ${userId}`);
  } catch (err) {
    console.error(`Failed to store token for user_id: ${userId}`, err);
  }
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize(userId, verifyOnly = false, response_url) {
  let client = await loadSavedCredentialsIfExist(userId);
  if (client) {
    return client;
  }
  if (verifyOnly) {
    return null;
  }

  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES.join(' '),
    state: JSON.stringify({"user_id": userId,"response_url": response_url})
  });
  return authorizeUrl;
}

/**
 * Creates a new meeting space.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function createSpace(authClient) {
  const meetClient = new SpacesServiceClient({
    authClient: authClient
  });
  // Construct request
  const request = {
  };

  // Run request
  const response = await meetClient.createSpace(request);
  return response[0].meetingUri;
}
async function verifyMMToken(token, type = tokenTypeToTokenMap.CALL) {
  return token === type;
}


app.get('/create-space', async (req, res) => {
  const { user_id, token, user_name } = req.query

  if (!await verifyMMToken(token, tokenTypeToTokenMap.CALL)) {
    res.send({ "username": BOT_NAME, "text": 'Invalid token' });
    return;
  }
  try {
    const authClient = await authorize(user_id, true);
    if (!authClient) {
      res.send({ "username": BOT_NAME, "text": `${user_name}, Before creating a meeting space, you need to verify.\n Use the /connect-with-meet to authenticate your identity` });
      return;
    }
    const meetingUri = await createSpace(authClient);
    res.send({ "username": BOT_NAME, "response_type": "in_channel", "text": meetingUri });
  } catch (error) {
    console.error(error);
    res.send({ "username": BOT_NAME, "text": "Error creating meeting space" });
  }
});


app.post('/meet-register', async (req, res) => {
  const { user_id, token, user_name, response_url } = req.body
  if (!await verifyMMToken(token, tokenTypeToTokenMap.REGISTER)) {
    res.status(403).send({ "username": BOT_NAME, "text": "Invalid token provided, you outsider" });
    return;
  }
  try {
    const authClientUrl = await authorize(user_id, false, response_url);
    if (typeof (authClientUrl) === 'object') {
      return res.status(200).json({ "username": BOT_NAME, "text": `${user_name}, You have already authenticated, you can create a meeting space using the \`/call?\`` });
    }
    else {
      return res.status(200).json({ "username": BOT_NAME, "text": `${user_name}, Please authenticate in your browser to create a meeting space.\nUpon successful authentication, you will be able to create a meeting space using the \`/call?\`.\n[Authenticate here](${authClientUrl})` });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating meeting space');
  }
})

app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const {user_id,response_url} = JSON.parse(state);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    await saveCredentials(oauth2Client, user_id);
    await fetch(response_url, {method: 'POST', body: 'successfully registered, Get started by using the \`/call\`'});
    return res.send('Authentication successful, Go back to Mattermost and create a meeting space using /call?');
    
  } catch (error) {
    console.error(error);
    res.send('Error authenticating');
  }
});
app.get('/', (req, res) => {
  res.send('Hello From Meet Generator');
})

const handler = serverless(app);
/*
Uncomment this part to run the server locally
*/
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

/*
Use this part for running the server on AWS Lambda
*/
// module.exports.handler = async (event, context) => {
//   context.callbackWaitsForEmptyEventLoop = false;
//   return await handler(event, context);
// };