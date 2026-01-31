/**
 * Main Process Module
 *
 * Entry point exports for the Electron main process.
 *
 * @module main
 */

// Main entry point - importing this file starts the application
export * from './main';

// Services container
export {
  initializeServices,
  areServicesInitialized,
  getMeasurementService,
  getProfileService,
  getReportService,
  getBLEPort,
  getMeasurementRepository,
  getProfileRepository,
} from './services';

// IPC handlers
export { registerIpcHandlers, registerNativeBLEHandlers, setupBLEEventForwarding, setupNativeBLEEventForwarding } from './ipc-handlers';
