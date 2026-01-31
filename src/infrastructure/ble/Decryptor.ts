/**
 * MiBeacon Data Decryptor
 * Handles AES decryption of encrypted MiBeacon payloads
 *
 * The Mi Scale S400 encrypts measurement data using AES-128-CCM with a device-specific key.
 * The key must be obtained from Xiaomi Cloud (typically via the Mi Home app database).
 *
 * Encryption scheme:
 * - Algorithm: AES-128-CCM
 * - Key: Device-specific 16-byte key
 * - Nonce: Constructed from frame counter, MAC, and product ID
 * - AAD: Frame control and product ID
 *
 * @module infrastructure/ble/Decryptor
 */

import CryptoJS from 'crypto-js';

/**
 * Result of decryption operation
 */
export interface DecryptionResult {
  /** Whether decryption was successful */
  success: boolean;
  /** Decrypted data (if successful) */
  data?: Buffer;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Parameters needed for MiBeacon decryption
 */
export interface DecryptionParams {
  /** Encrypted payload from advertisement */
  payload: Buffer;
  /** Device BLE key (hex string, 32 chars = 16 bytes) */
  bleKey: string;
  /** Frame counter from advertisement */
  frameCounter: number;
  /** Device MAC address */
  mac: string;
  /** Product ID from advertisement */
  productId: number;
}

/**
 * Convert hex string to Buffer
 * @param hex - Hexadecimal string
 * @returns Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return Buffer.from(bytes);
}

/**
 * Convert Buffer to hex string
 * @param buffer - Buffer to convert
 * @returns Hexadecimal string
 */
export function bufferToHex(buffer: Buffer): string {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert MAC address string to Buffer (reversed for nonce)
 * @param mac - MAC address string (e.g., "AA:BB:CC:DD:EE:FF")
 * @returns Buffer with reversed bytes
 */
export function macToBuffer(mac: string): Buffer {
  const bytes = mac
    .replace(/[:-]/g, '')
    .match(/.{2}/g)
    ?.map(b => parseInt(b, 16));

  if (!bytes || bytes.length !== 6) {
    throw new Error('Invalid MAC address format');
  }

  // Reverse for MiBeacon nonce
  return Buffer.from(bytes.reverse());
}

/**
 * Construct nonce for AES-CCM decryption
 * MiBeacon nonce format:
 * - Bytes 0-5: MAC address (reversed)
 * - Bytes 6-7: Product ID (little-endian)
 * - Byte 8: Frame counter
 * - Bytes 9-11: Extended counter from payload (if available)
 *
 * @param mac - Device MAC address
 * @param productId - Product ID
 * @param frameCounter - Frame counter
 * @param extCounter - Extended counter bytes (from end of payload)
 * @returns Nonce buffer (12 bytes)
 */
export function constructNonce(
  mac: string,
  productId: number,
  frameCounter: number,
  extCounter?: Buffer
): Buffer {
  const nonce = Buffer.alloc(12);

  // MAC (reversed)
  const macBuffer = macToBuffer(mac);
  macBuffer.copy(nonce, 0);

  // Product ID (little-endian)
  nonce.writeUInt16LE(productId, 6);

  // Frame counter
  nonce.writeUInt8(frameCounter, 8);

  // Extended counter (if available)
  if (extCounter && extCounter.length >= 3) {
    extCounter.copy(nonce, 9, 0, 3);
  }

  return nonce;
}

/**
 * Construct AAD (Additional Authenticated Data) for AES-CCM
 * @param frameControl - Frame control value
 * @param productId - Product ID
 * @returns AAD buffer
 */
export function constructAAD(frameControl: number, productId: number): Buffer {
  const aad = Buffer.alloc(4);
  aad.writeUInt16LE(frameControl, 0);
  aad.writeUInt16LE(productId, 2);
  return aad;
}

/**
 * Validate BLE key format
 * @param bleKey - BLE key string
 * @returns True if key is valid
 */
export function isValidBLEKey(bleKey: string): boolean {
  const cleanKey = bleKey.replace(/[^0-9a-fA-F]/g, '');
  return cleanKey.length === 32; // 16 bytes = 32 hex chars
}

/**
 * Simple AES-ECB decryption fallback for legacy data
 * Some older firmware versions use simpler encryption
 *
 * @param encrypted - Encrypted data
 * @param key - AES key
 * @returns Decrypted data
 */
export function decryptAESECB(encrypted: Buffer, key: Buffer): Buffer {
  const keyWords = CryptoJS.enc.Hex.parse(bufferToHex(key));
  const encryptedWords = CryptoJS.enc.Hex.parse(bufferToHex(encrypted));

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: encryptedWords } as CryptoJS.lib.CipherParams,
    keyWords,
    {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    }
  );

  const decryptedHex = decrypted.toString(CryptoJS.enc.Hex);
  return hexToBuffer(decryptedHex);
}

/**
 * Decrypt MiBeacon encrypted payload
 *
 * Note: Full AES-CCM is not directly supported by crypto-js.
 * This implementation uses a simplified approach for MiBeacon data.
 * For production, consider using Node.js crypto with CCM mode or
 * a dedicated AES-CCM library.
 *
 * @param params - Decryption parameters
 * @returns Decryption result
 */
export function decryptMiBeacon(params: DecryptionParams): DecryptionResult {
  const { payload, bleKey, frameCounter, mac, productId } = params;

  // Validate key
  if (!isValidBLEKey(bleKey)) {
    return {
      success: false,
      error: 'Invalid BLE key format (expected 32 hex characters)'
    };
  }

  // Validate payload
  if (!payload || payload.length < 4) {
    return {
      success: false,
      error: 'Payload too short for decryption'
    };
  }

  try {
    const key = hexToBuffer(bleKey);

    // MiBeacon encrypted payload structure:
    // - Bytes 0..n-7: Encrypted data
    // - Bytes n-6..n-4: Extended counter (3 bytes)
    // - Bytes n-3..n: MIC (4 bytes for authentication)

    const encryptedData = payload.subarray(0, payload.length - 7);
    const extCounter = payload.subarray(payload.length - 7, payload.length - 4);
    // MIC is at payload.subarray(payload.length - 4) - used for verification

    // Construct nonce
    const nonce = constructNonce(mac, productId, frameCounter, extCounter);

    // For simplified decryption without full CCM verification,
    // we use AES-CTR mode which is the encryption part of CCM
    // This skips authentication verification
    const decrypted = decryptAESCTR(encryptedData, key, nonce);

    return {
      success: true,
      data: decrypted
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Decryption failed'
    };
  }
}

/**
 * AES-CTR decryption (counter mode)
 * Used as part of CCM decryption
 *
 * @param encrypted - Encrypted data
 * @param key - AES key (16 bytes)
 * @param nonce - Nonce/IV (12 bytes, will be padded to 16)
 * @returns Decrypted data
 */
export function decryptAESCTR(
  encrypted: Buffer,
  key: Buffer,
  nonce: Buffer
): Buffer {
  // Pad nonce to 16 bytes for CTR counter
  const iv = Buffer.alloc(16);
  nonce.copy(iv, 0, 0, Math.min(nonce.length, 16));

  const keyWords = CryptoJS.enc.Hex.parse(bufferToHex(key));
  const ivWords = CryptoJS.enc.Hex.parse(bufferToHex(iv));
  const encryptedWords = CryptoJS.enc.Hex.parse(bufferToHex(encrypted));

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: encryptedWords } as CryptoJS.lib.CipherParams,
    keyWords,
    {
      mode: CryptoJS.mode.CTR,
      iv: ivWords,
      padding: CryptoJS.pad.NoPadding
    }
  );

  const decryptedHex = decrypted.toString(CryptoJS.enc.Hex);
  return hexToBuffer(decryptedHex);
}

/**
 * Convenience function to decrypt MiBeacon data with string key
 *
 * @param data - Full MiBeacon payload (encrypted)
 * @param bleKey - BLE key as hex string
 * @param frameCounter - Frame counter value
 * @param mac - Device MAC address
 * @param productId - Product ID
 * @returns Decrypted buffer or throws error
 */
export function decryptMiBeaconData(
  data: Buffer,
  bleKey: string,
  frameCounter: number,
  mac: string,
  productId: number
): Buffer {
  const result = decryptMiBeacon({
    payload: data,
    bleKey,
    frameCounter,
    mac,
    productId
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Decryption failed');
  }

  return result.data;
}

/**
 * Test if a key can successfully decrypt sample data
 * Useful for validating user-provided keys
 *
 * @param bleKey - BLE key to test
 * @param sampleEncrypted - Sample encrypted payload
 * @param sampleDecrypted - Expected decrypted result
 * @param params - Other decryption parameters
 * @returns True if key produces expected output
 */
export function testBLEKey(
  bleKey: string,
  sampleEncrypted: Buffer,
  sampleDecrypted: Buffer,
  params: Omit<DecryptionParams, 'payload' | 'bleKey'>
): boolean {
  try {
    const result = decryptMiBeacon({
      payload: sampleEncrypted,
      bleKey,
      ...params
    });

    if (!result.success || !result.data) {
      return false;
    }

    return result.data.equals(sampleDecrypted);
  } catch {
    return false;
  }
}
