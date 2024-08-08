#!/bin/bash

# Define the name of the zip file
ZIP_FILE="bundle.zip"

# Create the zip file excluding node_modules and .vscode directories
zip -r $ZIP_FILE . -x "node_modules/*" ".vscode/*" ".git/*" "credentials_org.json" "bundle.sh"

echo "Files have been bundled into $ZIP_FILE, excluding node_modules and .vscode directories."