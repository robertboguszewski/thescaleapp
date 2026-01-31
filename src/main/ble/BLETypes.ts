/**
 * BLE Types for Native Bluetooth Implementation
 *
 * @module main/ble/BLETypes
 */

/**
 * Raw measurement data from the scale
 */
export interface RawMeasurement {
  weightKg: number;
  impedanceOhm?: number;
  timestamp?: Date;
}

/**
 * BLE Device information
 */
export interface BLEDevice {
  id: string;
  name: string;
  rssi?: number;
}

/**
 * BLE Adapter configuration
 */
export interface BLEAdapterConfig {
  deviceMac: string | null;
  autoConnect: boolean;
  scanInterval: number;
  scanTimeout: number;
  allowDuplicates: boolean;
}

/**
 * BLE Connection state
 */
export type BLEConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * BLE Adapter events
 */
export interface BLEAdapterEvents {
  ready: () => void;
  unavailable: (state: string) => void;
  scanning: () => void;
  discovered: (device: BLEDevice) => void;
  connecting: (deviceId: string) => void;
  connected: (device: BLEDevice) => void;
  disconnected: () => void;
  measurement: (measurement: RawMeasurement) => void;
  error: (error: Error) => void;
}

/**
 * BLE Adapter interface for abstraction
 * Allows swapping between Noble and Web Bluetooth implementations
 */
export interface IBLEAdapter {
  startScanning(): Promise<void>;
  stopScanning(): Promise<void>;
  disconnect(): Promise<void>;
  setDeviceMac(mac: string | null): void;
  getConnectedDevice(): BLEDevice | null;
  isConnected(): boolean;
  getState(): BLEConnectionState;

  // Event handling
  on<K extends keyof BLEAdapterEvents>(event: K, listener: BLEAdapterEvents[K]): this;
  off<K extends keyof BLEAdapterEvents>(event: K, listener: BLEAdapterEvents[K]): this;
  removeAllListeners(): this;
}

/**
 * Mi Scale device name patterns
 */
export const MI_SCALE_PATTERNS = [
  /^MIBFS/i,           // Mi Body Fat Scale
  /^MIBCS/i,           // Mi Body Composition Scale
  /^XMTZC/i,           // Xiaomi Mi Scale (Chinese)
  /^MI_?SCALE/i,       // MI SCALE or MI_SCALE
  /mi\s*scale/i,       // Mi Scale (with optional space)
  /body.*scale/i,      // Body Scale variants
  /xiaomi.*scale/i,    // Xiaomi Scale (e.g., "Xiaomi Scale S400")
  /scale.*s400/i,      // S400 model
];

/**
 * BLE Service and Characteristic UUIDs
 */
export const BLE_UUIDS = {
  // Services
  BODY_COMPOSITION_SERVICE: '181b',
  WEIGHT_SCALE_SERVICE: '181d',

  // Characteristics
  BODY_COMPOSITION_MEASUREMENT: '2a9c',
  WEIGHT_MEASUREMENT: '2a9d',
} as const;

/**
 * Check if a device name matches Mi Scale patterns
 */
export function isMiScaleDevice(deviceName: string | null | undefined): boolean {
  if (!deviceName) return false;
  return MI_SCALE_PATTERNS.some(pattern => pattern.test(deviceName));
}

/**
 * Map short BLE advertisement names to full device names
 * BLE advertisement packets are limited to 31 bytes, so devices use short names
 */
const DEVICE_NAME_MAP: Record<string, string> = {
  'MIBFS': 'Mi Body Fat Scale',
  'MIBCS': 'Mi Body Composition Scale',
  'MIBCS2': 'Mi Body Composition Scale 2',
  'XMTZC01HM': 'Xiaomi Mi Scale',
  'XMTZC02HM': 'Xiaomi Mi Scale 2',
  'XMTZC04HM': 'Mi Body Composition Scale',
  'XMTZC05HM': 'Mi Body Composition Scale 2',
};

/**
 * Get the full device name from BLE advertisement name
 * Returns the original name if no mapping exists
 */
export function getFullDeviceName(bleName: string | null | undefined): string {
  if (!bleName) return 'Mi Scale';

  // Check exact match first
  const exactMatch = DEVICE_NAME_MAP[bleName.toUpperCase()];
  if (exactMatch) return exactMatch;

  // Check prefix match (e.g., "MIBFS_1234" -> "Mi Body Fat Scale")
  for (const [prefix, fullName] of Object.entries(DEVICE_NAME_MAP)) {
    if (bleName.toUpperCase().startsWith(prefix)) {
      return fullName;
    }
  }

  // Return original name if no mapping found
  return bleName;
}
