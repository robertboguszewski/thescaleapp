/**
 * Mi Scale Data Parser
 *
 * Parses BLE advertisement data and characteristic data from Xiaomi Mi Scale devices.
 * Supports multiple Mi Scale models (Mi Scale 2, Body Composition Scale, etc.)
 *
 * @module main/ble/MiScaleParser
 */

import type { RawMeasurement } from './BLETypes';

/**
 * Parsed flags from BLE data
 */
export interface ParsedFlags {
  isImperial: boolean;
  isStabilized: boolean;
  isWeightRemoved: boolean;
}

/**
 * Parsed weight data (alias for RawMeasurement with guaranteed timestamp)
 */
export interface ParsedWeight extends RawMeasurement {
  timestamp: Date;
}

/**
 * Weight validation constants
 */
const MIN_VALID_WEIGHT_KG = 2;
const MAX_VALID_WEIGHT_KG = 300;

/**
 * Impedance validation constants (Ohm)
 * Based on typical human body impedance ranges:
 * - Too low (<100 Ω): measurement error or conductivity issue
 * - Valid range: 100-1200 Ω (covers most body types and conditions)
 * - Too high (>1200 Ω): poor electrode contact or dry skin
 */
const MIN_VALID_IMPEDANCE_OHM = 100;
const MAX_VALID_IMPEDANCE_OHM = 1200;

/**
 * Minimum data length for Mi Scale advertisement
 */
const MIN_ADVERTISEMENT_LENGTH = 13;

/**
 * Parser for Mi Scale BLE data
 */
export class MiScaleParser {
  /**
   * Parse advertisement data from Mi Scale
   *
   * Mi Scale broadcasts weight measurements in manufacturer-specific advertisement data.
   * Format (Mi Scale 2):
   * - Byte 0: Flags (bit 5 = stabilized)
   * - Bytes 9-10: Impedance (if available)
   * - Bytes 11-12: Weight (little-endian, units of 50g / 0.005kg)
   *
   * @param data - Raw advertisement data buffer
   * @returns Parsed measurement or null if invalid/unstable
   */
  parseAdvertisementData(data: Buffer): ParsedWeight | null {
    // Validate minimum length
    if (data.length < MIN_ADVERTISEMENT_LENGTH) {
      return null;
    }

    // Parse flags
    const flags = this.parseFlags(data[0]);

    // Only return stabilized measurements
    if (!flags.isStabilized) {
      return null;
    }

    // Parse weight (bytes 11-12, little-endian, units of 1/200 kg = 0.005 kg)
    const weightRaw = data.readUInt16LE(11);
    const weightKg = this.roundToDecimal(weightRaw / 200, 2);

    // Validate weight range
    if (!this.isValidWeight(weightKg)) {
      return null;
    }

    // Parse impedance if available (bytes 9-10)
    let impedanceOhm: number | undefined;
    if (data.length >= 11) {
      const impedanceRaw = data.readUInt16LE(9);
      // Only include impedance if it's non-zero AND within valid range
      if (impedanceRaw !== 0 && this.isValidImpedance(impedanceRaw)) {
        impedanceOhm = impedanceRaw;
      }
    }

    return {
      weightKg,
      impedanceOhm,
      timestamp: new Date(),
    };
  }

  /**
   * Parse characteristic notification data
   *
   * Standard BLE Weight Measurement (0x2a9d) and Body Composition Measurement (0x2a9c) format:
   * - Byte 0: Flags
   *   - Bit 0: Unit (0 = SI/kg, 1 = Imperial/lb)
   *   - Bit 5: Stabilized
   * - Bytes 1-2: Weight (little-endian)
   *   - SI: Resolution 0.005 kg
   *   - Imperial: Resolution 0.01 lb
   *
   * @param uuid - Characteristic UUID
   * @param data - Raw characteristic data buffer
   * @returns Parsed measurement or null if invalid
   */
  parseCharacteristicData(uuid: string, data: Buffer): ParsedWeight | null {
    // Only handle known weight-related characteristics
    const normalizedUuid = uuid.toLowerCase().replace(/-/g, '');
    if (normalizedUuid !== '2a9c' && normalizedUuid !== '2a9d') {
      return null;
    }

    if (data.length < 3) {
      return null;
    }

    const flags = this.parseFlags(data[0]);

    // Only return stabilized measurements
    if (!flags.isStabilized) {
      return null;
    }

    // Parse weight based on unit
    const weightRaw = data.readUInt16LE(1);
    let weightKg: number;

    if (flags.isImperial) {
      // Imperial: raw value is in 0.01 lb units
      const weightLb = weightRaw * 0.01;
      weightKg = this.roundToDecimal(weightLb * 0.453592, 2);
    } else {
      // SI: raw value is in 0.005 kg units
      weightKg = this.roundToDecimal(weightRaw * 0.005, 2);
    }

    // Validate weight range
    if (!this.isValidWeight(weightKg)) {
      return null;
    }

    return {
      weightKg,
      timestamp: new Date(),
    };
  }

  /**
   * Parse flag byte to extract individual flags
   *
   * @param flagByte - Raw flag byte
   * @returns Parsed flags object
   */
  parseFlags(flagByte: number): ParsedFlags {
    return {
      isImperial: (flagByte & 0x01) !== 0,      // Bit 0
      isStabilized: (flagByte & 0x20) !== 0,    // Bit 5
      isWeightRemoved: (flagByte & 0x80) !== 0, // Bit 7
    };
  }

  /**
   * Validate weight is within realistic range
   *
   * @param weightKg - Weight in kilograms
   * @returns True if weight is valid
   */
  private isValidWeight(weightKg: number): boolean {
    return weightKg >= MIN_VALID_WEIGHT_KG && weightKg <= MAX_VALID_WEIGHT_KG;
  }

  /**
   * Validate impedance is within realistic range
   *
   * @param impedanceOhm - Impedance in Ohms
   * @returns True if impedance is valid (100-1200 Ω)
   */
  private isValidImpedance(impedanceOhm: number): boolean {
    return impedanceOhm >= MIN_VALID_IMPEDANCE_OHM && impedanceOhm <= MAX_VALID_IMPEDANCE_OHM;
  }

  /**
   * Round number to specified decimal places
   *
   * @param value - Value to round
   * @param decimals - Number of decimal places
   * @returns Rounded value
   */
  private roundToDecimal(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

// Export singleton instance for convenience
export const miScaleParser = new MiScaleParser();
