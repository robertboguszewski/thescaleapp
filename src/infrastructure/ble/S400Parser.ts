/**
 * Xiaomi Mi Scale S400 Data Parser
 * Parses MiBeacon advertisement data from the scale
 *
 * The Mi Scale S400 broadcasts data in MiBeacon format which includes:
 * - Frame control flags
 * - Product ID
 * - Frame counter
 * - MAC address
 * - Capability flags
 * - Encrypted payload with measurement data
 *
 * @module infrastructure/ble/S400Parser
 */

import { RawMeasurement } from '../../domain/calculations/types';

/**
 * MiBeacon frame control flags
 */
export interface FrameControl {
  /** Data is encrypted */
  isEncrypted: boolean;
  /** MAC address is included */
  hasMac: boolean;
  /** Capability data is included */
  hasCapability: boolean;
  /** Object data is included */
  hasObject: boolean;
  /** Mesh device */
  isMesh: boolean;
  /** Registered device */
  isRegistered: boolean;
  /** Binding confirmed */
  isBindingConfirmed: boolean;
}

/**
 * Parsed MiBeacon advertisement structure
 */
export interface MiBeaconAdvertisement {
  /** Frame control flags */
  frameControl: FrameControl;
  /** Product ID (0x181D for weight scale, 0x181B for body composition) */
  productId: number;
  /** Frame counter for replay protection */
  frameCounter: number;
  /** Device MAC address (if included) */
  mac?: string;
  /** Capability flags */
  capability?: number;
  /** Encrypted payload */
  encryptedPayload?: Buffer;
}

/**
 * Weight measurement data from decrypted payload
 */
export interface WeightData {
  /** Weight in kilograms */
  weightKg: number;
  /** Whether measurement is stable */
  isStable: boolean;
  /** Weight has been removed (user stepped off) */
  weightRemoved: boolean;
  /** Impedance measurement has started */
  impedanceStarted: boolean;
}

/**
 * Impedance measurement data from decrypted payload
 */
export interface ImpedanceData {
  /** Impedance in Ohms */
  impedanceOhm: number;
  /** Whether impedance measurement is complete */
  isComplete: boolean;
}

/**
 * Xiaomi Mi Scale S400 product IDs
 */
export const MI_SCALE_PRODUCT_IDS = {
  /** Basic weight measurement */
  WEIGHT_SCALE: 0x181d,
  /** Body composition measurement */
  BODY_COMPOSITION: 0x181b,
  /** Mi Scale 2 */
  MI_SCALE_2: 0x181d,
  /** Mi Body Composition Scale S400 */
  MI_BODY_COMPOSITION_S400: 0x181b
} as const;

/**
 * Object types in MiBeacon payload
 */
export const MIBEACON_OBJECT_TYPES = {
  /** Weight measurement */
  WEIGHT: 0x06,
  /** Impedance measurement */
  IMPEDANCE: 0x07,
  /** Body composition complete */
  BODY_COMPOSITION: 0x0a
} as const;

/**
 * Parse frame control flags from MiBeacon header
 * @param flags - 2-byte frame control value
 * @returns Parsed frame control structure
 */
export function parseFrameControl(flags: number): FrameControl {
  return {
    isEncrypted: (flags & 0x0008) !== 0,
    hasMac: (flags & 0x0010) !== 0,
    hasCapability: (flags & 0x0020) !== 0,
    hasObject: (flags & 0x0040) !== 0,
    isMesh: (flags & 0x0080) !== 0,
    isRegistered: (flags & 0x0100) !== 0,
    isBindingConfirmed: (flags & 0x0200) !== 0
  };
}

/**
 * Parse MiBeacon advertisement data
 * @param data - Raw advertisement data buffer
 * @returns Parsed advertisement structure or null if invalid
 */
export function parseMiBeaconAdvertisement(
  data: Buffer
): MiBeaconAdvertisement | null {
  if (data.length < 5) {
    return null;
  }

  // First 2 bytes: Frame control
  const frameControlValue = data.readUInt16LE(0);
  const frameControl = parseFrameControl(frameControlValue);

  // Next 2 bytes: Product ID
  const productId = data.readUInt16LE(2);

  // Next byte: Frame counter
  const frameCounter = data.readUInt8(4);

  let offset = 5;
  let mac: string | undefined;
  let capability: number | undefined;
  let encryptedPayload: Buffer | undefined;

  // MAC address (6 bytes, reversed)
  if (frameControl.hasMac && data.length >= offset + 6) {
    const macBytes = data.subarray(offset, offset + 6);
    mac = Array.from(macBytes)
      .reverse()
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
    offset += 6;
  }

  // Capability (1 byte)
  if (frameControl.hasCapability && data.length >= offset + 1) {
    capability = data.readUInt8(offset);
    offset += 1;
  }

  // Remaining data is the encrypted/object payload
  if (frameControl.hasObject && data.length > offset) {
    encryptedPayload = data.subarray(offset);
  }

  return {
    frameControl,
    productId,
    frameCounter,
    mac,
    capability,
    encryptedPayload
  };
}

/**
 * Parse decrypted weight object data
 * @param data - Decrypted object data buffer
 * @returns Weight data or null if invalid
 */
export function parseWeightObject(data: Buffer): WeightData | null {
  // Weight object format:
  // Byte 0: Object type (0x06)
  // Byte 1: Object length
  // Bytes 2-3: Control flags
  // Bytes 4-5: Weight (little-endian, in 0.005kg units for Mi Scale S400)

  if (data.length < 6) {
    return null;
  }

  const objectType = data.readUInt8(0);
  if (objectType !== MIBEACON_OBJECT_TYPES.WEIGHT) {
    return null;
  }

  const controlByte = data.readUInt8(2);
  const weightRaw = data.readUInt16LE(4);

  // Mi Scale S400 uses 0.005kg units (5g resolution)
  // Some models use catty (500g) as base unit - check control byte
  const isCatty = (controlByte & 0x01) !== 0;
  const unit = isCatty ? 0.5 : 0.005;

  return {
    weightKg: weightRaw * unit,
    isStable: (controlByte & 0x20) !== 0,
    weightRemoved: (controlByte & 0x80) !== 0,
    impedanceStarted: (controlByte & 0x02) !== 0
  };
}

/**
 * Parse decrypted impedance object data
 * @param data - Decrypted object data buffer
 * @returns Impedance data or null if invalid
 */
export function parseImpedanceObject(data: Buffer): ImpedanceData | null {
  // Impedance object format:
  // Byte 0: Object type (0x07)
  // Byte 1: Object length
  // Bytes 2-3: Impedance (little-endian, in Ohms)

  if (data.length < 4) {
    return null;
  }

  const objectType = data.readUInt8(0);
  if (objectType !== MIBEACON_OBJECT_TYPES.IMPEDANCE) {
    return null;
  }

  const impedanceRaw = data.readUInt16LE(2);

  return {
    impedanceOhm: impedanceRaw,
    isComplete: impedanceRaw > 0 && impedanceRaw < 3000
  };
}

/**
 * Parse advertisement data into partial RawMeasurement
 * This is the main entry point for parsing scale data
 *
 * @param data - Raw advertisement data buffer (decrypted if needed)
 * @returns Partial measurement data extracted from advertisement
 */
export function parseAdvertisementData(data: Buffer): Partial<RawMeasurement> {
  const result: Partial<RawMeasurement> = {};

  if (data.length < 2) {
    return result;
  }

  // Try to find and parse weight object
  let offset = 0;
  while (offset < data.length - 1) {
    const objectType = data.readUInt8(offset);
    const objectLength = data.length > offset + 1 ? data.readUInt8(offset + 1) : 0;

    if (objectLength === 0 || offset + objectLength + 2 > data.length) {
      break;
    }

    const objectData = data.subarray(offset, offset + objectLength + 2);

    if (objectType === MIBEACON_OBJECT_TYPES.WEIGHT) {
      const weightData = parseWeightObject(objectData);
      if (weightData && weightData.isStable) {
        result.weightKg = Math.round(weightData.weightKg * 100) / 100;
      }
    } else if (objectType === MIBEACON_OBJECT_TYPES.IMPEDANCE) {
      const impedanceData = parseImpedanceObject(objectData);
      if (impedanceData && impedanceData.isComplete) {
        result.impedanceOhm = impedanceData.impedanceOhm;
      }
    }

    offset += objectLength + 2;
  }

  return result;
}

/**
 * Validate if a product ID matches known Mi Scale variants
 * @param productId - Product ID from MiBeacon header
 * @returns True if product ID is a known Mi Scale
 */
export function isValidMiScaleProductId(productId: number): boolean {
  return Object.values(MI_SCALE_PRODUCT_IDS).includes(productId as typeof MI_SCALE_PRODUCT_IDS[keyof typeof MI_SCALE_PRODUCT_IDS]);
}

/**
 * Extract service data UUID prefix for MiBeacon
 * The Mi Scale advertises with service UUID 0xFE95 (Xiaomi Inc.)
 */
export const XIAOMI_SERVICE_UUID = 'fe95';

/**
 * Mi Scale S400 filter for Web Bluetooth API
 */
export const MI_SCALE_FILTERS = {
  services: [XIAOMI_SERVICE_UUID],
  namePrefix: 'MIBFS'
};
