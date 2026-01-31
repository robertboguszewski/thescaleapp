/**
 * useWebBluetooth Hook
 *
 * React hook for direct Web Bluetooth communication with Mi Scale.
 * Uses the Web Bluetooth API available in Electron renderer.
 *
 * @module presentation/hooks/useWebBluetooth
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * Standard BLE Service UUIDs for body composition scales
 */
const SERVICE_UUIDS = {
  /** Standard Body Composition Service */
  BODY_COMPOSITION: 0x181b,
  /** Standard Weight Scale Service */
  WEIGHT_SCALE: 0x181d,
  /** Xiaomi MiBeacon service - must be full UUID format for Web Bluetooth */
  XIAOMI: 0xfe95,
} as const;

/**
 * Standard BLE Characteristic UUIDs
 */
const CHARACTERISTIC_UUIDS = {
  /** Body Composition Measurement - notifications */
  BODY_COMPOSITION_MEASUREMENT: 0x2a9c,
  /** Weight Measurement - notifications */
  WEIGHT_MEASUREMENT: 0x2a9d,
} as const;

/**
 * Convert UUID number to full UUID string
 */
function uuidFromNumber(uuid: number): string {
  return `0000${uuid.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
}

/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

/**
 * Hook return type
 */
interface UseWebBluetoothReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Error message if any */
  error: string | null;
  /** Connected device name */
  deviceName: string | null;
  /** Whether Web Bluetooth is available */
  isAvailable: boolean;
  /** Scan and connect to device */
  connect: () => Promise<boolean>;
  /** Disconnect from device */
  disconnect: () => void;
  /** Read measurement (waits for stable reading) */
  readMeasurement: () => Promise<RawMeasurement | null>;
  /** Current/last raw measurement */
  lastMeasurement: RawMeasurement | null;
}

/**
 * Parse weight from standard BLE Weight Measurement characteristic
 */
function parseWeightMeasurement(dataView: DataView): number | null {
  if (dataView.byteLength < 3) return null;

  // Flags byte
  const flags = dataView.getUint8(0);
  const isImperial = (flags & 0x01) !== 0;

  // Weight is at offset 1, 2 bytes, little-endian
  const weightRaw = dataView.getUint16(1, true);

  let weightKg: number;
  if (isImperial) {
    // Convert from 0.01 lb to kg
    weightKg = (weightRaw * 0.01) * 0.453592;
  } else {
    // Metric: resolution depends on scale
    // Mi Scale 2 uses 0.01 kg (10g) resolution
    weightKg = weightRaw * 0.01;
  }

  console.log('[WebBLE] Weight parsed:', { flags, isImperial, weightRaw, weightKg });
  return weightKg;
}

/**
 * Parse body composition from standard BLE Body Composition Measurement characteristic
 */
function parseBodyCompositionMeasurement(dataView: DataView): Partial<RawMeasurement> | null {
  if (dataView.byteLength < 4) return null;

  const result: Partial<RawMeasurement> = {};

  // Flags (2 bytes)
  const flags = dataView.getUint16(0, true);
  const isImperial = (flags & 0x0001) !== 0;
  const hasImpedance = (flags & 0x0200) !== 0;
  const hasWeight = (flags & 0x0400) !== 0;

  let offset = 2;

  // Body Fat Percentage (mandatory, after flags)
  if (dataView.byteLength > offset + 1) {
    const bodyFatRaw = dataView.getUint16(offset, true);
    offset += 2;
    // Body fat is in 0.1% resolution
    const bodyFatPercent = bodyFatRaw * 0.1;
    console.log('[WebBLE] Body fat:', bodyFatPercent, '%');
  }

  // Skip timestamp if present
  const hasTimestamp = (flags & 0x0002) !== 0;
  if (hasTimestamp) offset += 7;

  // Skip user ID if present
  const hasUserId = (flags & 0x0004) !== 0;
  if (hasUserId) offset += 1;

  // Skip BMI/height if present
  const hasBmiHeight = (flags & 0x0008) !== 0;
  if (hasBmiHeight) offset += 4;

  // Weight
  if (hasWeight && dataView.byteLength > offset + 1) {
    const weightRaw = dataView.getUint16(offset, true);
    offset += 2;
    if (isImperial) {
      result.weightKg = (weightRaw * 0.01) * 0.453592;
    } else {
      result.weightKg = weightRaw * 0.005;
    }
  }

  // Skip height
  const hasHeight = (flags & 0x0800) !== 0;
  if (hasHeight) offset += 2;

  // Skip muscle/fat mass fields
  if ((flags & 0x0010) !== 0) offset += 2; // muscle percentage
  if ((flags & 0x0020) !== 0) offset += 2; // muscle mass
  if ((flags & 0x0040) !== 0) offset += 2; // fat free mass
  if ((flags & 0x0080) !== 0) offset += 2; // soft lean mass
  if ((flags & 0x0100) !== 0) offset += 2; // body water

  // Impedance
  if (hasImpedance && dataView.byteLength > offset + 1) {
    const impedanceRaw = dataView.getUint16(offset, true);
    result.impedanceOhm = impedanceRaw * 0.1;
    console.log('[WebBLE] Impedance:', result.impedanceOhm, 'ohm');
  }

  console.log('[WebBLE] Body composition parsed:', result);
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Hook for Web Bluetooth communication with Mi Scale
 */
export function useWebBluetooth(): UseWebBluetoothReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<RawMeasurement | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const characteristicsRef = useRef<BluetoothRemoteGATTCharacteristic[]>([]);

  /**
   * Check if Web Bluetooth is available
   */
  const isAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  /**
   * Clean up connections
   */
  const cleanup = useCallback(() => {
    // Stop notifications
    characteristicsRef.current.forEach(async (char) => {
      try {
        await char.stopNotifications();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    characteristicsRef.current = [];

    // Disconnect
    if (serverRef.current?.connected) {
      serverRef.current.disconnect();
    }
    serverRef.current = null;
    deviceRef.current = null;
  }, []);

  /**
   * Connect to the scale
   */
  const connect = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      setError('Web Bluetooth is not available');
      return false;
    }

    setConnectionState('connecting');
    setError(null);

    try {
      // Request device with multiple filter strategies
      console.log('[WebBLE] Requesting device...');
      console.log('[WebBLE] Please step on the scale to wake it up!');

      // Use acceptAllDevices for broader discovery
      // Mi Scale names vary: MIBFS, MIBCS, XMTZC, MI_SCALE, etc.
      const device = await navigator.bluetooth.requestDevice({
        // Accept all devices but filter by services
        acceptAllDevices: true,
        optionalServices: [
          uuidFromNumber(SERVICE_UUIDS.BODY_COMPOSITION),
          uuidFromNumber(SERVICE_UUIDS.WEIGHT_SCALE),
          uuidFromNumber(SERVICE_UUIDS.XIAOMI),
          // Generic Access service (most devices have this)
          '00001800-0000-1000-8000-00805f9b34fb',
        ],
      });

      console.log('[WebBLE] Available device:', device.name, device.id);

      deviceRef.current = device;
      setDeviceName(device.name || 'Mi Scale');
      console.log('[WebBLE] Device selected:', device.name);

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('[WebBLE] Device disconnected');
        setConnectionState('disconnected');
        cleanup();
      });

      // Connect to GATT server
      console.log('[WebBLE] Connecting to GATT server...');
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }
      serverRef.current = server;

      console.log('[WebBLE] Connected!');
      setConnectionState('connected');
      return true;
    } catch (err) {
      console.error('[WebBLE] Connection error:', err);
      setConnectionState('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
      cleanup();
      return false;
    }
  }, [isAvailable, cleanup]);

  /**
   * Disconnect from the scale
   */
  const disconnect = useCallback(() => {
    cleanup();
    setConnectionState('disconnected');
    setDeviceName(null);
  }, [cleanup]);

  /**
   * Read measurement from the scale
   * Waits for a stable reading (when user steps off)
   */
  const readMeasurement = useCallback(async (): Promise<RawMeasurement | null> => {
    if (!serverRef.current?.connected) {
      // Try to reconnect
      const connected = await connect();
      if (!connected) {
        setError('Not connected to device');
        return null;
      }
    }

    setConnectionState('reading');
    setError(null);

    try {
      const server = serverRef.current!;
      let measurement: Partial<RawMeasurement> = {};

      // Try Body Composition Service first
      try {
        console.log('[WebBLE] Trying Body Composition Service...');
        const bcService = await server.getPrimaryService(
          uuidFromNumber(SERVICE_UUIDS.BODY_COMPOSITION)
        );
        const bcChar = await bcService.getCharacteristic(
          uuidFromNumber(CHARACTERISTIC_UUIDS.BODY_COMPOSITION_MEASUREMENT)
        );

        measurement = await new Promise<Partial<RawMeasurement>>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for body composition measurement'));
          }, 60000); // 60 second timeout

          let stableReading: Partial<RawMeasurement> | null = null;

          const handler = (event: Event) => {
            const char = event.target as BluetoothRemoteGATTCharacteristic;
            const value = char.value;
            if (!value) return;

            const parsed = parseBodyCompositionMeasurement(value);
            if (parsed?.weightKg) {
              console.log('[WebBLE] Body composition received:', parsed);
              stableReading = parsed;

              // Check for stable reading (flags indicate measurement complete)
              const flags = value.getUint16(0, true);
              const isStable = (flags & 0x2000) !== 0 || parsed.impedanceOhm !== undefined;

              if (isStable) {
                clearTimeout(timeout);
                bcChar.removeEventListener('characteristicvaluechanged', handler);
                resolve(stableReading);
              }
            }
          };

          bcChar.addEventListener('characteristicvaluechanged', handler);
          bcChar.startNotifications().catch(reject);

          characteristicsRef.current.push(bcChar);
        });
      } catch (bcError) {
        console.log('[WebBLE] Body Composition Service not available:', bcError);
      }

      // If no body composition, try Weight Scale Service
      if (!measurement.weightKg) {
        try {
          console.log('[WebBLE] Trying Weight Scale Service...');
          const wsService = await server.getPrimaryService(
            uuidFromNumber(SERVICE_UUIDS.WEIGHT_SCALE)
          );
          const wsChar = await wsService.getCharacteristic(
            uuidFromNumber(CHARACTERISTIC_UUIDS.WEIGHT_MEASUREMENT)
          );

          const weight = await new Promise<number>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for weight measurement'));
            }, 60000);

            let lastWeight = 0;
            let stableCount = 0;

            const handler = (event: Event) => {
              const char = event.target as BluetoothRemoteGATTCharacteristic;
              const value = char.value;
              if (!value) return;

              const weight = parseWeightMeasurement(value);
              if (weight !== null) {
                console.log('[WebBLE] Weight received:', weight, 'kg');

                // Check for stable reading
                if (Math.abs(weight - lastWeight) < 0.1) {
                  stableCount++;
                } else {
                  stableCount = 0;
                }
                lastWeight = weight;

                // Consider stable after 3 consistent readings or if flags indicate stability
                const flags = value.getUint8(0);
                const isStable = (flags & 0x20) !== 0 || stableCount >= 3;

                if (isStable) {
                  clearTimeout(timeout);
                  wsChar.removeEventListener('characteristicvaluechanged', handler);
                  resolve(weight);
                }
              }
            };

            wsChar.addEventListener('characteristicvaluechanged', handler);
            wsChar.startNotifications().catch(reject);

            characteristicsRef.current.push(wsChar);
          });

          measurement.weightKg = weight;
        } catch (wsError) {
          console.log('[WebBLE] Weight Scale Service not available:', wsError);
        }
      }

      // Ensure we have at least weight
      if (!measurement.weightKg) {
        throw new Error('Could not read weight from scale');
      }

      const result: RawMeasurement = {
        weightKg: Math.round(measurement.weightKg * 100) / 100,
        impedanceOhm: measurement.impedanceOhm,
      };

      console.log('[WebBLE] Final measurement:', result);
      setLastMeasurement(result);
      setConnectionState('connected');
      return result;
    } catch (err) {
      console.error('[WebBLE] Read error:', err);
      setConnectionState('error');
      setError(err instanceof Error ? err.message : 'Read failed');
      return null;
    }
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionState,
    error,
    deviceName,
    isAvailable,
    connect,
    disconnect,
    readMeasurement,
    lastMeasurement,
  };
}

export default useWebBluetooth;
