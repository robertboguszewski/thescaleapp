/**
 * useBLE Hook
 *
 * Custom React hook for BLE (Bluetooth Low Energy) operations.
 * Wraps IPC calls and manages Zustand store state for device connection.
 *
 * @module presentation/hooks/useBLE
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  useBLEStore,
  useIsConnected,
  useIsBusy,
  useHasError,
  useIsDeviceConfigured,
  useCanRetry,
  getStatusMessage,
} from '../stores/bleStore';
import type {
  BLEConnectionState,
  BLEError,
  BLEStateChangeEvent,
  BLEErrorEvent,
} from '../../shared/types';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * BLE configuration input
 */
interface BLEConfigInput {
  deviceMac: string;
  bleKey: string;
}

/**
 * Hook return type
 */
interface UseBLEReturn {
  // State
  connectionState: BLEConnectionState;
  lastError: BLEError | null;
  statusMessage: string;
  liveWeight: number | null;
  isStable: boolean;
  isConnected: boolean;
  isBusy: boolean;
  hasError: boolean;
  isDeviceConfigured: boolean;
  canRetry: boolean;
  retryCount: number;

  // Device config
  deviceMac: string | null;
  bleKey: string | null;

  // Actions
  scan: () => Promise<boolean>;
  connect: (config?: BLEConfigInput) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  setDeviceConfig: (config: BLEConfigInput) => void;
  clearDeviceConfig: () => void;
  setAutoConnect: (auto: boolean) => void;
  retry: () => Promise<boolean>;
  reset: () => void;
}

/**
 * Custom hook for BLE operations
 *
 * Provides a clean interface for:
 * - Scanning for devices
 * - Connecting/disconnecting from scale
 * - Managing connection state
 * - Auto-reconnect with retry logic
 *
 * @example
 * ```typescript
 * const {
 *   connectionState,
 *   isConnected,
 *   connect,
 * } = useBLE();
 *
 * // Connect to scale
 * const success = await connect({
 *   deviceMac: 'AA:BB:CC:DD:EE:FF',
 *   bleKey: 'your-ble-key',
 * });
 * ```
 */
export function useBLE(): UseBLEReturn {
  const store = useBLEStore();
  const isConnected = useIsConnected();
  const isBusy = useIsBusy();
  const hasError = useHasError();
  const isDeviceConfigured = useIsDeviceConfigured();
  const canRetry = useCanRetry();

  // Cleanup refs for event listeners
  const stateUnsubscribeRef = useRef<(() => void) | null>(null);
  const errorUnsubscribeRef = useRef<(() => void) | null>(null);

  const {
    connectionState,
    lastError,
    deviceMac,
    bleKey,
    liveWeight,
    isStable,
    retryCount,
    autoConnect,
    setConnectionState,
    setLastError,
    setDeviceConfig: setDeviceConfigInStore,
    clearDeviceConfig,
    setLiveWeight,
    setIsStable,
    setIsScanning,
    setAutoConnect,
    incrementRetryCount,
    resetRetryCount,
    reset,
  } = store;

  /**
   * Get status message for current state
   */
  const statusMessage = getStatusMessage(connectionState);

  /**
   * Subscribe to BLE state changes from main process
   */
  useEffect(() => {
    // Subscribe to state changes
    stateUnsubscribeRef.current = window.electronAPI.onBLEStateChange(
      (event: BLEStateChangeEvent) => {
        setConnectionState(event.state);

        if (event.state === 'scanning') {
          setIsScanning(true);
        } else {
          setIsScanning(false);
        }
      }
    );

    // Subscribe to errors
    errorUnsubscribeRef.current = window.electronAPI.onBLEError(
      (event: BLEErrorEvent) => {
        setLastError({
          code: event.code,
          message: event.message,
          recoverable: event.recoverable,
          suggestion: event.suggestion,
        });
        setConnectionState('error');
      }
    );

    // Cleanup on unmount
    return () => {
      if (stateUnsubscribeRef.current) {
        stateUnsubscribeRef.current();
      }
      if (errorUnsubscribeRef.current) {
        errorUnsubscribeRef.current();
      }
    };
  }, [setConnectionState, setLastError, setIsScanning]);

  /**
   * Scan for devices
   */
  const scan = useCallback(async (): Promise<boolean> => {
    setConnectionState('scanning');
    setLastError(null);

    try {
      const result = await window.electronAPI.scanForDevice();

      if (result.success) {
        return true;
      } else {
        console.error('Scan failed:', result.error);
        return false;
      }
    } catch (err) {
      console.error('Scan error:', err);
      setConnectionState('error');
      return false;
    }
  }, [setConnectionState, setLastError]);

  /**
   * Connect to the scale
   */
  const connect = useCallback(
    async (config?: BLEConfigInput): Promise<boolean> => {
      // Use provided config or stored config
      const mac = config?.deviceMac || deviceMac;
      const key = config?.bleKey || bleKey;

      if (!mac || !key) {
        console.error('Device not configured');
        setLastError({
          code: 'DEVICE_NOT_FOUND',
          message: 'Urządzenie nie jest skonfigurowane',
          recoverable: true,
          suggestion: 'Skonfiguruj urządzenie w ustawieniach',
        });
        return false;
      }

      // Save config if provided
      if (config) {
        setDeviceConfigInStore({
          deviceMac: config.deviceMac,
          bleKey: config.bleKey,
        });
      }

      setConnectionState('connecting');
      setLastError(null);

      try {
        const result = await window.electronAPI.connectDevice(mac, key);

        if (result.success) {
          setConnectionState('connected');
          resetRetryCount();
          return true;
        } else {
          console.error('Connect failed:', result.error);
          incrementRetryCount();
          return false;
        }
      } catch (err) {
        console.error('Connect error:', err);
        setConnectionState('error');
        incrementRetryCount();
        return false;
      }
    },
    [
      deviceMac,
      bleKey,
      setConnectionState,
      setLastError,
      setDeviceConfigInStore,
      resetRetryCount,
      incrementRetryCount,
    ]
  );

  /**
   * Disconnect from the scale
   */
  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      const result = await window.electronAPI.disconnectDevice();

      if (result.success) {
        setConnectionState('disconnected');
        setLiveWeight(null);
        setIsStable(false);
        return true;
      } else {
        console.error('Disconnect failed:', result.error);
        return false;
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      return false;
    }
  }, [setConnectionState, setLiveWeight, setIsStable]);

  /**
   * Set device configuration
   */
  const setDeviceConfig = useCallback(
    (config: BLEConfigInput): void => {
      setDeviceConfigInStore(config);
    },
    [setDeviceConfigInStore]
  );

  /**
   * Retry connection
   */
  const retry = useCallback(async (): Promise<boolean> => {
    if (!canRetry) {
      console.warn('Max retries reached');
      return false;
    }

    return connect();
  }, [canRetry, connect]);

  /**
   * Auto-connect on mount if configured
   */
  useEffect(() => {
    if (autoConnect && isDeviceConfigured && connectionState === 'disconnected') {
      connect();
    }
  }, [autoConnect, isDeviceConfigured]); // Only run on mount and config changes

  return {
    // State
    connectionState,
    lastError,
    statusMessage,
    liveWeight,
    isStable,
    isConnected,
    isBusy,
    hasError,
    isDeviceConfigured,
    canRetry,
    retryCount,

    // Device config
    deviceMac,
    bleKey,

    // Actions
    scan,
    connect,
    disconnect,
    setDeviceConfig,
    clearDeviceConfig,
    setAutoConnect,
    retry,
    reset,
  };
}
