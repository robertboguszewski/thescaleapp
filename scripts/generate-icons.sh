#!/bin/bash
# Generate app icons from SVG source
# Requires: Inkscape or librsvg (rsvg-convert)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/build/icons"
SVG_SOURCE="$ICONS_DIR/icon.svg"

echo "🎨 TheScale App Icon Generator"
echo "=============================="

# Check for SVG source
if [ ! -f "$SVG_SOURCE" ]; then
    echo "❌ Error: SVG source not found at $SVG_SOURCE"
    exit 1
fi

# Check for conversion tools
if command -v rsvg-convert &> /dev/null; then
    SVG_CONVERTER="rsvg-convert"
    echo "✅ Using rsvg-convert"
elif command -v inkscape &> /dev/null; then
    SVG_CONVERTER="inkscape"
    echo "✅ Using Inkscape"
else
    echo "❌ Error: Neither rsvg-convert nor Inkscape found"
    echo "   Install with: brew install librsvg"
    exit 1
fi

cd "$ICONS_DIR"

# Generate base PNG (1024x1024 for retina)
echo "📐 Generating base PNG..."
if [ "$SVG_CONVERTER" = "rsvg-convert" ]; then
    rsvg-convert -w 1024 -h 1024 icon.svg > icon_1024.png
else
    inkscape -w 1024 -h 1024 icon.svg -o icon_1024.png
fi

# Generate standard sizes
echo "📐 Generating standard sizes..."
sips -z 512 512 icon_1024.png --out icon.png 2>/dev/null
sips -z 256 256 icon_1024.png --out icon_256.png 2>/dev/null

# Generate macOS iconset
echo "🍎 Generating macOS iconset..."
mkdir -p icon.iconset

sips -z 16 16     icon_1024.png --out icon.iconset/icon_16x16.png 2>/dev/null
sips -z 32 32     icon_1024.png --out icon.iconset/icon_16x16@2x.png 2>/dev/null
sips -z 32 32     icon_1024.png --out icon.iconset/icon_32x32.png 2>/dev/null
sips -z 64 64     icon_1024.png --out icon.iconset/icon_32x32@2x.png 2>/dev/null
sips -z 128 128   icon_1024.png --out icon.iconset/icon_128x128.png 2>/dev/null
sips -z 256 256   icon_1024.png --out icon.iconset/icon_128x128@2x.png 2>/dev/null
sips -z 256 256   icon_1024.png --out icon.iconset/icon_256x256.png 2>/dev/null
sips -z 512 512   icon_1024.png --out icon.iconset/icon_256x256@2x.png 2>/dev/null
sips -z 512 512   icon_1024.png --out icon.iconset/icon_512x512.png 2>/dev/null
sips -z 1024 1024 icon_1024.png --out icon.iconset/icon_512x512@2x.png 2>/dev/null

# Convert to ICNS
iconutil -c icns icon.iconset
rm -rf icon.iconset

# Clean up intermediate files
rm -f icon_1024.png icon_256.png

echo ""
echo "✅ Icons generated successfully!"
echo "   📁 $ICONS_DIR"
echo "   - icon.png (512x512)"
echo "   - icon.icns (macOS)"
echo ""
echo "⚠️  Note: For Windows builds, convert icon.png to icon.ico using:"
echo "   https://icoconvert.com/ or ImageMagick"
