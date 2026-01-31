/**
 * BLE Port Interface
 * Defines the contract for BLE communication adapters
 *
 * This is a port in Clean Architecture - it belongs to the application layer
 * and defines what the infrastructure must implement.
 *
 * @module application/ports/BLEPort
 */

import { RawMeasurement } from '../../domain/calculations/types';

/**
 * Possible states of the BLE connection
 */
export type BLEConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'error';

/**
 * Error codes for BLE operations
 */
export type BLEErrorCode =
  | 'BLUETOOTH_OFF'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_TIMEOUT'
  | 'READ_FAILED'
  | 'DECRYPTION_FAILED'
  | 'INVALID_DATA';

/**
 * Structured BLE error with recovery information
 */
export interface BLEError {
  /** Error code for programmatic handling */
  code: BLEErrorCode;
  /** Human-readable error message */
  message: string;
  /** Whether the operation can be retried */
  recoverable: boolean;
  /** User-friendly suggestion for resolving the issue */
  suggestion: string;
}

/**
 * Callback type for state change notifications
 */
export type StateChangeCallback = (state: BLEConnectionState) => void;

/**
 * Callback type for error notifications
 */
export type ErrorCallback = (error: BLEError) => void;

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;

/**
 * Callback for discovered devices during scanning
 */
export type DeviceDiscoveredCallback = (device: BLEDeviceInfo) => void;

/**
 * BLE Port Interface
 *
 * Defines all operations needed for communicating with the Xiaomi Mi Scale S400
 * via Bluetooth Low Energy.
 *
 * Implementation notes:
 * - All async operations should handle timeouts internally
 * - State changes should be emitted for UI feedback
 * - Errors should be structured for user-friendly display
 */
export interface BLEPort {
  /**
   * Get the current connection state
   * @returns Current BLE connection state
   */
  getState(): BLEConnectionState;

  /**
   * Subscribe to state changes
   * @param callback - Function called when state changes
   * @returns Unsubscribe function to remove the listener
   */
  onStateChange(callback: StateChangeCallback): Unsubscribe;

  /**
   * Subscribe to error events
   * @param callback - Function called when an error occurs
   * @returns Unsubscribe function to remove the listener
   */
  onError(callback: ErrorCallback): Unsubscribe;

  /**
   * Subscribe to device discovery events during scanning
   * @param callback - Function called when a Mi Scale device is discovered
   * @returns Unsubscribe function to remove the listener
   */
  onDeviceDiscovered(callback: DeviceDiscoveredCallback): Unsubscribe;

  /**
   * Start scanning for the Xiaomi Mi Scale S400
   * @param timeoutMs - Scan timeout in milliseconds (default: 30000)
   * @throws BLEError when Bluetooth is off or device not found
   */
  scan(timeoutMs?: number): Promise<void>;

  /**
   * Scan for nearby Mi Scale devices and return list of discovered devices
   * Unlike scan(), this doesn't throw on no device found - returns empty array
   * @param timeoutMs - Scan timeout in milliseconds (default: 10000)
   * @returns Array of discovered Mi Scale devices
   */
  scanForDevices(timeoutMs?: number): Promise<BLEDeviceInfo[]>;

  /**
   * Stop current scanning operation
   */
  stopScan(): void;

  /**
   * Connect to the scale
   * @param deviceMac - MAC address of the scale
   * @param bleKey - Encryption key for MiBeacon data
   * @throws BLEError on connection failure
   */
  connect(deviceMac: string, bleKey: string): Promise<void>;

  /**
   * Disconnect from the scale
   * Gracefully closes the connection
   */
  disconnect(): Promise<void>;

  /**
   * Read measurement data from the scale
   * Waits for a stable measurement (weight and optionally impedance)
   * @returns Raw measurement data
   * @throws BLEError on read failure or decryption error
   */
  readMeasurement(): Promise<RawMeasurement>;

  /**
   * Check if the configured device is available (in range and advertising)
   * @returns True if device is discoverable
   */
  isDeviceAvailable(): Promise<boolean>;
}

/**
 * Device information returned during scanning
 */
export interface BLEDeviceInfo {
  /** Device MAC address */
  mac: string;
  /** Device name (e.g., "MIBFS" for Mi Scale) */
  name: string;
  /** Signal strength in dBm */
  rssi: number;
}

/**
 * Configuration for BLE adapter
 */
export interface BLEConfig {
  /** MAC address of the target device */
  deviceMac: string;
  /** BLE key for decryption */
  bleKey: string;
  /** Default scan timeout in milliseconds */
  scanTimeoutMs?: number;
  /** Connection timeout in milliseconds */
  connectTimeoutMs?: number;
  /** Read timeout in milliseconds */
  readTimeoutMs?: number;
}
