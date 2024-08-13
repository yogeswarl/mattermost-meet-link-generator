#!/bin/bash

# Define the name of the zip file
ZIP_FILE="bundle.zip"
NODE_JS_FOLDER="nodejs.zip" 
# check if the zip file already exists
if [ -f $ZIP_FILE ]; then
  echo "Removing existing $ZIP_FILE file..."
  rm $ZIP_FILE
fi
# Create the zip file excluding node_modules and .vscode directories
zip -r $ZIP_FILE . .env credentials.json index.js template.yml token.json

echo "Files have been bundled into $ZIP_FILE, excluding node_modules and .vscode directories."

zip -r $NODE_JS_FOLDER nodejs