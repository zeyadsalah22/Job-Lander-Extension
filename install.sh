#!/bin/bash

echo "Installing Job Lander Extension dependencies..."
npm install

echo "Building extension..."
npm run build

echo ""
echo "Extension built successfully!"
echo ""
echo "Next steps:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (top right toggle)"
echo "3. Click 'Load unpacked'"
echo "4. Select this folder: $(pwd)"
echo "5. The extension will be loaded and ready to use"
echo ""
