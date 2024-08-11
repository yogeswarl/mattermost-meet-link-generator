#!/bin/bash

# Define the name of the zip file
ZIP_FILE="bundle.zip"
NODE_JS_FOLDER="nodejs" 
# Create the zip file excluding node_modules and .vscode directories
zip -r $ZIP_FILE . -x "node_modules/*" ".vscode/*" ".git/*" "credentials_org.json" "bundle.sh" "package.json" "package-lock.json"

echo "Files have been bundled into $ZIP_FILE, excluding node_modules and .vscode directories."

zip -r $NODE_JS_FOLDER "node_modules/*" "package.json" "package-lock.json"