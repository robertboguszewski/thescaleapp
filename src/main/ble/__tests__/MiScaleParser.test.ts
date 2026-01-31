/**
 * Mi Scale Parser Tests (TDD)
 *
 * Tests written BEFORE implementation following TDD methodology.
 * These tests define the expected behavior of the parser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MiScaleParser, type ParsedWeight, type ParsedFlags } from '../MiScaleParser';

describe('MiScaleParser', () => {
  let parser: MiScaleParser;

  beforeEach(() => {
    parser = new MiScaleParser();
  });

  describe('parseAdvertisementData', () => {
    it('should return null for data shorter than minimum length', () => {
      const shortData = Buffer.from([0x00, 0x01, 0x02]);
      expect(parser.parseAdvertisementData(shortData)).toBeNull();
    });

    it('should return null for unstable weight (stabilized flag not set)', () => {
      // Create buffer where bit 5 of byte 0 is NOT set (not stabilized)
      const unstableData = Buffer.alloc(14);
      unstableData[0] = 0x00; // No flags set - not stabilized
      unstableData.writeUInt16LE(7000, 11); // 35kg in raw units (35 * 200 = 7000)

      expect(parser.parseAdvertisementData(unstableData)).toBeNull();
    });

    it('should parse stabilized weight correctly in kg', () => {
      // Mi Scale 2 format: weight at bytes 11-12, stabilized flag at bit 5
      const stableData = Buffer.alloc(14);
      stableData[0] = 0x20; // Bit 5 set = stabilized
      stableData.writeUInt16LE(14000, 11); // 70kg (70 * 200 = 14000)

      const result = parser.parseAdvertisementData(stableData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(70);
    });

    it('should parse weight with correct precision (2 decimal places)', () => {
      const stableData = Buffer.alloc(14);
      stableData[0] = 0x20;
      stableData.writeUInt16LE(14150, 11); // 70.75kg (70.75 * 200 = 14150)

      const result = parser.parseAdvertisementData(stableData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(70.75);
    });

    it('should parse impedance when available', () => {
      const dataWithImpedance = Buffer.alloc(14);
      dataWithImpedance[0] = 0x20;
      dataWithImpedance.writeUInt16LE(500, 9); // Impedance at bytes 9-10
      dataWithImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(500);
    });

    it('should not include impedance when bytes are zero', () => {
      const dataWithoutImpedance = Buffer.alloc(14);
      dataWithoutImpedance[0] = 0x20;
      dataWithoutImpedance[9] = 0x00;
      dataWithoutImpedance[10] = 0x00;
      dataWithoutImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithoutImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBeUndefined();
    });

    it('should handle maximum realistic weight (200kg)', () => {
      const maxWeightData = Buffer.alloc(14);
      maxWeightData[0] = 0x20;
      maxWeightData.writeUInt16LE(40000, 11); // 200kg (200 * 200 = 40000)

      const result = parser.parseAdvertisementData(maxWeightData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(200);
    });

    it('should handle minimum realistic weight (2kg)', () => {
      const minWeightData = Buffer.alloc(14);
      minWeightData[0] = 0x20;
      minWeightData.writeUInt16LE(400, 11); // 2kg (2 * 200 = 400)

      const result = parser.parseAdvertisementData(minWeightData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(2);
    });
  });

  describe('parseCharacteristicData', () => {
    it('should parse Body Composition Measurement (0x2a9c)', () => {
      // Standard BLE Body Composition format
      const charData = Buffer.alloc(10);
      charData[0] = 0x20; // Flags: stabilized
      charData.writeUInt16LE(14000, 1); // Weight in 0.005 kg units = 70kg

      const result = parser.parseCharacteristicData('2a9c', charData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(70);
    });

    it('should parse Weight Measurement (0x2a9d)', () => {
      const charData = Buffer.alloc(10);
      charData[0] = 0x20;
      charData.writeUInt16LE(14000, 1);

      const result = parser.parseCharacteristicData('2a9d', charData);
      expect(result).not.toBeNull();
    });

    it('should handle imperial units and convert to kg', () => {
      const imperialData = Buffer.alloc(10);
      imperialData[0] = 0x21; // Bit 0 = imperial, Bit 5 = stabilized
      // 154.3 lbs in 0.01 lb units = 15430
      imperialData.writeUInt16LE(15430, 1);

      const result = parser.parseCharacteristicData('2a9c', imperialData);
      expect(result).not.toBeNull();
      // 154.3 lbs * 0.453592 = ~69.99 kg
      expect(result!.weightKg).toBeCloseTo(70, 0);
    });

    it('should return null for unknown characteristic UUID', () => {
      const data = Buffer.alloc(10);
      data[0] = 0x20;
      data.writeUInt16LE(14000, 1);

      const result = parser.parseCharacteristicData('ffff', data);
      expect(result).toBeNull();
    });

    it('should return null for unstable measurement', () => {
      const unstableData = Buffer.alloc(10);
      unstableData[0] = 0x00; // Not stabilized
      unstableData.writeUInt16LE(14000, 1);

      const result = parser.parseCharacteristicData('2a9c', unstableData);
      expect(result).toBeNull();
    });
  });

  describe('parseFlags', () => {
    it('should detect metric units', () => {
      const flags = parser.parseFlags(0x00);
      expect(flags.isImperial).toBe(false);
    });

    it('should detect imperial units', () => {
      const flags = parser.parseFlags(0x01);
      expect(flags.isImperial).toBe(true);
    });

    it('should detect stabilized weight', () => {
      const flags = parser.parseFlags(0x20);
      expect(flags.isStabilized).toBe(true);
    });

    it('should detect unstabilized weight', () => {
      const flags = parser.parseFlags(0x00);
      expect(flags.isStabilized).toBe(false);
    });

    it('should detect weight removal', () => {
      const flags = parser.parseFlags(0x80);
      expect(flags.isWeightRemoved).toBe(true);
    });

    it('should parse combined flags correctly', () => {
      // Imperial + Stabilized + Weight removed
      const flags = parser.parseFlags(0xA1);
      expect(flags.isImperial).toBe(true);
      expect(flags.isStabilized).toBe(true);
      expect(flags.isWeightRemoved).toBe(true);
    });
  });

  describe('weight validation', () => {
    it('should reject weights below 2kg as invalid', () => {
      const tooLightData = Buffer.alloc(14);
      tooLightData[0] = 0x20;
      tooLightData.writeUInt16LE(100, 11); // 0.5kg

      const result = parser.parseAdvertisementData(tooLightData);
      expect(result).toBeNull();
    });

    it('should reject weights above 300kg as invalid', () => {
      const tooHeavyData = Buffer.alloc(14);
      tooHeavyData[0] = 0x20;
      tooHeavyData.writeUInt16LE(60200, 11); // 301kg (301 * 200 = 60200)

      const result = parser.parseAdvertisementData(tooHeavyData);
      expect(result).toBeNull();
    });

    it('should accept weights at lower boundary (2kg)', () => {
      const boundaryData = Buffer.alloc(14);
      boundaryData[0] = 0x20;
      boundaryData.writeUInt16LE(400, 11); // 2kg

      const result = parser.parseAdvertisementData(boundaryData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(2);
    });

    it('should accept weights at upper boundary (300kg)', () => {
      const boundaryData = Buffer.alloc(14);
      boundaryData[0] = 0x20;
      boundaryData.writeUInt16LE(60000, 11); // 300kg

      const result = parser.parseAdvertisementData(boundaryData);
      expect(result).not.toBeNull();
      expect(result!.weightKg).toBe(300);
    });
  });

  describe('impedance validation', () => {
    it('should reject impedance below 100 Ω as invalid', () => {
      const dataWithLowImpedance = Buffer.alloc(14);
      dataWithLowImpedance[0] = 0x20; // Stabilized
      dataWithLowImpedance.writeUInt16LE(99, 9); // 99 Ω - too low
      dataWithLowImpedance.writeUInt16LE(14000, 11); // 70kg

      const result = parser.parseAdvertisementData(dataWithLowImpedance);
      expect(result).not.toBeNull();
      // Impedance should be undefined (not included) when outside valid range
      expect(result!.impedanceOhm).toBeUndefined();
    });

    it('should reject impedance above 1200 Ω as invalid', () => {
      const dataWithHighImpedance = Buffer.alloc(14);
      dataWithHighImpedance[0] = 0x20;
      dataWithHighImpedance.writeUInt16LE(1201, 9); // 1201 Ω - too high
      dataWithHighImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithHighImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBeUndefined();
    });

    it('should accept impedance at lower boundary (100 Ω)', () => {
      const dataWithMinImpedance = Buffer.alloc(14);
      dataWithMinImpedance[0] = 0x20;
      dataWithMinImpedance.writeUInt16LE(100, 9); // 100 Ω - minimum valid
      dataWithMinImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithMinImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(100);
    });

    it('should accept impedance at upper boundary (1200 Ω)', () => {
      const dataWithMaxImpedance = Buffer.alloc(14);
      dataWithMaxImpedance[0] = 0x20;
      dataWithMaxImpedance.writeUInt16LE(1200, 9); // 1200 Ω - maximum valid
      dataWithMaxImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithMaxImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(1200);
    });

    it('should accept typical body impedance values (400-600 Ω)', () => {
      const dataWithTypicalImpedance = Buffer.alloc(14);
      dataWithTypicalImpedance[0] = 0x20;
      dataWithTypicalImpedance.writeUInt16LE(500, 9); // 500 Ω - typical
      dataWithTypicalImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithTypicalImpedance);
      expect(result).not.toBeNull();
      expect(result!.impedanceOhm).toBe(500);
    });

    it('should treat zero impedance as not available (not as invalid)', () => {
      const dataWithZeroImpedance = Buffer.alloc(14);
      dataWithZeroImpedance[0] = 0x20;
      dataWithZeroImpedance.writeUInt16LE(0, 9); // 0 Ω - not available
      dataWithZeroImpedance.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(dataWithZeroImpedance);
      expect(result).not.toBeNull();
      // Zero means "no impedance measurement" - should be undefined
      expect(result!.impedanceOhm).toBeUndefined();
    });
  });

  describe('timestamp handling', () => {
    it('should add timestamp to parsed measurement', () => {
      const stableData = Buffer.alloc(14);
      stableData[0] = 0x20;
      stableData.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(stableData);
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeInstanceOf(Date);
    });

    it('should use current time for timestamp', () => {
      const before = new Date();
      const stableData = Buffer.alloc(14);
      stableData[0] = 0x20;
      stableData.writeUInt16LE(14000, 11);

      const result = parser.parseAdvertisementData(stableData);
      const after = new Date();

      expect(result!.timestamp!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result!.timestamp!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
