/**
 * useBLE Hook
 *
 * Consolidated BLE hook that provides access to BLE state and operations.
 * Uses the BLEContext for actions and bleStore for state.
 *
 * This is the primary hook for components to interact with BLE functionality.
 * It replaces the scattered state management from multiple hook instances.
 *
 * @module presentation/hooks/useBLE
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useBLEContext } from '../contexts/BLEContext';
import { useBLEStore } from '../stores/bleStore';
import type { BLEConnectionState, BLEError, BLEDeviceInfo } from '../../application/ports/BLEPort';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * BLE Hook Return Type
 */
export interface UseBLEReturn {
  // Connection state
  connectionState: BLEConnectionState;
  isConnected: boolean;
  isScanning: boolean;
  isConnecting: boolean;

  // Device info
  deviceName: string | null;
  deviceMac: string | null;

  // Measurement data
  liveWeight: number | null;
  isStable: boolean;
  lastMeasurement: RawMeasurement | null;

  // Discovered devices (during scanning)
  discoveredDevices: BLEDeviceInfo[];

  // Error handling
  lastError: BLEError | null;
  clearError: () => void;

  // Actions
  startScanning: () => Promise<boolean>;
  stopScanning: () => Promise<boolean>;
  setDevice: (mac: string) => Promise<boolean>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;

  // Status helpers
  getStatusMessage: () => string;
  getStatusColor: () => string;
}

/**
 * Status message translation keys
 */
const statusMessageKeys: Record<BLEConnectionState, string> = {
  disconnected: 'status.disconnected',
  scanning: 'status.scanning',
  connecting: 'status.connecting',
  connected: 'status.connected',
  reading: 'status.reading',
  error: 'status.error',
};

/**
 * Tailwind color classes for connection states
 */
const statusColors: Record<BLEConnectionState, string> = {
  disconnected: 'text-gray-500',
  scanning: 'text-yellow-500',
  connecting: 'text-yellow-500',
  connected: 'text-green-500',
  reading: 'text-blue-500',
  error: 'text-red-500',
};

/**
 * Consolidated BLE Hook
 *
 * Provides unified access to BLE functionality through the BLEContext and bleStore.
 * This is the recommended way for components to interact with BLE.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, liveWeight, startScanning, connectionState } = useBLE();
 *
 *   if (!isConnected) {
 *     return <button onClick={startScanning}>Connect</button>;
 *   }
 *
 *   return <div>Weight: {liveWeight} kg</div>;
 * }
 * ```
 */
export function useBLE(): UseBLEReturn {
  const { t } = useTranslation('ble');
  // Get context (provides service actions)
  const context = useBLEContext();

  // Get state from store (single source of truth)
  const connectionState = useBLEStore((state) => state.connectionState);
  const deviceName = useBLEStore((state) => state.deviceName);
  const deviceMac = useBLEStore((state) => state.deviceMac);
  const liveWeight = useBLEStore((state) => state.liveWeight);
  const isStable = useBLEStore((state) => state.isStable);
  const lastMeasurement = useBLEStore((state) => state.lastMeasurement);
  const lastError = useBLEStore((state) => state.lastError);
  const isScanning = useBLEStore((state) => state.isScanning);
  const discoveredDevices = useBLEStore((state) => state.discoveredDevices);

  // Store actions
  const setLastError = useBLEStore((state) => state.setLastError);
  const setConnectionState = useBLEStore((state) => state.setConnectionState);
  const setDeviceConfig = useBLEStore((state) => state.setDeviceConfig);

  // Derived state
  const isConnected = connectionState === 'connected' || connectionState === 'reading';
  const isConnecting = connectionState === 'connecting';

  // Clear error action
  const clearError = useCallback(() => {
    setLastError(null);
  }, [setLastError]);

  // Start scanning action
  const startScanning = useCallback(async (): Promise<boolean> => {
    setConnectionState('scanning');
    return context.startScanning();
  }, [context, setConnectionState]);

  // Stop scanning action
  const stopScanning = useCallback(async (): Promise<boolean> => {
    const result = await context.stopScanning();
    if (result) {
      setConnectionState('disconnected');
    }
    return result;
  }, [context, setConnectionState]);

  // Set device action
  const setDevice = useCallback(
    async (mac: string): Promise<boolean> => {
      const result = await context.setDevice(mac);
      if (result) {
        setDeviceConfig({ deviceMac: mac });
      }
      return result;
    },
    [context, setDeviceConfig]
  );

  // Connect action - starts scanning for configured device
  const connect = useCallback(async (): Promise<boolean> => {
    if (!deviceMac) {
      console.warn('[useBLE] Cannot connect - no device MAC configured');
      return false;
    }

    setConnectionState('connecting');
    await context.setDevice(deviceMac);
    return context.startScanning();
  }, [context, deviceMac, setConnectionState]);

  // Disconnect action
  const disconnect = useCallback(async (): Promise<void> => {
    await context.stopScanning();
    setConnectionState('disconnected');
  }, [context, setConnectionState]);

  // Get status message
  const getStatusMessage = useCallback((): string => {
    const key = statusMessageKeys[connectionState];
    return key ? t(key) : t('status.disconnected');
  }, [connectionState, t]);

  // Get status color
  const getStatusColor = useCallback((): string => {
    return statusColors[connectionState] || 'text-gray-500';
  }, [connectionState]);

  return {
    // Connection state
    connectionState,
    isConnected,
    isScanning,
    isConnecting,

    // Device info
    deviceName,
    deviceMac,

    // Measurement data
    liveWeight,
    isStable,
    lastMeasurement,

    // Discovered devices
    discoveredDevices,

    // Error handling
    lastError,
    clearError,

    // Actions
    startScanning,
    stopScanning,
    setDevice,
    connect,
    disconnect,

    // Status helpers
    getStatusMessage,
    getStatusColor,
  };
}

/**
 * Export type for external use
 */
export type { BLEConnectionState, BLEError, BLEDeviceInfo, RawMeasurement };
