/**
 * BLE Infrastructure Module
 * Exports all BLE-related utilities and parsers
 *
 * @module infrastructure/ble
 */

// Error handling
export {
  BLE_ERRORS,
  createBLEError,
  createBLEErrorWithMessage,
  isBLEError,
  toBLEError,
  formatBLEErrorForLog
} from './error-handler';

// Retry logic
export {
  withRetry,
  withConditionalRetry,
  createRetryWrapper,
  calculateDelay,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryCallback
} from './retry-handler';

// S400 Parser
export {
  parseFrameControl,
  parseMiBeaconAdvertisement,
  parseWeightObject,
  parseImpedanceObject,
  parseAdvertisementData,
  isValidMiScaleProductId,
  MI_SCALE_PRODUCT_IDS,
  MIBEACON_OBJECT_TYPES,
  XIAOMI_SERVICE_UUID,
  MI_SCALE_FILTERS,
  type FrameControl,
  type MiBeaconAdvertisement,
  type WeightData,
  type ImpedanceData
} from './S400Parser';

// Decryptor
export {
  hexToBuffer,
  bufferToHex,
  macToBuffer,
  constructNonce,
  constructAAD,
  isValidBLEKey,
  decryptMiBeacon,
  decryptMiBeaconData,
  decryptAESCTR,
  decryptAESECB,
  testBLEKey,
  type DecryptionResult,
  type DecryptionParams
} from './Decryptor';

// Web Bluetooth Adapter (for renderer process)
export { WebBluetoothAdapter } from './WebBluetoothAdapter';
