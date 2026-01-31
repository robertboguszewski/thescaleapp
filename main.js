// Try both import styles
let app, BrowserWindow

try {
  // New style (Electron 12+)
  const electron = require('electron/main')
  app = electron.app
  BrowserWindow = electron.BrowserWindow
  console.log('Loaded via electron/main')
} catch (e1) {
  try {
    // Old style
    const electron = require('electron')
    app = electron.app
    BrowserWindow = electron.BrowserWindow
    console.log('Loaded via electron')
  } catch (e2) {
    console.error('Failed to load electron:', e1, e2)
    process.exit(1)
  }
}

console.log('app:', typeof app)
console.log('BrowserWindow:', typeof BrowserWindow)

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
