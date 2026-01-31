# App Icons

This directory contains icons for TheScale App.

## Required Files

| File | Platform | Size | Status |
|------|----------|------|--------|
| `icon.icns` | macOS | 512x512+ | **Required for macOS build** |
| `icon.ico` | Windows | 256x256 | Required for Windows build |
| `icon.png` | Linux/General | 512x512 | Required for Linux build |

## Source File

- `icon.svg` - Vector source for generating all icon formats

## Generating Icons

### Option 1: Using macOS built-in tools

```bash
# Generate PNG from SVG (requires Inkscape or rsvg-convert)
rsvg-convert -w 512 -h 512 icon.svg > icon.png

# Generate ICNS from PNG (macOS only)
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

### Option 2: Using electron-icon-builder (Recommended)

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=icon.png --output=./
```

### Option 3: Online Tools

1. Convert SVG to 1024x1024 PNG at: https://svgtopng.com/
2. Generate ICNS at: https://cloudconvert.com/png-to-icns
3. Generate ICO at: https://icoconvert.com/

## Notes

- electron-builder will look for icons in this directory by default
- The `icon.icns` file is **required** for macOS builds
- If icons are missing, electron-builder will use default Electron icon
