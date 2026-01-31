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
  /^MIBFS/i,      // Mi Body Fat Scale
  /^MIBCS/i,      // Mi Body Composition Scale
  /^XMTZC/i,      // Xiaomi Mi Scale (Chinese)
  /^MI_?SCALE/i,  // MI SCALE or MI_SCALE
  /mi\s*scale/i,  // Mi Scale (with optional space)
  /body.*scale/i, // Body Scale variants
  /xiaomi/i,      // Xiaomi branded
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
