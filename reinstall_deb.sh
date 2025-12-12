#!/bin/bash

# Find the .deb file
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)

if [ -z "$DEB_FILE" ]; then
    echo "Error: No .deb file found in src-tauri/target/release/bundle/deb/"
    exit 1
fi

echo "Found .deb file: $DEB_FILE"

# Get the package name
PACKAGE_NAME=$(dpkg -f "$DEB_FILE" Package)

if [ -z "$PACKAGE_NAME" ]; then
    echo "Error: Could not determine package name from $DEB_FILE"
    exit 1
fi

echo "Package name: $PACKAGE_NAME"

# Remove the package if installed
if dpkg -s "$PACKAGE_NAME" >/dev/null 2>&1; then
    echo "Removing existing package $PACKAGE_NAME..."
    sudo dpkg -r "$PACKAGE_NAME"
else
    echo "Package $PACKAGE_NAME is not installed."
fi

# Install the new package
echo "Installing $DEB_FILE..."
sudo dpkg -i "$DEB_FILE"

echo "Done."
