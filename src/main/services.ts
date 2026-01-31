/**
 * Services Container
 *
 * Dependency injection container for the main process.
 * Initializes all repositories and services with proper configuration.
 *
 * @module main/services
 */

import path from 'path';
import { app } from 'electron';
import { JsonMeasurementRepository } from '../infrastructure/storage/JsonMeasurementRepository';
import { JsonProfileRepository } from '../infrastructure/storage/JsonProfileRepository';
import { MeasurementService } from '../application/services/MeasurementService';
import { ProfileService } from '../application/services/ProfileService';
import { ReportService } from '../application/services/ReportService';
import { BackupService } from '../application/services/BackupService';
import { AppConfigStore, getAppConfigStore } from '../infrastructure/storage/AppConfigStore';
import type {
  BLEPort,
  BLEConnectionState,
  BLEError,
  BLEDeviceInfo,
  StateChangeCallback,
  ErrorCallback,
  DeviceDiscoveredCallback,
  Unsubscribe,
} from '../application/ports/BLEPort';
import type { XiaomiCloudPort } from '../application/ports/XiaomiCloudPort';
import { XiaomiCloudService } from '../infrastructure/xiaomi/XiaomiCloudService';
import type { RawMeasurement } from '../domain/calculations/types';
import { NativeBLEPort, isNativeBLEAvailable } from '../infrastructure/ble/NativeBLEPort';

/**
 * Get the data directory path for storing application data
 */
function getDataPath(): string {
  // In development, use local data directory
  // In production, use Electron's userData path
  if (process.env.NODE_ENV === 'development') {
    return path.join(process.cwd(), 'data');
  }
  return path.join(app.getPath('userData'), 'data');
}

/**
 * Mock BLE Port implementation
 *
 * This is a placeholder until the real BLE adapter is implemented.
 * It simulates the BLE interface for testing and development.
 */
class MockBLEPort implements BLEPort {
  private state: BLEConnectionState = 'disconnected';
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private deviceDiscoveredCallbacks: Set<DeviceDiscoveredCallback> = new Set();
  private scanAborted = false;

  // Mock devices for testing the UI
  private mockDevices: BLEDeviceInfo[] = [
    { mac: '1C:EA:AC:5D:A7:B0', name: 'MIBFS', rssi: -65 },
    { mac: '2C:EA:AC:5D:A7:B1', name: 'MIBFS', rssi: -78 },
  ];

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
    this.state = newState;
    this.stateCallbacks.forEach((callback) => callback(newState));
  }

  private emitError(error: BLEError): void {
    this.errorCallbacks.forEach((callback) => callback(error));
  }

  private emitDeviceDiscovered(device: BLEDeviceInfo): void {
    this.deviceDiscoveredCallbacks.forEach((callback) => callback(device));
  }

  async scan(_timeoutMs?: number): Promise<void> {
    this.setState('scanning');

    // Simulate scanning delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // In mock mode, always fail to find device
    this.setState('disconnected');
    this.emitError({
      code: 'DEVICE_NOT_FOUND',
      message: 'Mock BLE: No device found',
      recoverable: true,
      suggestion: 'This is a mock implementation. Real BLE adapter not yet configured.',
    });

    throw new Error('Mock BLE: Device not found');
  }

  async scanForDevices(timeoutMs = 10000): Promise<BLEDeviceInfo[]> {
    this.scanAborted = false;
    this.setState('scanning');
    const discoveredDevices: BLEDeviceInfo[] = [];

    console.log('[MockBLE] Starting device scan for', timeoutMs, 'ms');

    // Simulate discovering devices one by one
    for (const device of this.mockDevices) {
      if (this.scanAborted) {
        console.log('[MockBLE] Scan aborted');
        break;
      }

      // Simulate delay between discoveries
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (this.scanAborted) break;

      // Add random variation to RSSI
      const deviceWithRssi = {
        ...device,
        rssi: device.rssi + Math.floor(Math.random() * 10) - 5,
      };

      discoveredDevices.push(deviceWithRssi);
      this.emitDeviceDiscovered(deviceWithRssi);
      console.log('[MockBLE] Discovered device:', deviceWithRssi.mac);
    }

    // Wait for remaining timeout
    const remainingTime = Math.max(0, timeoutMs - this.mockDevices.length * 1000);
    if (remainingTime > 0 && !this.scanAborted) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(remainingTime, 2000)));
    }

    this.setState('disconnected');
    console.log('[MockBLE] Scan complete, found', discoveredDevices.length, 'devices');

    return discoveredDevices;
  }

  stopScan(): void {
    console.log('[MockBLE] Stopping scan');
    this.scanAborted = true;
    if (this.state === 'scanning') {
      this.setState('disconnected');
    }
  }

  async connect(_deviceMac: string, _bleKey: string): Promise<void> {
    this.setState('connecting');

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.setState('disconnected');
  }

  async readMeasurement(): Promise<RawMeasurement> {
    if (this.state !== 'connected') {
      throw new Error('Not connected to device');
    }

    this.setState('reading');

    // Simulate reading delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    this.setState('connected');

    // Return mock measurement data
    return {
      weightKg: 70.5 + Math.random() * 2 - 1, // 69.5-71.5 kg
      impedanceOhm: 450 + Math.floor(Math.random() * 50), // 450-500 ohm
      heartRateBpm: 65 + Math.floor(Math.random() * 10), // 65-75 bpm
    };
  }

  async isDeviceAvailable(): Promise<boolean> {
    // Mock always returns false
    return false;
  }
}

// Singleton instances
let measurementRepository: JsonMeasurementRepository | null = null;
let profileRepository: JsonProfileRepository | null = null;
let blePort: BLEPort | null = null;
let xiaomiCloudService: XiaomiCloudPort | null = null;
let measurementService: MeasurementService | null = null;
let profileService: ProfileService | null = null;
let reportService: ReportService | null = null;
let backupService: BackupService | null = null;
let appConfigStore: AppConfigStore | null = null;

/**
 * Initialize all services
 * Must be called after app is ready
 */
export function initializeServices(): void {
  const dataPath = getDataPath();

  // Initialize repositories
  measurementRepository = new JsonMeasurementRepository(
    path.join(dataPath, 'measurements')
  );
  profileRepository = new JsonProfileRepository(path.join(dataPath, 'profiles'));

  // Initialize BLE port - use Native BLE if available, otherwise fall back to Mock
  if (isNativeBLEAvailable()) {
    console.log('[Services] Using Native BLE adapter (@abandonware/noble)');
    blePort = new NativeBLEPort({
      scanTimeoutMs: 30000,
      connectTimeoutMs: 10000,
      readTimeoutMs: 15000,
      autoConnect: false,
    });
  } else {
    console.log('[Services] Native BLE not available, using Mock BLE adapter');
    blePort = new MockBLEPort();
  }

  // Initialize Xiaomi cloud service
  xiaomiCloudService = new XiaomiCloudService();

  // Initialize services
  measurementService = new MeasurementService(
    blePort,
    measurementRepository,
    profileRepository
  );
  profileService = new ProfileService(profileRepository);
  reportService = new ReportService(measurementRepository, profileRepository);

  // Initialize config store (electron-store based)
  appConfigStore = getAppConfigStore();

  // Initialize backup service
  backupService = new BackupService(
    profileRepository,
    measurementRepository,
    appConfigStore
  );

  console.log('[Services] Initialized with data path:', dataPath);
}

/**
 * Get the measurement repository instance
 */
export function getMeasurementRepository(): JsonMeasurementRepository {
  if (!measurementRepository) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return measurementRepository;
}

/**
 * Get the profile repository instance
 */
export function getProfileRepository(): JsonProfileRepository {
  if (!profileRepository) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return profileRepository;
}

/**
 * Get the BLE port instance
 */
export function getBLEPort(): BLEPort {
  if (!blePort) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return blePort;
}

/**
 * Get the Xiaomi cloud service instance
 */
export function getXiaomiCloudService(): XiaomiCloudPort {
  if (!xiaomiCloudService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return xiaomiCloudService;
}

/**
 * Get the measurement service instance
 */
export function getMeasurementService(): MeasurementService {
  if (!measurementService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return measurementService;
}

/**
 * Get the profile service instance
 */
export function getProfileService(): ProfileService {
  if (!profileService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return profileService;
}

/**
 * Get the report service instance
 */
export function getReportService(): ReportService {
  if (!reportService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return reportService;
}

/**
 * Get the backup service instance
 */
export function getBackupService(): BackupService {
  if (!backupService) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return backupService;
}

/**
 * Get the app config store instance
 */
export function getAppConfigStoreInstance(): AppConfigStore {
  if (!appConfigStore) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return appConfigStore;
}

/**
 * Check if services are initialized
 */
export function areServicesInitialized(): boolean {
  return (
    measurementRepository !== null &&
    profileRepository !== null &&
    blePort !== null &&
    xiaomiCloudService !== null &&
    measurementService !== null &&
    profileService !== null &&
    reportService !== null &&
    backupService !== null &&
    appConfigStore !== null
  );
}
