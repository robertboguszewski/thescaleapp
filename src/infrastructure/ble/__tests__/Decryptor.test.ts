/**
 * Tests for MiBeacon Decryptor
 * @module infrastructure/ble/__tests__/Decryptor.test
 */

import { describe, it, expect } from 'vitest';
import {
  hexToBuffer,
  bufferToHex,
  macToBuffer,
  constructNonce,
  constructAAD,
  isValidBLEKey,
  decryptMiBeacon,
  decryptAESCTR,
  decryptMiBeaconData,
  testBLEKey
} from '../Decryptor';

describe('MiBeacon Decryptor', () => {
  describe('hexToBuffer', () => {
    it('should convert hex string to buffer', () => {
      const result = hexToBuffer('deadbeef');
      expect(result).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle uppercase hex', () => {
      const result = hexToBuffer('DEADBEEF');
      expect(result).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle mixed case', () => {
      const result = hexToBuffer('DeAdBeEf');
      expect(result).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle hex with separators', () => {
      const result = hexToBuffer('de:ad:be:ef');
      expect(result).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should handle empty string', () => {
      const result = hexToBuffer('');
      expect(result).toEqual(Buffer.from([]));
    });

    it('should throw for odd length hex', () => {
      expect(() => hexToBuffer('abc')).toThrow('Invalid hex string length');
    });
  });

  describe('bufferToHex', () => {
    it('should convert buffer to hex string', () => {
      const buffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const result = bufferToHex(buffer);
      expect(result).toBe('deadbeef');
    });

    it('should pad single digit bytes', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03]);
      const result = bufferToHex(buffer);
      expect(result).toBe('010203');
    });

    it('should handle empty buffer', () => {
      const result = bufferToHex(Buffer.from([]));
      expect(result).toBe('');
    });
  });

  describe('macToBuffer', () => {
    it('should convert MAC with colons', () => {
      const result = macToBuffer('AA:BB:CC:DD:EE:FF');
      // Reversed for nonce
      expect(result).toEqual(Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]));
    });

    it('should convert MAC with dashes', () => {
      const result = macToBuffer('AA-BB-CC-DD-EE-FF');
      expect(result).toEqual(Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]));
    });

    it('should convert MAC without separators', () => {
      const result = macToBuffer('AABBCCDDEEFF');
      expect(result).toEqual(Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]));
    });

    it('should throw for invalid MAC', () => {
      expect(() => macToBuffer('invalid')).toThrow('Invalid MAC address format');
      expect(() => macToBuffer('AA:BB:CC')).toThrow('Invalid MAC address format');
    });
  });

  describe('constructNonce', () => {
    it('should construct 12-byte nonce', () => {
      const nonce = constructNonce('AA:BB:CC:DD:EE:FF', 0x181b, 5);
      expect(nonce.length).toBe(12);
    });

    it('should include reversed MAC at start', () => {
      const nonce = constructNonce('AA:BB:CC:DD:EE:FF', 0x181b, 5);
      // First 6 bytes should be reversed MAC
      expect(nonce.subarray(0, 6)).toEqual(Buffer.from([0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa]));
    });

    it('should include product ID at bytes 6-7', () => {
      const nonce = constructNonce('AA:BB:CC:DD:EE:FF', 0x181b, 5);
      expect(nonce.readUInt16LE(6)).toBe(0x181b);
    });

    it('should include frame counter at byte 8', () => {
      const nonce = constructNonce('AA:BB:CC:DD:EE:FF', 0x181b, 42);
      expect(nonce.readUInt8(8)).toBe(42);
    });

    it('should include extended counter when provided', () => {
      const extCounter = Buffer.from([0x01, 0x02, 0x03]);
      const nonce = constructNonce('AA:BB:CC:DD:EE:FF', 0x181b, 5, extCounter);
      expect(nonce.subarray(9, 12)).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    });
  });

  describe('constructAAD', () => {
    it('should construct 4-byte AAD', () => {
      const aad = constructAAD(0x5870, 0x181b);
      expect(aad.length).toBe(4);
    });

    it('should include frame control at bytes 0-1', () => {
      const aad = constructAAD(0x5870, 0x181b);
      expect(aad.readUInt16LE(0)).toBe(0x5870);
    });

    it('should include product ID at bytes 2-3', () => {
      const aad = constructAAD(0x5870, 0x181b);
      expect(aad.readUInt16LE(2)).toBe(0x181b);
    });
  });

  describe('isValidBLEKey', () => {
    it('should return true for valid 32-char hex key', () => {
      expect(isValidBLEKey('0123456789abcdef0123456789abcdef')).toBe(true);
    });

    it('should return true for key with separators', () => {
      expect(isValidBLEKey('01234567-89ab-cdef-0123-456789abcdef')).toBe(true);
    });

    it('should return true for uppercase key', () => {
      expect(isValidBLEKey('0123456789ABCDEF0123456789ABCDEF')).toBe(true);
    });

    it('should return false for short key', () => {
      expect(isValidBLEKey('0123456789abcdef')).toBe(false);
    });

    it('should return false for long key', () => {
      expect(isValidBLEKey('0123456789abcdef0123456789abcdef00')).toBe(false);
    });

    it('should return false for empty key', () => {
      expect(isValidBLEKey('')).toBe(false);
    });
  });

  describe('decryptMiBeacon', () => {
    it('should fail with invalid key', () => {
      const result = decryptMiBeacon({
        payload: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a]),
        bleKey: 'invalid',
        frameCounter: 1,
        mac: 'AA:BB:CC:DD:EE:FF',
        productId: 0x181b
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid BLE key');
    });

    it('should fail with short payload', () => {
      const result = decryptMiBeacon({
        payload: Buffer.from([0x00, 0x01]),
        bleKey: '0123456789abcdef0123456789abcdef',
        frameCounter: 1,
        mac: 'AA:BB:CC:DD:EE:FF',
        productId: 0x181b
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should decrypt valid payload', () => {
      // This is a mock test - actual decryption requires valid encrypted data
      // In production, you would use captured BLE data with known key
      const validKey = '0123456789abcdef0123456789abcdef';
      const payload = Buffer.alloc(15); // Minimum: encrypted + extCounter + MIC

      const result = decryptMiBeacon({
        payload,
        bleKey: validKey,
        frameCounter: 1,
        mac: 'AA:BB:CC:DD:EE:FF',
        productId: 0x181b
      });

      // Should attempt decryption (may or may not produce valid data)
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('decryptAESCTR', () => {
    it('should decrypt data with AES-CTR', () => {
      // Test with known values
      const key = hexToBuffer('0123456789abcdef0123456789abcdef');
      const nonce = Buffer.alloc(12);
      const encrypted = Buffer.alloc(16);

      // Should not throw
      const result = decryptAESCTR(encrypted, key, nonce);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(16);
    });

    it('should handle empty data', () => {
      const key = hexToBuffer('0123456789abcdef0123456789abcdef');
      const nonce = Buffer.alloc(12);
      const encrypted = Buffer.alloc(0);

      const result = decryptAESCTR(encrypted, key, nonce);
      expect(result.length).toBe(0);
    });
  });

  describe('decryptMiBeaconData', () => {
    it('should throw for invalid key', () => {
      expect(() => decryptMiBeaconData(
        Buffer.alloc(15),
        'invalid',
        1,
        'AA:BB:CC:DD:EE:FF',
        0x181b
      )).toThrow('Invalid BLE key');
    });

    it('should return buffer for valid params', () => {
      const result = decryptMiBeaconData(
        Buffer.alloc(15),
        '0123456789abcdef0123456789abcdef',
        1,
        'AA:BB:CC:DD:EE:FF',
        0x181b
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('testBLEKey', () => {
    it('should return false for wrong key', () => {
      const sampleEncrypted = Buffer.alloc(15);
      const sampleDecrypted = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

      const result = testBLEKey(
        '0123456789abcdef0123456789abcdef',
        sampleEncrypted,
        sampleDecrypted,
        {
          frameCounter: 1,
          mac: 'AA:BB:CC:DD:EE:FF',
          productId: 0x181b
        }
      );

      // Random key unlikely to produce exact expected output
      expect(result).toBe(false);
    });

    it('should return false for invalid key format', () => {
      const result = testBLEKey(
        'invalid',
        Buffer.alloc(15),
        Buffer.alloc(4),
        {
          frameCounter: 1,
          mac: 'AA:BB:CC:DD:EE:FF',
          productId: 0x181b
        }
      );

      expect(result).toBe(false);
    });
  });
});
