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
// Native BLE disabled - using Web Bluetooth API in renderer process
// import { NativeBLEPort, isNativeBLEAvailable } from '../infrastructure/ble/NativeBLEPort';

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
 * Stub BLE Port implementation
 *
 * Returns empty results when Native BLE is not available.
 * The real scanning happens via Web Bluetooth API in the renderer process.
 */
class StubBLEPort implements BLEPort {
  private state: BLEConnectionState = 'disconnected';
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private deviceDiscoveredCallbacks: Set<DeviceDiscoveredCallback> = new Set();

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

  async scan(_timeoutMs?: number): Promise<void> {
    console.log('[StubBLE] Scan requested - use Web Bluetooth API in renderer process');
    throw new Error('Native BLE not available. Use Web Bluetooth API in renderer process.');
  }

  async scanForDevices(_timeoutMs = 10000): Promise<BLEDeviceInfo[]> {
    console.log('[StubBLE] scanForDevices - returning empty (use Web Bluetooth API)');
    return [];
  }

  stopScan(): void {
    console.log('[StubBLE] Stop scan - no-op');
  }

  async connect(_deviceMac: string, _bleKey: string): Promise<void> {
    throw new Error('Native BLE not available. Use Web Bluetooth API in renderer process.');
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  async readMeasurement(): Promise<RawMeasurement> {
    throw new Error('Native BLE not available. Use Web Bluetooth API in renderer process.');
  }

  async isDeviceAvailable(): Promise<boolean> {
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

  // Initialize BLE port - using Stub since BLE operations happen via Web Bluetooth API
  // Noble requires native compilation which has issues on macOS
  console.log('[Services] Using Stub BLE port - scanning via Web Bluetooth API in renderer');
  blePort = new StubBLEPort();

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
