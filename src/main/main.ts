/**
 * Electron Main Process
 *
 * Entry point for the Electron application.
 * Handles window creation, IPC setup, and application lifecycle.
 *
 * @module main/main
 */

import { app, BrowserWindow, shell, ipcMain, session } from 'electron';
import path from 'path';
import { initializeServices, areServicesInitialized, getAppConfigStoreInstance } from './services';
import { registerIpcHandlers, registerNativeBLEHandlers, setupBLEEventForwarding, setupNativeBLEEventForwarding } from './ipc-handlers';

/**
 * Persistent Bluetooth device permissions
 * Stores device IDs that have been granted permission
 */
const grantedBluetoothDevices = new Set<string>();

/**
 * Load previously granted devices from config
 */
function loadGrantedDevices(): void {
  try {
    const configStore = getAppConfigStoreInstance();
    const bleConfig = configStore.getBLEConfig();
    if (bleConfig.deviceMac) {
      grantedBluetoothDevices.add(bleConfig.deviceMac);
      console.log('[Main] Loaded saved Bluetooth device:', bleConfig.deviceMac);
    }
  } catch (err) {
    console.log('[Main] No saved Bluetooth devices to load');
  }
}

/**
 * Main window reference
 * Keep a global reference to prevent garbage collection
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Cleanup function for BLE event forwarding
 */
let cleanupBLEEvents: (() => void) | null = null;

/**
 * Check if the app is running in development mode
 * Only use dev server when explicitly set via NODE_ENV
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Create the main application window
 */
function createWindow(): void {
  // Create the browser window with security-focused settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false, // Don't show until ready
    backgroundColor: '#1a1a2e', // Dark background to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, // Protect against prototype pollution
      nodeIntegration: false, // Disable node.js in renderer
      sandbox: false, // Disable sandbox for Bluetooth access
      webSecurity: true, // Enable web security
      allowRunningInsecureContent: false,
      // Enable Web Bluetooth API
      experimentalFeatures: true,
    },
    // macOS-specific styling
    titleBarStyle: 'hiddenInset', // Native macOS look with traffic lights
    vibrancy: 'sidebar', // macOS blur effect
    visualEffectState: 'active', // Always show vibrancy
    trafficLightPosition: { x: 20, y: 20 }, // Position traffic lights
  });

  // Load the app
  if (isDevelopment()) {
    // In development, load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:11001';
    mainWindow.loadURL(devServerUrl);

    // Open DevTools in development
    mainWindow.webContents.openDevTools();

    console.log('[Main] Loading from dev server:', devServerUrl);
  } else {
    // In production, load from built files
    const indexPath = path.join(__dirname, '../renderer/index.html');
    mainWindow.loadFile(indexPath);

    console.log('[Main] Loading from file:', indexPath);
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Handle Web Bluetooth device selection
  // This is called when the renderer requests a Bluetooth device
  let bluetoothPinCallback: ((deviceId: string) => void) | null = null;
  let bluetoothDevices: { deviceId: string; deviceName: string }[] = [];

  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();

    console.log('[Main] ====== Bluetooth Device Discovery ======');
    console.log('[Main] Total devices found:', devices.length);
    devices.forEach((d, i) => {
      console.log(`[Main]   ${i + 1}. "${d.deviceName}" (ID: ${d.deviceId})`);
    });
    console.log('[Main] ==========================================');

    bluetoothDevices = devices;
    bluetoothPinCallback = callback;

    // Pattern matching for Mi Scale variants
    // Known names: MIBFS, MIBCS, XMTZC, MI_SCALE, Mi Scale, Body Scale
    const miScalePatterns = [
      /^MIBFS/i,      // Mi Body Fat Scale
      /^MIBCS/i,      // Mi Body Composition Scale
      /^XMTZC/i,      // Xiaomi Mi Scale (Chinese)
      /^MI_?SCALE/i,  // MI SCALE or MI_SCALE
      /mi\s*scale/i,  // Mi Scale (with optional space)
      /body.*scale/i, // Body Scale variants
      /xiaomi/i,      // Xiaomi branded
    ];

    const miScale = devices.find(d => {
      if (!d.deviceName) return false;
      return miScalePatterns.some(pattern => pattern.test(d.deviceName));
    });

    if (miScale) {
      console.log('[Main] ✓ Auto-selecting Mi Scale:', miScale.deviceName);
      grantedBluetoothDevices.add(miScale.deviceId);
      callback(miScale.deviceId);
    } else if (devices.length === 1) {
      // If only one device, auto-select it
      console.log('[Main] ✓ Auto-selecting single device:', devices[0].deviceName || 'Unknown');
      grantedBluetoothDevices.add(devices[0].deviceId);
      callback(devices[0].deviceId);
    } else if (devices.length > 0) {
      // Multiple devices - send to renderer for user selection
      console.log('[Main] Multiple devices found, sending to UI for selection...');
      mainWindow?.webContents.send('bluetooth:devices-found', devices);
    } else {
      // No devices found
      console.log('[Main] ✗ No Bluetooth devices found. Is the scale awake?');
      console.log('[Main] TIP: Step on the scale to wake it up before connecting.');
      callback('');
    }
  });

  // Handle device selection from renderer
  ipcMain.on('bluetooth:select-device', (_event, deviceId) => {
    console.log('[Main] User selected device:', deviceId);
    if (deviceId) {
      grantedBluetoothDevices.add(deviceId);
    }
    if (bluetoothPinCallback) {
      bluetoothPinCallback(deviceId);
      bluetoothPinCallback = null;
    }
  });

  // Cancel Bluetooth pairing
  ipcMain.on('bluetooth:cancel', () => {
    console.log('[Main] Bluetooth pairing cancelled');
    if (bluetoothPinCallback) {
      bluetoothPinCallback('');
      bluetoothPinCallback = null;
    }
  });

  // Setup BLE event forwarding (old system - for backwards compatibility)
  cleanupBLEEvents = setupBLEEventForwarding(mainWindow);

  // Setup Native BLE event forwarding (new system - nativeBLE IPC)
  const cleanupNativeBLE = setupNativeBLEEventForwarding(mainWindow);

  // Handle external link clicks
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle window close
  mainWindow.on('closed', () => {
    // Cleanup BLE event listeners
    if (cleanupBLEEvents) {
      cleanupBLEEvents();
      cleanupBLEEvents = null;
    }

    // Cleanup Native BLE event listeners
    if (cleanupNativeBLE) {
      cleanupNativeBLE();
    }

    // Dereference the window object
    mainWindow = null;
  });

  // Log navigation events in development
  if (isDevelopment()) {
    mainWindow.webContents.on('did-navigate', (_event, url) => {
      console.log('[Main] Navigated to:', url);
    });

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Main] Failed to load:', errorCode, errorDescription);
    });
  }
}

/**
 * Setup persistent Bluetooth permissions
 * This allows getDevices() to return previously paired devices across sessions
 */
function setupBluetoothPermissions(): void {
  console.log('[Main] Setting up persistent Bluetooth permissions...');

  // Handle device permission requests - grant permission for Bluetooth devices
  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'bluetooth') {
      // Grant permission and remember the device
      if (details.device?.deviceId) {
        grantedBluetoothDevices.add(details.device.deviceId);
        console.log('[Main] Granted Bluetooth permission for:', details.device.deviceName || details.device.deviceId);
      }
      return true; // Grant permission
    }
    return false;
  });

  // Check if a device has permission - enables getDevices() to work
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'bluetooth') {
      // Allow Bluetooth permission checks
      return true;
    }
    return true; // Allow other permissions by default
  });

  // Handle Bluetooth pairing requests
  session.defaultSession.setBluetoothPairingHandler((details, callback) => {
    console.log('[Main] Bluetooth pairing request:', details);
    // Auto-confirm pairing (most scales don't require PIN)
    callback({ confirmed: true });
  });

  console.log('[Main] Bluetooth permissions configured');
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  console.log('[Main] Initializing application...');
  console.log('[Main] Platform:', process.platform);
  console.log('[Main] Electron version:', process.versions.electron);
  console.log('[Main] Node version:', process.versions.node);
  console.log('[Main] Development mode:', isDevelopment());

  // Initialize services first (needed for config store)
  initializeServices();

  // Load previously granted Bluetooth devices from config
  loadGrantedDevices();

  // Setup persistent Bluetooth permissions BEFORE creating window
  setupBluetoothPermissions();

  if (!areServicesInitialized()) {
    console.error('[Main] Failed to initialize services');
    app.quit();
    return;
  }

  // Register IPC handlers
  registerIpcHandlers();
  registerNativeBLEHandlers();

  // Create the main window
  createWindow();

  console.log('[Main] Application initialized successfully');
}

// ====== Application Lifecycle ======

// This method will be called when Electron has finished initialization
app.whenReady().then(initialize);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle second instance (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// ====== Security Handlers ======

// Prevent navigation to untrusted URLs
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Allow navigation only to localhost in development
    if (isDevelopment()) {
      if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
        console.warn('[Security] Blocked navigation to:', navigationUrl);
        event.preventDefault();
      }
    } else {
      // In production, prevent all navigation
      console.warn('[Security] Blocked navigation to:', navigationUrl);
      event.preventDefault();
    }
  });

  // Disable creation of new windows
  contents.setWindowOpenHandler(({ url }) => {
    // Open external URLs in the default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});

// ====== Error Handling ======

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
app.on('before-quit', () => {
  console.log('[Main] Application shutting down...');

  // Cleanup resources
  if (cleanupBLEEvents) {
    cleanupBLEEvents();
    cleanupBLEEvents = null;
  }
});

// Export for testing
export { createWindow, mainWindow };
