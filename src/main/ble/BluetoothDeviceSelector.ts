/**
 * Bluetooth Device Selector
 *
 * Handles device selection logic for Web Bluetooth API in Electron.
 * SECURITY: Only connects to previously configured device (by deviceMac).
 *
 * @module main/ble/BluetoothDeviceSelector
 */

export interface BluetoothDevice {
  deviceId: string;
  deviceName: string;
}

export interface DeviceSelectionResult {
  action: 'select' | 'wait';
  deviceId?: string;
  message?: string;
}

export interface BluetoothDeviceSelectorConfig {
  scanTimeoutMs: number;
  savedDeviceMac?: string;  // Previously configured device ID
  miScalePatterns: RegExp[];
}

const DEFAULT_MI_SCALE_PATTERNS = [
  /^MIBFS/i,      // Mi Body Fat Scale
  /^MIBCS/i,      // Mi Body Composition Scale
  /^XMTZC/i,      // Xiaomi Mi Scale (Chinese)
  /^MI_?SCALE/i,  // MI SCALE or MI_SCALE
  /mi\s*scale/i,  // Mi Scale (with optional space)
  /body.*scale/i, // Body Scale variants
  /xiaomi/i,      // Xiaomi branded
];

const DEFAULT_CONFIG: BluetoothDeviceSelectorConfig = {
  scanTimeoutMs: 60000,
  miScalePatterns: DEFAULT_MI_SCALE_PATTERNS,
};

/**
 * Determines what action to take based on discovered devices.
 *
 * SECURITY POLICY:
 * - If savedDeviceMac is set: ONLY wait for that specific device, ignore everything else
 * - If savedDeviceMac is NOT set (first-time setup): allow Mi Scale pattern matching
 * - NEVER auto-connect to random devices
 */
export function selectDevice(
  devices: BluetoothDevice[],
  config: BluetoothDeviceSelectorConfig = DEFAULT_CONFIG
): DeviceSelectionResult {
  // CASE 1: We have a saved device MAC - ONLY look for that specific device
  if (config.savedDeviceMac) {
    const savedDevice = devices.find(d => d.deviceId === config.savedDeviceMac);

    if (savedDevice) {
      console.log(`[BluetoothSelector] ✓ Found configured scale: "${savedDevice.deviceName}" [${savedDevice.deviceId.substring(0, 8)}...]`);
      return {
        action: 'select',
        deviceId: savedDevice.deviceId,
        message: `ble:device.connectedTo|deviceName=${savedDevice.deviceName}`,
      };
    }

    // Saved device not found - keep waiting silently (don't mention other devices)
    console.log(`[BluetoothSelector] Waiting for configured scale... (${devices.length} other device(s) ignored)`);
    return {
      action: 'wait',
      message: 'ble:device.waitingForConfigured',
    };
  }

  // CASE 2: No saved device (first-time setup) - use Mi Scale pattern matching
  console.log('[BluetoothSelector] First-time setup - scanning for Mi Scale...');

  if (devices.length > 0) {
    console.log(`[BluetoothSelector] Found ${devices.length} device(s):`);
    devices.forEach((d, i) => {
      const isMiScale = config.miScalePatterns.some(p => p.test(d.deviceName || ''));
      const marker = isMiScale ? '★' : ' ';
      console.log(`  ${marker} ${i + 1}. "${d.deviceName || '(no name)'}" [${d.deviceId.substring(0, 8)}...]`);
    });
  }

  // No devices found - wait
  if (devices.length === 0) {
    return {
      action: 'wait',
      message: 'ble:device.scanning',
    };
  }

  const miScale = devices.find(d => {
    if (!d.deviceName) return false;
    return config.miScalePatterns.some(pattern => pattern.test(d.deviceName));
  });

  if (miScale) {
    console.log(`[BluetoothSelector] ✓ Found Mi Scale: "${miScale.deviceName}"`);
    return {
      action: 'select',
      deviceId: miScale.deviceId,
      message: `ble:device.foundScale|deviceName=${miScale.deviceName}`,
    };
  }

  // No Mi Scale found - wait (don't connect to random devices)
  return {
    action: 'wait',
    message: 'ble:device.searchingMiScale',
  };
}

/**
 * Creates a Bluetooth Device Selector state manager
 * Handles timeout and callback management
 */
export class BluetoothDeviceSelectorManager {
  private callback: ((deviceId: string) => void) | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private config: BluetoothDeviceSelectorConfig;
  private onStatusChange: (status: { scanning: boolean; message: string }) => void;
  private onTimeout: () => void;

  constructor(
    config: Partial<BluetoothDeviceSelectorConfig> = {},
    callbacks: {
      onStatusChange: (status: { scanning: boolean; message: string }) => void;
      onTimeout: () => void;
    }
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onStatusChange = callbacks.onStatusChange;
    this.onTimeout = callbacks.onTimeout;
  }

  /**
   * Update the saved device MAC (call when config changes)
   */
  setSavedDeviceMac(mac: string | undefined): void {
    this.config.savedDeviceMac = mac;
  }

  /**
   * Start a new device selection session
   */
  startSession(callback: (deviceId: string) => void): void {
    this.cleanup();
    this.callback = callback;

    // Start timeout timer
    this.timeoutHandle = setTimeout(() => {
      console.log('[BluetoothSelector] Scan timeout reached');
      this.onTimeout();
      this.cancel();
    }, this.config.scanTimeoutMs);

    const message = this.config.savedDeviceMac
      ? 'ble:device.searchingSaved'
      : 'ble:device.scanning';

    this.onStatusChange({
      scanning: true,
      message,
    });
  }

  /**
   * Handle devices update from Electron
   */
  handleDevicesUpdate(devices: BluetoothDevice[]): DeviceSelectionResult {
    const result = selectDevice(devices, this.config);

    if (result.action === 'select' && result.deviceId) {
      this.selectDevice(result.deviceId);
    } else if (result.action === 'wait') {
      this.onStatusChange({
        scanning: true,
        message: result.message || 'ble:device.scanning',
      });
    }

    return result;
  }

  /**
   * User selected a device from picker
   */
  selectDevice(deviceId: string): void {
    if (this.callback) {
      this.callback(deviceId);
      this.cleanup();
      this.onStatusChange({
        scanning: false,
        message: 'ble:status.connected',
      });
    }
  }

  /**
   * Cancel the device selection
   */
  cancel(): void {
    if (this.callback) {
      this.callback('');
    }
    this.cleanup();
    this.onStatusChange({
      scanning: false,
      message: 'ble:device.cancelled',
    });
  }

  /**
   * Clean up timers and state
   */
  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.callback = null;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.callback !== null;
  }
}

export { DEFAULT_CONFIG, DEFAULT_MI_SCALE_PATTERNS };
