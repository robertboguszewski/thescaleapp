/**
 * BLE Worker for UtilityProcess
 *
 * Runs in a separate Node.js process spawned by Electron's utilityProcess.
 * Uses @stoprocent/noble for native BLE access on macOS.
 * Communicates with main process via parentPort messages.
 *
 * @module main/ble/ble-worker
 */

import { isMiScaleDevice, getFullDeviceName, BLE_UUIDS } from './BLETypes';
import type { BLEDevice, RawMeasurement } from './BLETypes';
import { MiScaleParser } from './MiScaleParser';

// Message types for IPC communication
interface WorkerMessage {
  type: string;
  payload?: any;
  requestId?: string;
}

interface ScanRequest {
  type: 'scan';
  requestId: string;
  timeoutMs?: number;
}

interface StopScanRequest {
  type: 'stopScan';
  requestId: string;
}

interface ConnectRequest {
  type: 'connect';
  requestId: string;
  deviceId: string;
}

interface DisconnectRequest {
  type: 'disconnect';
  requestId: string;
}

type RequestMessage = ScanRequest | StopScanRequest | ConnectRequest | DisconnectRequest;

// Import noble
let noble: any = null;
try {
  noble = require('@stoprocent/noble');
  console.log('[BLE-Worker] Loaded @stoprocent/noble');
} catch (e) {
  console.error('[BLE-Worker] Failed to load noble:', e);
}

// Parser for Mi Scale data
const parser = new MiScaleParser();

// Track discovered devices
const discoveredDevices = new Map<string, BLEDevice>();
let isScanning = false;
let scanTimeout: NodeJS.Timeout | null = null;
let connectedPeripheral: any = null;

/**
 * Send message to parent process
 */
function sendToParent(message: WorkerMessage): void {
  if (process.parentPort) {
    process.parentPort.postMessage(message);
  }
}

/**
 * Send response for a specific request
 */
function sendResponse(requestId: string, success: boolean, data?: any, error?: string): void {
  sendToParent({
    type: 'response',
    requestId,
    payload: { success, data, error },
  });
}

/**
 * Send event to parent
 */
function sendEvent(eventType: string, data?: any): void {
  sendToParent({
    type: 'event',
    payload: { eventType, data },
  });
}

/**
 * Handle discovered peripheral
 */
function handleDiscover(peripheral: any): void {
  const { localName, manufacturerData, serviceUuids } = peripheral.advertisement;

  // Log all discovered devices for debugging
  console.log('[BLE-Worker] Discovered:', peripheral.id, localName || '(no name)', 'RSSI:', peripheral.rssi);

  // Check if this is a Mi Scale or has relevant services
  const hasMiScaleService = serviceUuids?.some((uuid: string) =>
    uuid === BLE_UUIDS.BODY_COMPOSITION_SERVICE ||
    uuid === BLE_UUIDS.WEIGHT_SCALE_SERVICE ||
    uuid.includes('181b') ||
    uuid.includes('181d')
  );

  // Filter for Mi Scale devices or devices with scale services
  if (!isMiScaleDevice(localName) && !hasMiScaleService) {
    return;
  }

  const fullName = getFullDeviceName(localName);
  console.log('[BLE-Worker] Mi Scale found:', localName, '->', fullName, peripheral.id);

  const device: BLEDevice = {
    id: peripheral.id,
    name: fullName,
    rssi: peripheral.rssi,
  };

  // Store and emit discovered device
  discoveredDevices.set(peripheral.id, device);
  sendEvent('discovered', device);

  // Try to parse measurement from advertisement data
  if (manufacturerData) {
    const measurement = parser.parseAdvertisementData(manufacturerData);
    if (measurement) {
      sendEvent('measurement', measurement);
    }
  }
}

/**
 * Start BLE scanning
 */
async function startScan(requestId: string, timeoutMs: number = 10000): Promise<void> {
  if (!noble) {
    sendResponse(requestId, false, null, 'Noble not available');
    return;
  }

  if (isScanning) {
    sendResponse(requestId, false, null, 'Already scanning');
    return;
  }

  // Wait for Bluetooth to be ready
  if (noble.state !== 'poweredOn') {
    console.log('[BLE-Worker] Waiting for Bluetooth to be ready, current state:', noble.state);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Bluetooth initialization timeout'));
      }, 5000);

      const checkState = () => {
        if (noble.state === 'poweredOn') {
          clearTimeout(timeout);
          noble.removeListener('stateChange', checkState);
          resolve();
        } else if (noble.state === 'poweredOff' || noble.state === 'unauthorized') {
          clearTimeout(timeout);
          noble.removeListener('stateChange', checkState);
          reject(new Error(`Bluetooth ${noble.state}`));
        }
      };

      noble.on('stateChange', checkState);
      checkState(); // Check immediately
    });
  }

  console.log('[BLE-Worker] Starting scan...');
  discoveredDevices.clear();
  isScanning = true;

  // Setup discover handler
  noble.on('discover', handleDiscover);

  try {
    // Scan for Body Composition and Weight Scale services
    await noble.startScanningAsync(
      [BLE_UUIDS.BODY_COMPOSITION_SERVICE, BLE_UUIDS.WEIGHT_SCALE_SERVICE],
      true // allowDuplicates for continuous measurement updates
    );

    sendEvent('scanStarted');

    // Set scan timeout
    scanTimeout = setTimeout(async () => {
      await stopScan('timeout');

      const devices = Array.from(discoveredDevices.values());
      sendResponse(requestId, true, { devices, timedOut: true });
    }, timeoutMs);

    // Initial response that scan started
    sendResponse(requestId, true, { scanning: true });

  } catch (error) {
    isScanning = false;
    noble.removeAllListeners('discover');
    const message = error instanceof Error ? error.message : String(error);
    sendResponse(requestId, false, null, message);
  }
}

/**
 * Stop BLE scanning
 */
async function stopScan(requestId: string): Promise<void> {
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }

  if (!isScanning) {
    sendResponse(requestId, true, { devices: Array.from(discoveredDevices.values()) });
    return;
  }

  console.log('[BLE-Worker] Stopping scan...');
  isScanning = false;

  if (noble) {
    noble.removeAllListeners('discover');
    try {
      await noble.stopScanningAsync();
    } catch (e) {
      console.error('[BLE-Worker] Error stopping scan:', e);
    }
  }

  const devices = Array.from(discoveredDevices.values());
  sendEvent('scanStopped', { devices });
  sendResponse(requestId, true, { devices });
}

/**
 * Connect to a device
 */
async function connectToDevice(requestId: string, deviceId: string): Promise<void> {
  if (!noble) {
    sendResponse(requestId, false, null, 'Noble not available');
    return;
  }

  // Stop scanning first
  await stopScan('connect');

  console.log('[BLE-Worker] Connecting to:', deviceId);
  sendEvent('connecting', { deviceId });

  // TODO: Implement connection logic
  // For now, just report success - measurement reading happens via advertisement
  sendResponse(requestId, true, { connected: true, deviceId });
}

/**
 * Disconnect from current device
 */
async function disconnect(requestId: string): Promise<void> {
  if (connectedPeripheral) {
    try {
      await connectedPeripheral.disconnectAsync();
    } catch (e) {
      console.error('[BLE-Worker] Error disconnecting:', e);
    }
    connectedPeripheral = null;
  }

  sendEvent('disconnected');
  sendResponse(requestId, true);
}

/**
 * Handle messages from parent process
 */
function handleMessage(message: RequestMessage): void {
  console.log('[BLE-Worker] Received message:', message.type);

  switch (message.type) {
    case 'scan':
      startScan(message.requestId, message.timeoutMs);
      break;
    case 'stopScan':
      stopScan(message.requestId);
      break;
    case 'connect':
      connectToDevice(message.requestId, message.deviceId);
      break;
    case 'disconnect':
      disconnect(message.requestId);
      break;
    default:
      console.warn('[BLE-Worker] Unknown message type:', (message as any).type);
  }
}

/**
 * Initialize worker
 */
function init(): void {
  console.log('[BLE-Worker] Initializing...');

  if (!process.parentPort) {
    console.error('[BLE-Worker] No parent port available - not running as utility process');
    return;
  }

  // Setup message handler
  process.parentPort.on('message', (event) => {
    handleMessage(event.data);
  });

  // Setup noble state change handler
  if (noble) {
    noble.on('stateChange', (state: string) => {
      console.log('[BLE-Worker] Bluetooth state:', state);
      sendEvent('stateChange', { state });
    });

    // Report initial state
    sendEvent('ready', {
      state: noble.state,
      available: true
    });
  } else {
    sendEvent('ready', {
      state: 'unavailable',
      available: false,
      error: 'Noble module not loaded'
    });
  }

  console.log('[BLE-Worker] Ready');
}

// Start the worker
init();
