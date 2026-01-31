/**
 * useNativeBLE Hook
 *
 * React hook for interacting with Native BLE adapter via IPC.
 * Provides state management and event handling for BLE operations.
 *
 * @module presentation/hooks/useNativeBLE
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NativeBLEDevice, NativeBLEMeasurement, NativeBLEStatus } from '../../shared/types';

/**
 * Hook options
 */
export interface UseNativeBLEOptions {
  /**
   * Auto-start scanning on mount
   */
  autoStart?: boolean;

  /**
   * Callback when measurement is received
   */
  onMeasurement?: (measurement: NativeBLEMeasurement) => void;

  /**
   * Callback when connected to device
   */
  onConnected?: (device: NativeBLEDevice) => void;

  /**
   * Callback when disconnected
   */
  onDisconnected?: () => void;

  /**
   * Callback when error occurs
   */
  onError?: (error: string) => void;
}

/**
 * Hook return type
 */
export interface UseNativeBLEReturn {
  // State
  isConnected: boolean;
  isScanning: boolean;
  isReady: boolean;
  deviceName: string | null;
  lastMeasurement: NativeBLEMeasurement | null;
  lastError: string | null;
  discoveredDevices: NativeBLEDevice[];

  // Actions
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  disconnect: () => Promise<void>;
  setDevice: (mac: string) => Promise<void>;
  clearError: () => void;
  clearDiscoveredDevices: () => void;
}

/**
 * Native BLE Hook
 *
 * Manages BLE state and provides methods for scanning, connecting, and
 * receiving measurements via the Native BLE adapter.
 */
export function useNativeBLE(options: UseNativeBLEOptions = {}): UseNativeBLEReturn {
  const { autoStart = false, onMeasurement, onConnected, onDisconnected, onError } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<NativeBLEMeasurement | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<NativeBLEDevice[]>([]);

  // Refs for callbacks to avoid stale closures
  const onMeasurementRef = useRef(onMeasurement);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMeasurementRef.current = onMeasurement;
  }, [onMeasurement]);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    onDisconnectedRef.current = onDisconnected;
  }, [onDisconnected]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Get the native BLE API
  const getNativeBLE = useCallback(() => {
    const api = (window as any).electronAPI?.nativeBLE;
    if (!api) {
      console.warn('[useNativeBLE] Native BLE API not available');
      return null;
    }
    return api;
  }, []);

  // Actions
  const startScanning = useCallback(async () => {
    const api = getNativeBLE();
    if (!api) return;

    const response = await api.startScanning();
    if (!response.success && response.error) {
      setLastError(response.error.message);
      onErrorRef.current?.(response.error.message);
    }
  }, [getNativeBLE]);

  const stopScanning = useCallback(async () => {
    const api = getNativeBLE();
    if (!api) return;

    const response = await api.stopScanning();
    if (!response.success && response.error) {
      setLastError(response.error.message);
    }
    setIsScanning(false);
  }, [getNativeBLE]);

  const disconnect = useCallback(async () => {
    const api = getNativeBLE();
    if (!api) return;

    const response = await api.disconnect();
    if (!response.success && response.error) {
      setLastError(response.error.message);
    }
  }, [getNativeBLE]);

  const setDevice = useCallback(
    async (mac: string) => {
      const api = getNativeBLE();
      if (!api) return;

      const response = await api.setDevice(mac);
      if (!response.success && response.error) {
        setLastError(response.error.message);
      }
    },
    [getNativeBLE]
  );

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const clearDiscoveredDevices = useCallback(() => {
    setDiscoveredDevices([]);
  }, []);

  // Setup event listeners and fetch initial status
  useEffect(() => {
    const api = getNativeBLE();
    if (!api) return;

    // Fetch initial status
    const fetchStatus = async () => {
      const response = await api.getStatus();
      if (response.success && response.data) {
        const status: NativeBLEStatus = response.data;
        setIsConnected(status.isConnected);
        setIsScanning(status.isScanning);
        setDeviceName(status.device?.name || null);

        // Auto-start scanning if requested and not connected
        if (autoStart && !status.isConnected && !status.isScanning) {
          startScanning();
        }
      }
    };

    fetchStatus();

    // Subscribe to events
    const unsubMeasurement = api.onMeasurement((measurement: NativeBLEMeasurement) => {
      setLastMeasurement(measurement);
      onMeasurementRef.current?.(measurement);
    });

    const unsubConnected = api.onConnected((device: NativeBLEDevice) => {
      setIsConnected(true);
      setDeviceName(device.name);
      setIsScanning(false);
      onConnectedRef.current?.(device);
    });

    const unsubDisconnected = api.onDisconnected(() => {
      setIsConnected(false);
      onDisconnectedRef.current?.();
    });

    const unsubScanning = api.onScanning(() => {
      setIsScanning(true);
    });

    const unsubDiscovered = api.onDiscovered((device: NativeBLEDevice) => {
      setDiscoveredDevices((prev) => {
        // Avoid duplicates
        if (prev.some((d) => d.id === device.id)) {
          return prev;
        }
        return [...prev, device];
      });
    });

    const unsubError = api.onError((error: string) => {
      setLastError(error);
      onErrorRef.current?.(error);
    });

    const unsubReady = api.onReady(() => {
      setIsReady(true);
    });

    const unsubUnavailable = api.onUnavailable(() => {
      setIsReady(false);
    });

    // Cleanup
    return () => {
      unsubMeasurement();
      unsubConnected();
      unsubDisconnected();
      unsubScanning();
      unsubDiscovered();
      unsubError();
      unsubReady();
      unsubUnavailable();
    };
  }, [getNativeBLE, autoStart, startScanning]);

  return {
    // State
    isConnected,
    isScanning,
    isReady,
    deviceName,
    lastMeasurement,
    lastError,
    discoveredDevices,

    // Actions
    startScanning,
    stopScanning,
    disconnect,
    setDevice,
    clearError,
    clearDiscoveredDevices,
  };
}
