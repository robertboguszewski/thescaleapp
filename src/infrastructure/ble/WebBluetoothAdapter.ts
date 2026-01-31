/**
 * Web Bluetooth BLE Adapter
 *
 * Implements BLEPort interface using Web Bluetooth API.
 * Works in Electron renderer process with experimentalFeatures enabled.
 *
 * This adapter handles:
 * - Device discovery via Web Bluetooth requestDevice
 * - GATT connection to Mi Scale
 * - Reading weight and body composition data
 * - Parsing and decrypting MiBeacon data
 *
 * @module infrastructure/ble/WebBluetoothAdapter
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
import {
  parseMiBeaconAdvertisement,
  parseAdvertisementData,
  XIAOMI_SERVICE_UUID,
} from './S400Parser';
import { decryptMiBeaconData } from './Decryptor';

/**
 * Standard BLE Service UUIDs for body composition scales
 */
const SERVICE_UUIDS = {
  /** Xiaomi MiBeacon service */
  XIAOMI: 0xfe95,
  /** Standard Body Composition Service */
  BODY_COMPOSITION: 0x181b,
  /** Standard Weight Scale Service */
  WEIGHT_SCALE: 0x181d,
  /** Generic Access */
  GENERIC_ACCESS: 0x1800,
  /** Device Information */
  DEVICE_INFO: 0x180a,
} as const;

/**
 * Standard BLE Characteristic UUIDs
 */
const CHARACTERISTIC_UUIDS = {
  /** Body Composition Measurement */
  BODY_COMPOSITION_MEASUREMENT: 0x2a9c,
  /** Body Composition Feature */
  BODY_COMPOSITION_FEATURE: 0x2a9b,
  /** Weight Measurement */
  WEIGHT_MEASUREMENT: 0x2a9d,
  /** Weight Scale Feature */
  WEIGHT_SCALE_FEATURE: 0x2a9e,
} as const;

/**
 * Parse weight from standard BLE Weight Measurement characteristic
 * @param data - DataView of the characteristic value
 * @returns Weight in kg
 */
function parseWeightMeasurement(data: DataView): number {
  // Flags byte
  const flags = data.getUint8(0);
  const isImperial = (flags & 0x01) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;
  const hasUserId = (flags & 0x04) !== 0;
  const hasBmiHeight = (flags & 0x08) !== 0;

  // Weight is at offset 1, 2 bytes, little-endian
  // Unit is 0.005 kg (metric) or 0.01 lb (imperial)
  let offset = 1;
  const weightRaw = data.getUint16(offset, true);
  offset += 2;

  let weightKg: number;
  if (isImperial) {
    // Convert from 0.01 lb to kg
    weightKg = (weightRaw * 0.01) * 0.453592;
  } else {
    // Metric: 0.005 kg resolution
    weightKg = weightRaw * 0.005;
  }

  console.log('[WebBLE] Weight measurement parsed:', {
    flags,
    isImperial,
    weightRaw,
    weightKg,
    hasTimestamp,
    hasUserId,
    hasBmiHeight,
  });

  return weightKg;
}

/**
 * Parse body composition from standard BLE Body Composition Measurement characteristic
 * @param data - DataView of the characteristic value
 * @returns Partial measurement data
 */
function parseBodyCompositionMeasurement(data: DataView): Partial<RawMeasurement> {
  const result: Partial<RawMeasurement> = {};

  // Flags (2 bytes)
  const flags = data.getUint16(0, true);
  const isImperial = (flags & 0x0001) !== 0;
  const hasTimestamp = (flags & 0x0002) !== 0;
  const hasUserId = (flags & 0x0004) !== 0;
  const hasBmiHeight = (flags & 0x0008) !== 0;
  const hasMusclePercentage = (flags & 0x0010) !== 0;
  const hasMuscleMass = (flags & 0x0020) !== 0;
  const hasFatFreeMass = (flags & 0x0040) !== 0;
  const hasSoftLeanMass = (flags & 0x0080) !== 0;
  const hasBodyWater = (flags & 0x0100) !== 0;
  const hasImpedance = (flags & 0x0200) !== 0;
  const hasWeight = (flags & 0x0400) !== 0;
  const hasHeight = (flags & 0x0800) !== 0;
  const hasMultiplePacket = (flags & 0x1000) !== 0;

  let offset = 2; // Start after flags

  // Body Fat Percentage (mandatory field after flags)
  const bodyFatRaw = data.getUint16(offset, true);
  offset += 2;
  // Body fat is in 0.1% resolution
  const bodyFatPercent = bodyFatRaw * 0.1;

  // Timestamp (optional)
  if (hasTimestamp) {
    offset += 7; // Skip timestamp
  }

  // User ID (optional)
  if (hasUserId) {
    offset += 1;
  }

  // BMI and Height (optional)
  if (hasBmiHeight) {
    const bmi = data.getUint16(offset, true) * 0.1;
    offset += 2;
    const height = data.getUint16(offset, true);
    offset += 2;
    console.log('[WebBLE] BMI:', bmi, 'Height:', height);
  }

  // Weight (optional but usually present)
  if (hasWeight) {
    const weightRaw = data.getUint16(offset, true);
    offset += 2;
    if (isImperial) {
      result.weightKg = (weightRaw * 0.01) * 0.453592;
    } else {
      result.weightKg = weightRaw * 0.005;
    }
  }

  // Height (optional)
  if (hasHeight) {
    offset += 2;
  }

  // Muscle Percentage (optional)
  if (hasMusclePercentage) {
    offset += 2;
  }

  // Muscle Mass (optional)
  if (hasMuscleMass) {
    offset += 2;
  }

  // Fat Free Mass (optional)
  if (hasFatFreeMass) {
    offset += 2;
  }

  // Soft Lean Mass (optional)
  if (hasSoftLeanMass) {
    offset += 2;
  }

  // Body Water Mass (optional)
  if (hasBodyWater) {
    offset += 2;
  }

  // Impedance (optional but important for body composition)
  if (hasImpedance) {
    const impedanceRaw = data.getUint16(offset, true);
    result.impedanceOhm = impedanceRaw * 0.1;
  }

  console.log('[WebBLE] Body composition measurement parsed:', {
    flags: flags.toString(16),
    bodyFatPercent,
    ...result,
  });

  return result;
}

/**
 * Web Bluetooth BLE Adapter
 * Implements BLEPort using Web Bluetooth API
 */
export class WebBluetoothAdapter implements BLEPort {
  private state: BLEConnectionState = 'disconnected';
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private deviceDiscoveredCallbacks: Set<DeviceDiscoveredCallback> = new Set();
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private bleKey: string = '';
  private deviceMac: string = '';
  private abortController: AbortController | null = null;

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

  private setState(newState: BLEConnectionState): void {
    console.log('[WebBLE] State change:', this.state, '->', newState);
    this.state = newState;
    this.stateCallbacks.forEach((callback) => callback(newState));
  }

  private emitError(error: BLEError): void {
    console.error('[WebBLE] Error:', error);
    this.errorCallbacks.forEach((callback) => callback(error));
  }

  private emitDeviceDiscovered(device: BLEDeviceInfo): void {
    console.log('[WebBLE] Device discovered:', device);
    this.deviceDiscoveredCallbacks.forEach((callback) => callback(device));
  }

  /**
   * Check if Web Bluetooth is available
   */
  private isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async scan(timeoutMs = 30000): Promise<void> {
    if (!this.isWebBluetoothAvailable()) {
      this.emitError({
        code: 'BLUETOOTH_OFF',
        message: 'Web Bluetooth is not available in this environment',
        recoverable: false,
        suggestion: 'Ensure you are running in Electron with experimental features enabled',
      });
      throw new Error('Web Bluetooth not available');
    }

    this.setState('scanning');

    try {
      // Request device using Web Bluetooth
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'MIBFS' }, // Mi Body Fat Scale
          { namePrefix: 'MIBCS' }, // Mi Body Composition Scale
          { namePrefix: 'MI' }, // Other Mi devices
        ],
        optionalServices: [
          SERVICE_UUIDS.BODY_COMPOSITION,
          SERVICE_UUIDS.WEIGHT_SCALE,
          SERVICE_UUIDS.GENERIC_ACCESS,
          SERVICE_UUIDS.DEVICE_INFO,
          XIAOMI_SERVICE_UUID,
        ],
      });

      console.log('[WebBLE] Device selected:', this.device.name, this.device.id);

      // Emit device discovered
      this.emitDeviceDiscovered({
        mac: this.device.id || 'unknown',
        name: this.device.name || 'Mi Scale',
        rssi: -50, // Web Bluetooth doesn't provide RSSI during device selection
      });

      this.setState('disconnected');
    } catch (error) {
      this.setState('disconnected');

      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          this.emitError({
            code: 'DEVICE_NOT_FOUND',
            message: 'No Mi Scale device found or user cancelled',
            recoverable: true,
            suggestion: 'Make sure your Mi Scale is powered on and in range',
          });
        } else {
          this.emitError({
            code: 'DEVICE_NOT_FOUND',
            message: error.message,
            recoverable: true,
            suggestion: 'Try scanning again',
          });
        }
      }

      throw error;
    }
  }

  async scanForDevices(timeoutMs = 10000): Promise<BLEDeviceInfo[]> {
    if (!this.isWebBluetoothAvailable()) {
      return [];
    }

    this.setState('scanning');
    const discoveredDevices: BLEDeviceInfo[] = [];

    try {
      // Web Bluetooth doesn't support background scanning like native BLE
      // We can only use requestDevice which prompts the user
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'MIBFS' },
          { namePrefix: 'MIBCS' },
          { namePrefix: 'MI' },
        ],
        optionalServices: [
          SERVICE_UUIDS.BODY_COMPOSITION,
          SERVICE_UUIDS.WEIGHT_SCALE,
          XIAOMI_SERVICE_UUID,
        ],
      });

      if (this.device) {
        const deviceInfo: BLEDeviceInfo = {
          mac: this.device.id || 'unknown',
          name: this.device.name || 'Mi Scale',
          rssi: -50,
        };
        discoveredDevices.push(deviceInfo);
        this.emitDeviceDiscovered(deviceInfo);
      }

      this.setState('disconnected');
    } catch (error) {
      this.setState('disconnected');
      console.log('[WebBLE] Scan error or cancelled:', error);
    }

    return discoveredDevices;
  }

  stopScan(): void {
    console.log('[WebBLE] Stop scan requested');
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.state === 'scanning') {
      this.setState('disconnected');
    }
  }

  async connect(deviceMac: string, bleKey: string): Promise<void> {
    this.deviceMac = deviceMac;
    this.bleKey = bleKey;

    console.log('[WebBLE] Connecting to device:', deviceMac);

    if (!this.device) {
      // Need to request device first if not already selected
      await this.scan();
    }

    if (!this.device) {
      throw new Error('No device selected');
    }

    this.setState('connecting');

    try {
      // Connect to GATT server
      this.server = await this.device.gatt?.connect();

      if (!this.server) {
        throw new Error('Failed to connect to GATT server');
      }

      console.log('[WebBLE] Connected to GATT server');

      // Handle disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        console.log('[WebBLE] Device disconnected');
        this.server = null;
        this.setState('disconnected');
      });

      this.setState('connected');
    } catch (error) {
      this.setState('error');
      this.emitError({
        code: 'CONNECTION_TIMEOUT',
        message: error instanceof Error ? error.message : 'Connection failed',
        recoverable: true,
        suggestion: 'Make sure the scale is powered on and try again',
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = null;
    this.device = null;
    this.setState('disconnected');
  }

  async readMeasurement(): Promise<RawMeasurement> {
    if (!this.server?.connected) {
      throw new Error('Not connected to device');
    }

    this.setState('reading');
    console.log('[WebBLE] Reading measurement...');

    try {
      // Try to read from Body Composition Service first
      const measurement = await this.readFromBodyCompositionService();
      if (measurement.weightKg) {
        this.setState('connected');
        return measurement as RawMeasurement;
      }

      // Fallback to Weight Scale Service
      const weightMeasurement = await this.readFromWeightScaleService();
      if (weightMeasurement.weightKg) {
        this.setState('connected');
        return weightMeasurement as RawMeasurement;
      }

      // If still no data, try Xiaomi service (encrypted)
      const xiaomiMeasurement = await this.readFromXiaomiService();
      this.setState('connected');
      return xiaomiMeasurement;
    } catch (error) {
      this.setState('error');
      this.emitError({
        code: 'READ_FAILED',
        message: error instanceof Error ? error.message : 'Read failed',
        recoverable: true,
        suggestion: 'Step on the scale and try again',
      });
      throw error;
    }
  }

  /**
   * Try to read from standard Body Composition Service
   */
  private async readFromBodyCompositionService(): Promise<Partial<RawMeasurement>> {
    if (!this.server) return {};

    try {
      const service = await this.server.getPrimaryService(SERVICE_UUIDS.BODY_COMPOSITION);
      console.log('[WebBLE] Got Body Composition Service');

      const characteristic = await service.getCharacteristic(
        CHARACTERISTIC_UUIDS.BODY_COMPOSITION_MEASUREMENT
      );
      console.log('[WebBLE] Got Body Composition Measurement characteristic');

      // Try to read or subscribe to notifications
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for measurement'));
        }, 30000);

        characteristic.startNotifications().then(() => {
          characteristic.addEventListener('characteristicvaluechanged', (event) => {
            clearTimeout(timeout);
            const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
            if (value) {
              const measurement = parseBodyCompositionMeasurement(value);
              resolve(measurement);
            }
          });
        }).catch((err) => {
          clearTimeout(timeout);
          console.log('[WebBLE] Failed to start notifications:', err);
          resolve({});
        });
      });
    } catch (error) {
      console.log('[WebBLE] Body Composition Service not available:', error);
      return {};
    }
  }

  /**
   * Try to read from standard Weight Scale Service
   */
  private async readFromWeightScaleService(): Promise<Partial<RawMeasurement>> {
    if (!this.server) return {};

    try {
      const service = await this.server.getPrimaryService(SERVICE_UUIDS.WEIGHT_SCALE);
      console.log('[WebBLE] Got Weight Scale Service');

      const characteristic = await service.getCharacteristic(
        CHARACTERISTIC_UUIDS.WEIGHT_MEASUREMENT
      );
      console.log('[WebBLE] Got Weight Measurement characteristic');

      // Try to read or subscribe to notifications
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for weight measurement'));
        }, 30000);

        characteristic.startNotifications().then(() => {
          characteristic.addEventListener('characteristicvaluechanged', (event) => {
            clearTimeout(timeout);
            const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
            if (value) {
              const weightKg = parseWeightMeasurement(value);
              resolve({ weightKg });
            }
          });
        }).catch((err) => {
          clearTimeout(timeout);
          console.log('[WebBLE] Failed to start weight notifications:', err);
          resolve({});
        });
      });
    } catch (error) {
      console.log('[WebBLE] Weight Scale Service not available:', error);
      return {};
    }
  }

  /**
   * Try to read from Xiaomi service (encrypted data)
   */
  private async readFromXiaomiService(): Promise<RawMeasurement> {
    if (!this.server) {
      throw new Error('Not connected');
    }

    try {
      const service = await this.server.getPrimaryService(XIAOMI_SERVICE_UUID);
      console.log('[WebBLE] Got Xiaomi Service');

      const characteristics = await service.getCharacteristics();
      console.log('[WebBLE] Xiaomi characteristics:', characteristics.map(c => c.uuid));

      // Try to read from each characteristic
      for (const characteristic of characteristics) {
        try {
          if (characteristic.properties.notify) {
            return new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Xiaomi data'));
              }, 30000);

              characteristic.startNotifications().then(() => {
                characteristic.addEventListener('characteristicvaluechanged', (event) => {
                  clearTimeout(timeout);
                  const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
                  if (value) {
                    const buffer = Buffer.from(value.buffer);
                    console.log('[WebBLE] Xiaomi data received:', buffer.toString('hex'));

                    // Parse MiBeacon advertisement
                    const adv = parseMiBeaconAdvertisement(buffer);
                    if (adv && adv.encryptedPayload && this.bleKey) {
                      try {
                        const decrypted = decryptMiBeaconData(
                          adv.encryptedPayload,
                          this.bleKey,
                          adv.frameCounter,
                          this.deviceMac,
                          adv.productId
                        );
                        const measurement = parseAdvertisementData(decrypted);
                        if (measurement.weightKg) {
                          resolve(measurement as RawMeasurement);
                        }
                      } catch (decryptError) {
                        console.error('[WebBLE] Decryption failed:', decryptError);
                      }
                    }
                  }
                });
              });
            });
          }
        } catch (charError) {
          console.log('[WebBLE] Characteristic error:', charError);
        }
      }

      throw new Error('No measurement data available from Xiaomi service');
    } catch (error) {
      console.log('[WebBLE] Xiaomi Service error:', error);
      throw error;
    }
  }

  async isDeviceAvailable(): Promise<boolean> {
    return this.device !== null;
  }
}

export default WebBluetoothAdapter;
