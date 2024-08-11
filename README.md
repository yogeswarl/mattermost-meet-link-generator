# Mattermost Meet Link Generator
A simple API that Authorises Mattermost user's to Google Meet to generate Meet Links on the fly. 

## Requirements
- `npm i` to install the packages
- `.env` file to be populated with mattermost tokens for the created custom slash commands.
- `tokens.json` is an empty file with an empty json structure that should be created to store user access token and refresh token. **Do not push this code**

# Features
- Support for Multiple user authentication and Meet generation
- Versatile API that generates Meet Links on the fly using GoogleAPIs
- Secure Handling of User Access tokens with ephemeral updates to Mattermost's user journey.
- Deploy as a Function as a Service using `AWS Lambda`. 

# Setup
- Create your custom slash commands and add them to Mattermost. [Follow this guide](https://developers.mattermost.com/integrate/slash-commands/custom/)
- You need two commands, One to `connect` (which will be used once) that will authenticate the user and another slash command `create-meet-link` to create a video space.
- On successful setup you will be presented with a Token that needs to be added to the `.env`.![Screenshot 2024-07-28 at 7 43 48 PM](https://github.com/user-attachments/assets/58f30fee-8f64-4dff-aea8-c03e41ca9c24)
- Create an Google Project setup a cloud environment [following this guide](https://developers.google.com/meet/api/guides/quickstart/nodejs#set_up_your_environment). Completely Free!!
- _When configuring your credentials, create one for a web application. Since this an express application_

# Future
- Tag users when creating a meet link, to let them know to join the call.
- Create future dated meet links.
- Create calendar events.

Please create issues to let me know if you are encountering any errors. 
