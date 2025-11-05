#!/bin/bash
# Simple script to create placeholder icons using ImageMagick (if installed)

cd "$(dirname "$0")"

if command -v convert &> /dev/null; then
    # Create simple colored squares as placeholders
    convert -size 16x16 xc:#4f46e5 icon16.png
    convert -size 48x48 xc:#4f46e5 icon48.png
    convert -size 128x128 xc:#4f46e5 icon128.png
    echo "✓ Icons created successfully!"
else
    echo "ImageMagick not installed. Please create icons manually:"
    echo "  - icon16.png (16x16 pixels)"
    echo "  - icon48.png (48x48 pixels)"
    echo "  - icon128.png (128x128 pixels)"
    echo ""
    echo "You can use any PNG image editing tool or online generators."
fi
