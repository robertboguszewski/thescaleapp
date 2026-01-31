/**
 * IPC Handlers
 *
 * Registers all IPC handlers for communication between main and renderer processes.
 * Each handler validates input, calls the appropriate service, and returns a standardized response.
 *
 * @module main/ipc-handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  getMeasurementService,
  getProfileService,
  getReportService,
  getBLEPort,
  getMeasurementRepository,
  getXiaomiCloudService,
  getBackupService,
  getAppConfigStoreInstance,
} from './services';
import { NobleBLEAdapter } from './ble/NobleBLEAdapter';
import type {
  IpcResponse,
  IpcError,
  MeasurementQuery,
  MeasurementResult,
  StoredUserProfile,
  CreateProfileInput,
  UpdateProfileInput,
  HealthReport,
  BLEConnectionState,
  BLEDeviceInfo,
  QRLoginSession,
  QRLoginPollResult,
  XiaomiCloudDevice,
  BLEKeyResult,
  XiaomiAuthState,
  XiaomiRegion,
  BackupData,
  BackupInfo,
  BackupValidationResult,
  RestoreOptions,
  StoredBLEConfig,
  AppSettings,
  ConfigExport,
} from '../shared/types';
import { IpcChannels } from '../shared/types';
import {
  isDomainError,
  getErrorCode,
  serializeDomainError,
} from '../domain/errors';

/**
 * Create a successful IPC response
 */
function successResponse<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

/**
 * Create an error IPC response
 */
function errorResponse(code: string, message: string, details?: unknown): IpcResponse<never> {
  const error: IpcError = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return { success: false, error };
}

/**
 * Map errors to IPC error codes using centralized domain errors.
 */
function mapErrorToCode(error: unknown): string {
  return getErrorCode(error);
}

/**
 * Get error details for IPC response.
 */
function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (isDomainError(error)) {
    const serialized = serializeDomainError(error);
    return serialized.details;
  }
  return undefined;
}

/**
 * Wrap an async handler with error handling
 */
function wrapHandler<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<IpcResponse<TResult>> {
  return async (...args: TArgs): Promise<IpcResponse<TResult>> => {
    try {
      const result = await handler(...args);
      return successResponse(result);
    } catch (error) {
      const code = mapErrorToCode(error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      const details = getErrorDetails(error);
      console.error(`[IPC Error] ${code}:`, message, error);
      return errorResponse(code, message, details);
    }
  };
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  console.log('[IPC] Registering handlers...');

  // ====== Measurement Handlers ======

  ipcMain.handle(
    IpcChannels.MEASUREMENT_CAPTURE,
    wrapHandler(async (_event, profileId: string): Promise<MeasurementResult> => {
      const measurementService = getMeasurementService();
      const result = await measurementService.captureMeasurement(profileId);
      // Convert Date to serializable format for IPC
      return {
        ...result,
        timestamp: result.timestamp,
      };
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_GET_ALL,
    wrapHandler(async (_event, query: MeasurementQuery): Promise<MeasurementResult[]> => {
      const measurementService = getMeasurementService();
      // Convert date strings to Date objects if needed
      const normalizedQuery: MeasurementQuery = {
        ...query,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
      };
      return measurementService.getMeasurementHistory(normalizedQuery);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_GET_BY_ID,
    wrapHandler(async (_event, id: string): Promise<MeasurementResult | null> => {
      const measurementService = getMeasurementService();
      return measurementService.getMeasurement(id);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_DELETE,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const measurementService = getMeasurementService();
      return measurementService.deleteMeasurement(id);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_DELETE_ALL,
    wrapHandler(async (_event, profileId: string): Promise<void> => {
      const measurementService = getMeasurementService();
      return measurementService.deleteAllMeasurements(profileId);
    })
  );

  ipcMain.handle(
    IpcChannels.MEASUREMENT_COUNT,
    wrapHandler(async (_event, profileId: string): Promise<number> => {
      const measurementRepository = getMeasurementRepository();
      return measurementRepository.count({ userProfileId: profileId });
    })
  );

  // ====== Profile Handlers ======

  ipcMain.handle(
    IpcChannels.PROFILE_CREATE,
    wrapHandler(async (_event, data: CreateProfileInput): Promise<StoredUserProfile> => {
      const profileService = getProfileService();
      return profileService.createProfile(data);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_UPDATE,
    wrapHandler(async (_event, id: string, data: UpdateProfileInput): Promise<StoredUserProfile> => {
      const profileService = getProfileService();
      return profileService.updateProfile(id, data);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET,
    wrapHandler(async (_event, id: string): Promise<StoredUserProfile | null> => {
      const profileService = getProfileService();
      return profileService.getProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET_ALL,
    wrapHandler(async (_event): Promise<StoredUserProfile[]> => {
      const profileService = getProfileService();
      return profileService.getAllProfiles();
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_DELETE,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const profileService = getProfileService();
      return profileService.deleteProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_SET_DEFAULT,
    wrapHandler(async (_event, id: string): Promise<void> => {
      const profileService = getProfileService();
      return profileService.setDefaultProfile(id);
    })
  );

  ipcMain.handle(
    IpcChannels.PROFILE_GET_DEFAULT,
    wrapHandler(async (_event): Promise<StoredUserProfile | null> => {
      const profileService = getProfileService();
      return profileService.getDefaultProfile();
    })
  );

  // ====== Report Handlers ======

  ipcMain.handle(
    IpcChannels.REPORT_GENERATE,
    wrapHandler(async (_event, profileId: string): Promise<HealthReport> => {
      const reportService = getReportService();
      return reportService.generateReport(profileId);
    })
  );

  ipcMain.handle(
    IpcChannels.REPORT_QUICK_SUMMARY,
    wrapHandler(
      async (_event, profileId: string): Promise<{ bodyScore: number; status: string } | null> => {
        const reportService = getReportService();
        return reportService.getQuickSummary(profileId);
      }
    )
  );

  // ====== BLE Handlers ======

  ipcMain.handle(
    IpcChannels.BLE_SCAN,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.scan();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_SCAN_FOR_DEVICES,
    wrapHandler(async (_event, timeoutMs?: number): Promise<BLEDeviceInfo[]> => {
      const blePort = getBLEPort();
      return blePort.scanForDevices(timeoutMs);
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_STOP_SCAN,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      blePort.stopScan();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_CONNECT,
    wrapHandler(async (_event, mac: string, key: string): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.connect(mac, key);
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_DISCONNECT,
    wrapHandler(async (_event): Promise<void> => {
      const blePort = getBLEPort();
      return blePort.disconnect();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_GET_STATE,
    wrapHandler(async (_event): Promise<BLEConnectionState> => {
      const blePort = getBLEPort();
      return blePort.getState();
    })
  );

  ipcMain.handle(
    IpcChannels.BLE_IS_AVAILABLE,
    wrapHandler(async (_event): Promise<boolean> => {
      const blePort = getBLEPort();
      return blePort.isDeviceAvailable();
    })
  );

  // ====== Xiaomi Cloud Handlers ======

  ipcMain.handle(
    IpcChannels.XIAOMI_START_QR_LOGIN,
    wrapHandler(async (_event): Promise<QRLoginSession> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.startQRLogin();
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_POLL_LOGIN,
    wrapHandler(async (_event, sessionId: string): Promise<QRLoginPollResult> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.pollLoginStatus(sessionId);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_COMPLETE_LOGIN,
    wrapHandler(async (_event, authToken: string, region: XiaomiRegion): Promise<void> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.completeLogin(authToken, region);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_DEVICES,
    wrapHandler(async (_event): Promise<XiaomiCloudDevice[]> => {
      const xiaomiService = getXiaomiCloudService();
      const devices = await xiaomiService.getDevices();
      return devices.map((d) => ({
        did: d.did,
        name: d.name,
        model: d.model,
        mac: d.mac,
        isBLE: d.isBLE,
        parentId: d.parentId,
      }));
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_BLE_KEY,
    wrapHandler(async (_event, deviceId: string): Promise<BLEKeyResult> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.getBLEKey(deviceId);
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_GET_AUTH_STATE,
    wrapHandler(async (_event): Promise<XiaomiAuthState> => {
      const xiaomiService = getXiaomiCloudService();
      return xiaomiService.getAuthState();
    })
  );

  ipcMain.handle(
    IpcChannels.XIAOMI_LOGOUT,
    wrapHandler(async (_event): Promise<void> => {
      const xiaomiService = getXiaomiCloudService();
      xiaomiService.logout();
    })
  );

  // ====== Backup Handlers ======

  ipcMain.handle(
    IpcChannels.BACKUP_CREATE,
    wrapHandler(async (_event): Promise<BackupData> => {
      const backupService = getBackupService();
      return backupService.createBackup();
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_RESTORE,
    wrapHandler(async (_event, backup: BackupData, options?: RestoreOptions): Promise<void> => {
      const backupService = getBackupService();
      return backupService.restoreBackup(backup, options);
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_VALIDATE,
    wrapHandler(async (_event, backup: unknown): Promise<BackupValidationResult> => {
      const backupService = getBackupService();
      return backupService.validateBackup(backup);
    })
  );

  ipcMain.handle(
    IpcChannels.BACKUP_GET_INFO,
    wrapHandler(async (_event, backup: BackupData): Promise<BackupInfo> => {
      const backupService = getBackupService();
      return backupService.getBackupInfo(backup);
    })
  );

  // ====== Config Handlers ======

  ipcMain.handle(
    IpcChannels.CONFIG_GET_BLE,
    wrapHandler(async (_event): Promise<StoredBLEConfig> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.getBLEConfig();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_SET_BLE,
    wrapHandler(async (_event, config: StoredBLEConfig): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.setBLEConfig(config);
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_GET_SETTINGS,
    wrapHandler(async (_event): Promise<AppSettings> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.getAppSettings();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_SET_SETTINGS,
    wrapHandler(async (_event, settings: AppSettings): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.setAppSettings(settings);
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_EXPORT,
    wrapHandler(async (_event): Promise<ConfigExport> => {
      const configStore = getAppConfigStoreInstance();
      return configStore.exportConfig();
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_IMPORT,
    wrapHandler(async (_event, config: ConfigExport): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.importConfig(config);
    })
  );

  ipcMain.handle(
    IpcChannels.CONFIG_RESET,
    wrapHandler(async (_event): Promise<void> => {
      const configStore = getAppConfigStoreInstance();
      configStore.reset();
    })
  );

  console.log('[IPC] Handlers registered successfully');
}

// ====== Native BLE Adapter Instance ======
let nobleBLEAdapter: NobleBLEAdapter | null = null;

/**
 * Get or create the Native BLE adapter instance
 */
function getNobleBLEAdapter(): NobleBLEAdapter {
  if (!nobleBLEAdapter) {
    const configStore = getAppConfigStoreInstance();
    const bleConfig = configStore.getBLEConfig();

    nobleBLEAdapter = new NobleBLEAdapter({
      deviceMac: bleConfig.deviceMac || null,
      autoConnect: bleConfig.autoConnect ?? true,
      scanInterval: 5000,
      scanTimeout: 30000,
      allowDuplicates: true,
    });

    console.log('[NativeBLE] Adapter initialized');
  }
  return nobleBLEAdapter;
}

/**
 * Register Native BLE IPC handlers
 * Call this after registerIpcHandlers()
 */
export function registerNativeBLEHandlers(): void {
  console.log('[NativeBLE] Registering handlers...');

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_START_SCANNING,
    wrapHandler(async (): Promise<void> => {
      const adapter = getNobleBLEAdapter();
      await adapter.startScanning();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_STOP_SCANNING,
    wrapHandler(async (): Promise<void> => {
      const adapter = getNobleBLEAdapter();
      await adapter.stopScanning();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_DISCONNECT,
    wrapHandler(async (): Promise<void> => {
      const adapter = getNobleBLEAdapter();
      await adapter.disconnect();
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_SET_DEVICE,
    wrapHandler(async (_event, mac: string): Promise<void> => {
      const adapter = getNobleBLEAdapter();
      adapter.setDeviceMac(mac);

      // Also save to config
      const configStore = getAppConfigStoreInstance();
      const currentConfig = configStore.getBLEConfig();
      configStore.setBLEConfig({
        ...currentConfig,
        deviceMac: mac,
      });
    })
  );

  ipcMain.handle(
    IpcChannels.NATIVE_BLE_GET_STATUS,
    wrapHandler(async (): Promise<{
      isConnected: boolean;
      isScanning: boolean;
      device: { id: string; name: string } | null;
      state: string;
    }> => {
      const adapter = getNobleBLEAdapter();
      return {
        isConnected: adapter.isConnected(),
        isScanning: adapter.getState() === 'scanning',
        device: adapter.getConnectedDevice(),
        state: adapter.getState(),
      };
    })
  );

  console.log('[NativeBLE] Handlers registered successfully');
}

/**
 * Setup Native BLE event forwarding to renderer
 * Call this after creating the main window
 */
export function setupNativeBLEEventForwarding(mainWindow: BrowserWindow): () => void {
  const adapter = getNobleBLEAdapter();

  // Forward measurement events
  const measurementHandler = (measurement: { weightKg: number; impedanceOhm?: number; timestamp?: Date }) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_MEASUREMENT, {
        ...measurement,
        timestamp: measurement.timestamp?.toISOString() || new Date().toISOString(),
      });
    }
  };
  adapter.on('measurement', measurementHandler);

  // Forward connected events
  const connectedHandler = (device: { id: string; name: string }) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_CONNECTED, device);
    }
  };
  adapter.on('connected', connectedHandler);

  // Forward disconnected events
  const disconnectedHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_DISCONNECTED);
    }
  };
  adapter.on('disconnected', disconnectedHandler);

  // Forward scanning events
  const scanningHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_SCANNING);
    }
  };
  adapter.on('scanning', scanningHandler);

  // Forward discovered events
  const discoveredHandler = (device: { id: string; name: string }) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_DISCOVERED, device);
    }
  };
  adapter.on('discovered', discoveredHandler);

  // Forward error events
  const errorHandler = (error: Error) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_ERROR, error.message);
    }
  };
  adapter.on('error', errorHandler);

  // Forward ready events
  const readyHandler = () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_READY);
    }
  };
  adapter.on('ready', readyHandler);

  // Forward unavailable events
  const unavailableHandler = (state: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.NATIVE_BLE_UNAVAILABLE, state);
    }
  };
  adapter.on('unavailable', unavailableHandler);

  // Cleanup function
  return () => {
    adapter.off('measurement', measurementHandler);
    adapter.off('connected', connectedHandler);
    adapter.off('disconnected', disconnectedHandler);
    adapter.off('scanning', scanningHandler);
    adapter.off('discovered', discoveredHandler);
    adapter.off('error', errorHandler);
    adapter.off('ready', readyHandler);
    adapter.off('unavailable', unavailableHandler);

    // Disconnect and cleanup adapter
    adapter.disconnect().catch(console.error);
    adapter.removeAllListeners();
    nobleBLEAdapter = null;
  };
}

/**
 * Setup BLE event forwarding to renderer
 * Call this after creating the main window
 */
export function setupBLEEventForwarding(mainWindow: BrowserWindow): () => void {
  const blePort = getBLEPort();

  // Forward state changes to renderer
  const unsubscribeState = blePort.onStateChange((state) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_STATE_CHANGE, {
        state,
        timestamp: Date.now(),
      });
    }
  });

  // Forward errors to renderer
  const unsubscribeError = blePort.onError((error) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_ERROR, {
        code: error.code,
        message: error.message,
        recoverable: error.recoverable,
        suggestion: error.suggestion,
        timestamp: Date.now(),
      });
    }
  });

  // Forward device discoveries to renderer
  const unsubscribeDeviceDiscovered = blePort.onDeviceDiscovered((device) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IpcChannels.BLE_DEVICE_DISCOVERED, device);
    }
  });

  // Return cleanup function
  return () => {
    unsubscribeState();
    unsubscribeError();
    unsubscribeDeviceDiscovered();
  };
}
