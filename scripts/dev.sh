#!/bin/bash
# Development script using packaged app with live dist folder
# The packaged app doesn't have node_modules/electron, so module resolution works correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_DIR/release/mac/TheScale App.app"

# Build the project
echo "[dev] Building project..."
npm run build

# Check if packaged app exists, if not create it
if [ ! -d "$APP_PATH" ]; then
    echo "[dev] Creating packaged app (first run only)..."
    npm run pack
fi

# Remove existing app.asar and replace with symlink to project folder
RESOURCES_DIR="$APP_PATH/Contents/Resources"

# Remove existing app/app.asar
rm -rf "$RESOURCES_DIR/app" "$RESOURCES_DIR/app.asar" 2>/dev/null

# Create an 'app' folder that contains our project structure
# Using symlink to allow live reloading
echo "[dev] Setting up development app folder..."
mkdir -p "$RESOURCES_DIR/app"

# Copy package.json (needed for main entry point)
cp "$PROJECT_DIR/package.json" "$RESOURCES_DIR/app/"

# Symlink dist folder for live updates
ln -sf "$PROJECT_DIR/dist" "$RESOURCES_DIR/app/dist"

# Run the app
echo "[dev] Starting app..."
echo "[dev] App path: $APP_PATH"

# Run in foreground to see output
"$APP_PATH/Contents/MacOS/TheScale App"
