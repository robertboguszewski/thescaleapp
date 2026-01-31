/**
 * Tests for S400 Parser
 * @module infrastructure/ble/__tests__/S400Parser.test
 */

import { describe, it, expect } from 'vitest';
import {
  parseFrameControl,
  parseMiBeaconAdvertisement,
  parseWeightObject,
  parseImpedanceObject,
  parseAdvertisementData,
  isValidMiScaleProductId,
  MI_SCALE_PRODUCT_IDS,
  MIBEACON_OBJECT_TYPES,
  XIAOMI_SERVICE_UUID
} from '../S400Parser';

describe('S400 Parser', () => {
  describe('Constants', () => {
    it('should have correct Xiaomi service UUID', () => {
      expect(XIAOMI_SERVICE_UUID).toBe('fe95');
    });

    it('should have valid product IDs', () => {
      expect(MI_SCALE_PRODUCT_IDS.WEIGHT_SCALE).toBe(0x181d);
      expect(MI_SCALE_PRODUCT_IDS.BODY_COMPOSITION).toBe(0x181b);
    });

    it('should have valid object types', () => {
      expect(MIBEACON_OBJECT_TYPES.WEIGHT).toBe(0x06);
      expect(MIBEACON_OBJECT_TYPES.IMPEDANCE).toBe(0x07);
      expect(MIBEACON_OBJECT_TYPES.BODY_COMPOSITION).toBe(0x0a);
    });
  });

  describe('parseFrameControl', () => {
    it('should parse encrypted flag', () => {
      const flags = 0x0008;
      const result = parseFrameControl(flags);
      expect(result.isEncrypted).toBe(true);
    });

    it('should parse hasMac flag', () => {
      const flags = 0x0010;
      const result = parseFrameControl(flags);
      expect(result.hasMac).toBe(true);
    });

    it('should parse hasCapability flag', () => {
      const flags = 0x0020;
      const result = parseFrameControl(flags);
      expect(result.hasCapability).toBe(true);
    });

    it('should parse hasObject flag', () => {
      const flags = 0x0040;
      const result = parseFrameControl(flags);
      expect(result.hasObject).toBe(true);
    });

    it('should parse isMesh flag', () => {
      const flags = 0x0080;
      const result = parseFrameControl(flags);
      expect(result.isMesh).toBe(true);
    });

    it('should parse isRegistered flag', () => {
      const flags = 0x0100;
      const result = parseFrameControl(flags);
      expect(result.isRegistered).toBe(true);
    });

    it('should parse isBindingConfirmed flag', () => {
      const flags = 0x0200;
      const result = parseFrameControl(flags);
      expect(result.isBindingConfirmed).toBe(true);
    });

    it('should parse combined flags', () => {
      const flags = 0x0058; // isEncrypted + hasMac + hasObject
      const result = parseFrameControl(flags);

      expect(result.isEncrypted).toBe(true);
      expect(result.hasMac).toBe(true);
      expect(result.hasObject).toBe(true);
      expect(result.hasCapability).toBe(false);
      expect(result.isMesh).toBe(false);
    });

    it('should return all false for zero', () => {
      const result = parseFrameControl(0);

      expect(result.isEncrypted).toBe(false);
      expect(result.hasMac).toBe(false);
      expect(result.hasCapability).toBe(false);
      expect(result.hasObject).toBe(false);
      expect(result.isMesh).toBe(false);
      expect(result.isRegistered).toBe(false);
      expect(result.isBindingConfirmed).toBe(false);
    });
  });

  describe('parseMiBeaconAdvertisement', () => {
    it('should return null for data shorter than 5 bytes', () => {
      expect(parseMiBeaconAdvertisement(Buffer.from([0x00, 0x00, 0x00, 0x00]))).toBeNull();
    });

    it('should parse basic header', () => {
      // Frame control: 0x0000, Product ID: 0x181B, Frame counter: 0x05
      const data = Buffer.from([0x00, 0x00, 0x1b, 0x18, 0x05]);
      const result = parseMiBeaconAdvertisement(data);

      expect(result).not.toBeNull();
      expect(result!.productId).toBe(0x181b);
      expect(result!.frameCounter).toBe(0x05);
    });

    it('should parse MAC address when hasMac flag is set', () => {
      // Frame control with hasMac: 0x0010
      // Product ID: 0x181B
      // Frame counter: 0x01
      // MAC: AA:BB:CC:DD:EE:FF (reversed in buffer)
      const data = Buffer.from([
        0x10, 0x00, // Frame control (hasMac)
        0x1b, 0x18, // Product ID
        0x01, // Frame counter
        0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa // MAC (reversed)
      ]);

      const result = parseMiBeaconAdvertisement(data);

      expect(result).not.toBeNull();
      expect(result!.mac).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should parse capability when hasCapability flag is set', () => {
      // Frame control with hasCapability: 0x0020
      const data = Buffer.from([
        0x20, 0x00, // Frame control (hasCapability)
        0x1b, 0x18, // Product ID
        0x01, // Frame counter
        0x42 // Capability
      ]);

      const result = parseMiBeaconAdvertisement(data);

      expect(result).not.toBeNull();
      expect(result!.capability).toBe(0x42);
    });

    it('should extract encrypted payload when hasObject flag is set', () => {
      // Frame control with hasObject: 0x0040
      const data = Buffer.from([
        0x40, 0x00, // Frame control (hasObject)
        0x1b, 0x18, // Product ID
        0x01, // Frame counter
        0xde, 0xad, 0xbe, 0xef // Payload
      ]);

      const result = parseMiBeaconAdvertisement(data);

      expect(result).not.toBeNull();
      expect(result!.encryptedPayload).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
    });

    it('should parse complete advertisement with all fields', () => {
      // Frame control: hasMac + hasCapability + hasObject
      const data = Buffer.from([
        0x70, 0x00, // Frame control
        0x1b, 0x18, // Product ID (0x181B)
        0x0a, // Frame counter (10)
        0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, // MAC (reversed)
        0x05, // Capability
        0x01, 0x02, 0x03 // Payload
      ]);

      const result = parseMiBeaconAdvertisement(data);

      expect(result).not.toBeNull();
      expect(result!.frameControl.hasMac).toBe(true);
      expect(result!.frameControl.hasCapability).toBe(true);
      expect(result!.frameControl.hasObject).toBe(true);
      expect(result!.productId).toBe(0x181b);
      expect(result!.frameCounter).toBe(10);
      expect(result!.mac).toBe('AA:BB:CC:DD:EE:FF');
      expect(result!.capability).toBe(0x05);
      expect(result!.encryptedPayload).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    });
  });

  describe('parseWeightObject', () => {
    it('should return null for data shorter than 6 bytes', () => {
      expect(parseWeightObject(Buffer.from([0x06, 0x04, 0x00, 0x00, 0x00]))).toBeNull();
    });

    it('should return null for wrong object type', () => {
      const data = Buffer.from([0x07, 0x04, 0x00, 0x00, 0x00, 0x00]);
      expect(parseWeightObject(data)).toBeNull();
    });

    it('should parse stable weight', () => {
      // Object type: 0x06 (weight)
      // Length: 0x04
      // Control: 0x20 (stable)
      // Weight: 14000 (70kg in 0.005kg units)
      const data = Buffer.from([
        0x06, // Object type
        0x04, // Length
        0x20, 0x00, // Control (stable flag set)
        0xb0, 0x36 // Weight (14000 = 70kg)
      ]);

      const result = parseWeightObject(data);

      expect(result).not.toBeNull();
      expect(result!.weightKg).toBeCloseTo(70, 1);
      expect(result!.isStable).toBe(true);
      expect(result!.weightRemoved).toBe(false);
    });

    it('should parse unstable weight', () => {
      const data = Buffer.from([
        0x06, 0x04,
        0x00, 0x00, // Control (no flags)
        0xb0, 0x36 // 14000 units
      ]);

      const result = parseWeightObject(data);

      expect(result).not.toBeNull();
      expect(result!.isStable).toBe(false);
    });

    it('should detect weight removed', () => {
      const data = Buffer.from([
        0x06, 0x04,
        0x80, 0x00, // Control (weight removed flag)
        0x00, 0x00
      ]);

      const result = parseWeightObject(data);

      expect(result).not.toBeNull();
      expect(result!.weightRemoved).toBe(true);
    });

    it('should detect impedance started', () => {
      const data = Buffer.from([
        0x06, 0x04,
        0x02, 0x00, // Control (impedance started flag)
        0xb0, 0x36
      ]);

      const result = parseWeightObject(data);

      expect(result).not.toBeNull();
      expect(result!.impedanceStarted).toBe(true);
    });
  });

  describe('parseImpedanceObject', () => {
    it('should return null for data shorter than 4 bytes', () => {
      expect(parseImpedanceObject(Buffer.from([0x07, 0x02, 0x00]))).toBeNull();
    });

    it('should return null for wrong object type', () => {
      const data = Buffer.from([0x06, 0x02, 0xe8, 0x03]);
      expect(parseImpedanceObject(data)).toBeNull();
    });

    it('should parse valid impedance', () => {
      // Object type: 0x07 (impedance)
      // Length: 0x02
      // Impedance: 500 Ohms
      const data = Buffer.from([
        0x07, // Object type
        0x02, // Length
        0xf4, 0x01 // Impedance (500)
      ]);

      const result = parseImpedanceObject(data);

      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(500);
      expect(result!.isComplete).toBe(true);
    });

    it('should mark zero impedance as incomplete', () => {
      const data = Buffer.from([0x07, 0x02, 0x00, 0x00]);

      const result = parseImpedanceObject(data);

      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(0);
      expect(result!.isComplete).toBe(false);
    });

    it('should mark very high impedance as incomplete', () => {
      const data = Buffer.from([
        0x07, 0x02,
        0xb8, 0x0b // 3000 Ohms
      ]);

      const result = parseImpedanceObject(data);

      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(3000);
      expect(result!.isComplete).toBe(false);
    });
  });

  describe('parseAdvertisementData', () => {
    it('should return empty object for short data', () => {
      expect(parseAdvertisementData(Buffer.from([0x00]))).toEqual({});
    });

    it('should extract stable weight', () => {
      const data = Buffer.from([
        0x06, 0x04, // Weight object
        0x20, 0x00, // Control (stable)
        0x90, 0x2b // 11152 units = 55.76kg
      ]);

      const result = parseAdvertisementData(data);

      expect(result.weightKg).toBeDefined();
      expect(result.weightKg).toBeCloseTo(55.76, 1);
    });

    it('should not extract unstable weight', () => {
      const data = Buffer.from([
        0x06, 0x04, // Weight object
        0x00, 0x00, // Control (not stable)
        0x90, 0x2b
      ]);

      const result = parseAdvertisementData(data);

      expect(result.weightKg).toBeUndefined();
    });

    it('should extract complete impedance', () => {
      const data = Buffer.from([
        0x07, 0x02, // Impedance object
        0xf4, 0x01 // 500 Ohms
      ]);

      const result = parseAdvertisementData(data);

      expect(result.impedanceOhm).toBe(500);
    });

    it('should not extract incomplete impedance', () => {
      const data = Buffer.from([
        0x07, 0x02,
        0x00, 0x00 // 0 Ohms (incomplete)
      ]);

      const result = parseAdvertisementData(data);

      expect(result.impedanceOhm).toBeUndefined();
    });

    it('should extract both weight and impedance', () => {
      const data = Buffer.from([
        0x06, 0x04, // Weight object
        0x20, 0x00, // Stable
        0xb0, 0x36, // 14000 units = 70kg
        0x07, 0x02, // Impedance object
        0xf4, 0x01 // 500 Ohms
      ]);

      const result = parseAdvertisementData(data);

      expect(result.weightKg).toBeCloseTo(70, 1);
      expect(result.impedanceOhm).toBe(500);
    });
  });

  describe('isValidMiScaleProductId', () => {
    it('should return true for valid product IDs', () => {
      expect(isValidMiScaleProductId(0x181d)).toBe(true);
      expect(isValidMiScaleProductId(0x181b)).toBe(true);
    });

    it('should return false for invalid product IDs', () => {
      expect(isValidMiScaleProductId(0x0000)).toBe(false);
      expect(isValidMiScaleProductId(0x1234)).toBe(false);
      expect(isValidMiScaleProductId(0xffff)).toBe(false);
    });
  });
});
