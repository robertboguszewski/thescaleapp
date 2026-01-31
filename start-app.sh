#!/bin/bash
# Dedicated startup script for TheScale App
# Run this in a separate terminal, not from VS Code

cd "$(dirname "$0")"

echo "=== TheScale App Startup Script ==="
echo "Port: 11001 (high port to avoid conflicts)"
echo ""

# Kill any existing processes on port 11001
lsof -ti:11001 | xargs kill -9 2>/dev/null

echo "Building main process..."
npm run build:main

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo ""
echo "Starting Vite dev server on port 11001..."
npm run dev:renderer &
VITE_PID=$!

# Wait for Vite to be ready
echo "Waiting for Vite dev server to start..."
while ! curl -s http://localhost:11001 > /dev/null 2>&1; do
    sleep 1
done
echo "Vite dev server is ready!"

echo ""
echo "Starting Electron..."
NODE_ENV=development ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .

# Cleanup on exit
echo "Shutting down..."
kill $VITE_PID 2>/dev/null
