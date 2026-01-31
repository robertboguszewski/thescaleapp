/**
 * Native BLE Port Implementation
 *
 * Adapter implementing BLEPort interface using NobleBLEAdapter.
 * Bridges the Clean Architecture port interface with Native Bluetooth.
 *
 * @module infrastructure/ble/NativeBLEPort
 */

import type {
  BLEPort,
  BLEConnectionState,
  BLEError,
  BLEDeviceInfo,
  StateChangeCallback,
  ErrorCallback,
  DeviceDiscoveredCallback,
  Unsubscribe,
} from '../../application/ports/BLEPort';
import type { RawMeasurement } from '../../domain/calculations/types';
import { NobleBLEAdapter, type INoble } from '../../main/ble/NobleBLEAdapter';
import type { BLEConnectionState as AdapterConnectionState, BLEDevice } from '../../main/ble/BLETypes';

/**
 * Configuration for NativeBLEPort
 */
export interface NativeBLEPortConfig {
  /** Default scan timeout in milliseconds */
  scanTimeoutMs?: number;
  /** Connection timeout in milliseconds */
  connectTimeoutMs?: number;
  /** Read timeout in milliseconds */
  readTimeoutMs?: number;
  /** Whether to auto-connect when device is found */
  autoConnect?: boolean;
}

const DEFAULT_CONFIG: Required<NativeBLEPortConfig> = {
  scanTimeoutMs: 30000,
  connectTimeoutMs: 10000,
  readTimeoutMs: 15000,
  autoConnect: false,
};

/**
 * Map adapter state to BLEPort state
 */
function mapState(adapterState: AdapterConnectionState): BLEConnectionState {
  switch (adapterState) {
    case 'idle':
    case 'disconnected':
      return 'disconnected';
    case 'scanning':
      return 'scanning';
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'error':
      return 'error';
    default:
      return 'disconnected';
  }
}

/**
 * Map BLEDevice to BLEDeviceInfo
 */
function mapDevice(device: BLEDevice): BLEDeviceInfo {
  return {
    mac: device.id,
    name: device.name,
    rssi: device.rssi ?? -100,
  };
}

/**
 * Create a timeout promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Native BLE Port
 *
 * Implements BLEPort interface using the native Noble-based BLE adapter.
 * Provides proper timeout handling, state management, and error mapping.
 */
export class NativeBLEPort implements BLEPort {
  private adapter: NobleBLEAdapter;
  private config: Required<NativeBLEPortConfig>;
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private deviceDiscoveredCallbacks: Set<DeviceDiscoveredCallback> = new Set();
  private state: BLEConnectionState = 'disconnected';
  private currentDeviceMac: string | null = null;
  private pendingMeasurement: RawMeasurement | null = null;
  private measurementResolver: ((measurement: RawMeasurement) => void) | null = null;
  private lastMeasurementTimestamp = 0;
  private readonly MEASUREMENT_DEDUP_MS = 1000;

  constructor(config: NativeBLEPortConfig = {}, noble?: INoble | null) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapter = new NobleBLEAdapter(
      {
        autoConnect: this.config.autoConnect,
        scanTimeout: this.config.scanTimeoutMs,
      },
      noble
    );
    this.setupAdapterEvents();
  }

  /**
   * Setup event listeners from adapter
   */
  private setupAdapterEvents(): void {
    // State change events
    this.adapter.on('ready', () => {
      console.log('[NativeBLEPort] Bluetooth ready');
    });

    this.adapter.on('unavailable', (reason: string) => {
      this.updateState('error');
      this.emitError({
        code: 'BLUETOOTH_OFF',
        message: `Bluetooth unavailable: ${reason}`,
        recoverable: true,
        suggestion: 'Włącz Bluetooth w ustawieniach systemu.',
      });
    });

    this.adapter.on('scanning', () => {
      this.updateState('scanning');
    });

    this.adapter.on('connecting', () => {
      this.updateState('connecting');
    });

    this.adapter.on('connected', (device: BLEDevice) => {
      this.currentDeviceMac = device.id;
      this.updateState('connected');
    });

    this.adapter.on('disconnected', () => {
      this.currentDeviceMac = null;
      this.updateState('disconnected');
    });

    this.adapter.on('discovered', (device: BLEDevice) => {
      const deviceInfo = mapDevice(device);
      this.deviceDiscoveredCallbacks.forEach((cb) => cb(deviceInfo));
    });

    this.adapter.on('measurement', (measurement) => {
      // Deduplicate measurements within MEASUREMENT_DEDUP_MS window
      const now = Date.now();
      if (now - this.lastMeasurementTimestamp < this.MEASUREMENT_DEDUP_MS) {
        console.log('[NativeBLEPort] Duplicate measurement ignored');
        return;
      }
      this.lastMeasurementTimestamp = now;

      const rawMeasurement: RawMeasurement = {
        weightKg: measurement.weightKg,
        impedanceOhm: measurement.impedanceOhm,
      };

      // If we're waiting for a measurement, resolve the promise
      if (this.measurementResolver) {
        this.measurementResolver(rawMeasurement);
        this.measurementResolver = null;
      } else {
        // Store for later retrieval
        this.pendingMeasurement = rawMeasurement;
      }
    });

    this.adapter.on('error', (error: Error) => {
      this.updateState('error');
      this.emitError({
        code: 'CONNECTION_TIMEOUT',
        message: error.message,
        recoverable: true,
        suggestion: 'Sprawdź czy waga jest włączona i w zasięgu.',
      });
    });
  }

  /**
   * Update state and notify callbacks
   */
  private updateState(newState: BLEConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateCallbacks.forEach((cb) => cb(newState));
    }
  }

  /**
   * Emit error to all registered callbacks
   */
  private emitError(error: BLEError): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }

  // === BLEPort Interface Implementation ===

  getState(): BLEConnectionState {
    return this.state;
  }

  onStateChange(callback: StateChangeCallback): Unsubscribe {
    this.stateCallbacks.add(callback);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  onError(callback: ErrorCallback): Unsubscribe {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  onDeviceDiscovered(callback: DeviceDiscoveredCallback): Unsubscribe {
    this.deviceDiscoveredCallbacks.add(callback);
    return () => {
      this.deviceDiscoveredCallbacks.delete(callback);
    };
  }

  async scan(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.config.scanTimeoutMs;

    try {
      await withTimeout(
        this.adapter.startScanning(),
        timeout,
        'Scan timeout: device not found'
      );

      // Wait for connection or timeout
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.adapter.stopScanning();
          reject(new Error('Scan timeout: device not found'));
        }, timeout);

        const onConnected = () => {
          clearTimeout(timeoutId);
          this.adapter.off('connected', onConnected);
          this.adapter.off('error', onError);
          resolve();
        };

        const onError = (error: Error) => {
          clearTimeout(timeoutId);
          this.adapter.off('connected', onConnected);
          this.adapter.off('error', onError);
          reject(error);
        };

        this.adapter.on('connected', onConnected);
        this.adapter.on('error', onError);
      });
    } catch (error) {
      this.updateState('error');
      const bleError: BLEError = {
        code: 'DEVICE_NOT_FOUND',
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        suggestion: 'Upewnij się, że waga jest włączona i w zasięgu Bluetooth.',
      };
      this.emitError(bleError);
      throw bleError;
    }
  }

  async scanForDevices(timeoutMs?: number): Promise<BLEDeviceInfo[]> {
    const timeout = timeoutMs ?? this.config.scanTimeoutMs;
    const discoveredDevices: BLEDeviceInfo[] = [];

    return new Promise((resolve) => {
      const onDiscovered = (device: BLEDevice) => {
        const deviceInfo = mapDevice(device);
        // Avoid duplicates
        if (!discoveredDevices.some((d) => d.mac === deviceInfo.mac)) {
          discoveredDevices.push(deviceInfo);
        }
      };

      this.adapter.on('discovered', onDiscovered);

      this.adapter.startScanning().catch((error) => {
        console.error('[NativeBLEPort] Scan error:', error);
      });

      setTimeout(() => {
        this.adapter.off('discovered', onDiscovered);
        this.adapter.stopScanning().catch(() => {});
        resolve(discoveredDevices);
      }, timeout);
    });
  }

  stopScan(): void {
    this.adapter.stopScanning().catch((error) => {
      console.error('[NativeBLEPort] Stop scan error:', error);
    });
  }

  async connect(deviceMac: string, _bleKey: string): Promise<void> {
    // Note: bleKey is not used in Noble implementation - it's for MiBeacon decryption
    // which is handled differently in Native BLE (advertisement data is raw)
    this.adapter.setDeviceMac(deviceMac);

    try {
      // Start scanning - adapter will auto-connect to the specified MAC
      await withTimeout(
        this.scan(this.config.connectTimeoutMs),
        this.config.connectTimeoutMs,
        'Connection timeout'
      );
    } catch (error) {
      this.updateState('error');
      const bleError: BLEError = {
        code: 'CONNECTION_TIMEOUT',
        message: error instanceof Error ? error.message : 'Connection failed',
        recoverable: true,
        suggestion: 'Spróbuj ponownie lub zrestartuj Bluetooth.',
      };
      this.emitError(bleError);
      throw bleError;
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    this.currentDeviceMac = null;
    this.updateState('disconnected');
  }

  async readMeasurement(): Promise<RawMeasurement> {
    // If we already have a pending measurement, return it immediately
    if (this.pendingMeasurement) {
      const measurement = this.pendingMeasurement;
      this.pendingMeasurement = null;
      return measurement;
    }

    // Wait for the next measurement with timeout
    return withTimeout(
      new Promise<RawMeasurement>((resolve) => {
        this.measurementResolver = resolve;
      }),
      this.config.readTimeoutMs,
      'Read timeout: no measurement received'
    ).catch((error) => {
      this.measurementResolver = null;
      const bleError: BLEError = {
        code: 'READ_FAILED',
        message: error instanceof Error ? error.message : 'Read failed',
        recoverable: true,
        suggestion: 'Stań na wadze i poczekaj na stabilny pomiar.',
      };
      this.emitError(bleError);
      throw bleError;
    });
  }

  async isDeviceAvailable(): Promise<boolean> {
    const devices = await this.scanForDevices(5000);
    return devices.some((d) => d.mac === this.currentDeviceMac);
  }

  /**
   * Get the underlying adapter (for advanced usage)
   */
  getAdapter(): NobleBLEAdapter {
    return this.adapter;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.adapter.disconnect();
    this.adapter.removeAllListeners();
    this.stateCallbacks.clear();
    this.errorCallbacks.clear();
    this.deviceDiscoveredCallbacks.clear();
  }
}

/**
 * Check if Native BLE is available
 * Returns true if noble module is loaded
 */
export function isNativeBLEAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nobleModule = require('@abandonware/noble');
    return !!(nobleModule.default || nobleModule);
  } catch {
    return false;
  }
}
