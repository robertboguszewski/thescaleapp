/**
 * Dependency Injection Container
 *
 * Centralized DI container using tsyringe for managing dependencies.
 * Provides type-safe tokens and initialization for all application services.
 *
 * Benefits:
 * - Centralized dependency management
 * - Easy mocking for tests
 * - Lazy initialization
 * - Singleton instances by default
 *
 * @module main/container
 */

import 'reflect-metadata';
import { container as tsyringeContainer, InjectionToken } from 'tsyringe';
import path from 'path';

// Import types for tokens
import type { MeasurementRepository } from '../application/ports/MeasurementRepository';
import type { ProfileRepository } from '../application/ports/ProfileRepository';
import type { BLEPort } from '../application/ports/BLEPort';
import type { XiaomiCloudPort } from '../application/ports/XiaomiCloudPort';
import type { MeasurementService } from '../application/services/MeasurementService';
import type { ProfileService } from '../application/services/ProfileService';
import type { ReportService } from '../application/services/ReportService';
import type { BackupService } from '../application/services/BackupService';
import type { AppConfigStore } from '../infrastructure/storage/AppConfigStore';

// Import implementations
import { JsonMeasurementRepository } from '../infrastructure/storage/JsonMeasurementRepository';
import { JsonProfileRepository } from '../infrastructure/storage/JsonProfileRepository';
import { XiaomiCloudService } from '../infrastructure/xiaomi/XiaomiCloudService';
import { getAppConfigStore } from '../infrastructure/storage/AppConfigStore';
import {
  MeasurementService as MeasurementServiceImpl,
} from '../application/services/MeasurementService';
import {
  ProfileService as ProfileServiceImpl,
} from '../application/services/ProfileService';
import {
  ReportService as ReportServiceImpl,
} from '../application/services/ReportService';
import {
  BackupService as BackupServiceImpl,
} from '../application/services/BackupService';

/**
 * Injection tokens for all dependencies.
 * Use these tokens to resolve dependencies from the container.
 */
export const TOKENS = {
  // Repositories
  MeasurementRepository: Symbol.for('MeasurementRepository') as InjectionToken<MeasurementRepository>,
  ProfileRepository: Symbol.for('ProfileRepository') as InjectionToken<ProfileRepository>,

  // Ports (external services)
  BLEPort: Symbol.for('BLEPort') as InjectionToken<BLEPort>,
  XiaomiCloudPort: Symbol.for('XiaomiCloudPort') as InjectionToken<XiaomiCloudPort>,

  // Application Services
  MeasurementService: Symbol.for('MeasurementService') as InjectionToken<MeasurementService>,
  ProfileService: Symbol.for('ProfileService') as InjectionToken<ProfileService>,
  ReportService: Symbol.for('ReportService') as InjectionToken<ReportService>,
  BackupService: Symbol.for('BackupService') as InjectionToken<BackupService>,

  // Infrastructure
  AppConfigStore: Symbol.for('AppConfigStore') as InjectionToken<AppConfigStore>,
} as const;

/**
 * Container configuration options.
 */
export interface ContainerConfig {
  /** Path to data directory for repositories */
  dataPath: string;
  /** Use mock BLE implementation instead of real one */
  useMockBLE?: boolean;
}

/**
 * Flag to track initialization state
 */
let isInitialized = false;

/**
 * Initialize the DI container with all dependencies.
 *
 * @param config - Container configuration
 */
export function initializeContainer(config: ContainerConfig): void {
  const { dataPath, useMockBLE = false } = config;

  // Clear previous registrations
  clearContainer();

  // ====== Register Repositories ======

  const measurementRepository = new JsonMeasurementRepository(
    path.join(dataPath, 'measurements')
  );
  tsyringeContainer.register(TOKENS.MeasurementRepository, {
    useValue: measurementRepository,
  });

  const profileRepository = new JsonProfileRepository(
    path.join(dataPath, 'profiles')
  );
  tsyringeContainer.register(TOKENS.ProfileRepository, {
    useValue: profileRepository,
  });

  // ====== Register Ports ======

  // BLE Port - conditionally use mock or real implementation
  let blePort: BLEPort;
  if (useMockBLE) {
    // Use inline mock for now
    blePort = createMockBLEPort();
  } else {
    // Try to use native BLE, fall back to mock
    try {
      const { isNativeBLEAvailable, NativeBLEPort } = require('../infrastructure/ble/NativeBLEPort');
      if (isNativeBLEAvailable()) {
        blePort = new NativeBLEPort({
          scanTimeoutMs: 30000,
          connectTimeoutMs: 10000,
          readTimeoutMs: 15000,
          autoConnect: false,
        });
      } else {
        blePort = createMockBLEPort();
      }
    } catch {
      blePort = createMockBLEPort();
    }
  }
  tsyringeContainer.register(TOKENS.BLEPort, { useValue: blePort });

  // Xiaomi Cloud Port
  const xiaomiCloudService = new XiaomiCloudService();
  tsyringeContainer.register(TOKENS.XiaomiCloudPort, {
    useValue: xiaomiCloudService,
  });

  // ====== Register Infrastructure ======

  const appConfigStore = getAppConfigStore();
  tsyringeContainer.register(TOKENS.AppConfigStore, {
    useValue: appConfigStore,
  });

  // ====== Register Application Services ======

  // MeasurementService
  const measurementService = new MeasurementServiceImpl(
    blePort,
    measurementRepository,
    profileRepository
  );
  tsyringeContainer.register(TOKENS.MeasurementService, {
    useValue: measurementService,
  });

  // ProfileService
  const profileService = new ProfileServiceImpl(profileRepository);
  tsyringeContainer.register(TOKENS.ProfileService, {
    useValue: profileService,
  });

  // ReportService
  const reportService = new ReportServiceImpl(
    measurementRepository,
    profileRepository
  );
  tsyringeContainer.register(TOKENS.ReportService, {
    useValue: reportService,
  });

  // BackupService
  const backupService = new BackupServiceImpl(
    profileRepository,
    measurementRepository,
    appConfigStore
  );
  tsyringeContainer.register(TOKENS.BackupService, {
    useValue: backupService,
  });

  isInitialized = true;
  console.log('[DI Container] Initialized with data path:', dataPath);
}

/**
 * Clear all container registrations.
 * Useful for testing to reset state between tests.
 */
export function clearContainer(): void {
  tsyringeContainer.clearInstances();
  // Reset registrations by clearing the container
  tsyringeContainer.reset();
  isInitialized = false;
}

/**
 * Check if container is initialized.
 */
export function isContainerInitialized(): boolean {
  return isInitialized;
}

/**
 * Get a dependency from the container.
 *
 * @param token - Injection token
 * @returns Resolved dependency
 * @throws Error if container not initialized or dependency not found
 */
export function resolve<T>(token: InjectionToken<T>): T {
  if (!isInitialized) {
    throw new Error('DI Container not initialized. Call initializeContainer() first.');
  }
  return tsyringeContainer.resolve(token);
}

/**
 * Export the container for advanced use cases.
 */
export { tsyringeContainer as container };

// ====== Mock BLE Port for Development/Testing ======

import type {
  BLEConnectionState,
  BLEError,
  BLEDeviceInfo,
  StateChangeCallback,
  ErrorCallback,
  DeviceDiscoveredCallback,
  Unsubscribe,
} from '../application/ports/BLEPort';
import type { RawMeasurement } from '../domain/calculations/types';

/**
 * Create a mock BLE port for testing/development.
 */
function createMockBLEPort(): BLEPort {
  let state: BLEConnectionState = 'disconnected';
  const stateCallbacks = new Set<StateChangeCallback>();
  const errorCallbacks = new Set<ErrorCallback>();
  const deviceDiscoveredCallbacks = new Set<DeviceDiscoveredCallback>();

  const mockDevices: BLEDeviceInfo[] = [
    { mac: '1C:EA:AC:5D:A7:B0', name: 'MIBFS', rssi: -65 },
    { mac: '2C:EA:AC:5D:A7:B1', name: 'MIBFS', rssi: -78 },
  ];

  const setState = (newState: BLEConnectionState): void => {
    state = newState;
    stateCallbacks.forEach((cb) => cb(newState));
  };

  const emitError = (error: BLEError): void => {
    errorCallbacks.forEach((cb) => cb(error));
  };

  const emitDeviceDiscovered = (device: BLEDeviceInfo): void => {
    deviceDiscoveredCallbacks.forEach((cb) => cb(device));
  };

  return {
    getState: () => state,

    onStateChange: (callback: StateChangeCallback): Unsubscribe => {
      stateCallbacks.add(callback);
      return () => stateCallbacks.delete(callback);
    },

    onError: (callback: ErrorCallback): Unsubscribe => {
      errorCallbacks.add(callback);
      return () => errorCallbacks.delete(callback);
    },

    onDeviceDiscovered: (callback: DeviceDiscoveredCallback): Unsubscribe => {
      deviceDiscoveredCallbacks.add(callback);
      return () => deviceDiscoveredCallbacks.delete(callback);
    },

    scan: async (): Promise<void> => {
      setState('scanning');
      await new Promise((r) => setTimeout(r, 2000));
      setState('disconnected');
      emitError({
        code: 'DEVICE_NOT_FOUND',
        message: 'Mock BLE: No device found',
        recoverable: true,
        suggestion: 'This is a mock implementation.',
      });
      throw new Error('Mock BLE: Device not found');
    },

    scanForDevices: async (timeoutMs = 10000): Promise<BLEDeviceInfo[]> => {
      setState('scanning');
      const discovered: BLEDeviceInfo[] = [];

      for (const device of mockDevices) {
        await new Promise((r) => setTimeout(r, 1000));
        const d = { ...device, rssi: device.rssi + Math.floor(Math.random() * 10) - 5 };
        discovered.push(d);
        emitDeviceDiscovered(d);
      }

      await new Promise((r) => setTimeout(r, Math.min(timeoutMs - 2000, 1000)));
      setState('disconnected');
      return discovered;
    },

    stopScan: (): void => {
      if (state === 'scanning') {
        setState('disconnected');
      }
    },

    connect: async (_mac: string, _key: string): Promise<void> => {
      setState('connecting');
      await new Promise((r) => setTimeout(r, 1000));
      setState('connected');
    },

    disconnect: async (): Promise<void> => {
      setState('disconnected');
    },

    readMeasurement: async (): Promise<RawMeasurement> => {
      if (state !== 'connected') {
        throw new Error('Not connected');
      }
      setState('reading');
      await new Promise((r) => setTimeout(r, 1500));
      setState('connected');
      return {
        weightKg: 70.5 + Math.random() * 2 - 1,
        impedanceOhm: 450 + Math.floor(Math.random() * 50),
        heartRateBpm: 65 + Math.floor(Math.random() * 10),
      };
    },

    isDeviceAvailable: async (): Promise<boolean> => false,
  };
}
