/**
 * BLE Store
 *
 * Zustand store for managing Bluetooth Low Energy connection state.
 * Handles connection status, errors, and device information.
 *
 * @module presentation/stores/bleStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BLEConnectionState, BLEError, BLEConfig, BLEDeviceInfo } from '../../application/ports/BLEPort';

/**
 * BLE state interface
 */
interface BLEState {
  // Connection state
  connectionState: BLEConnectionState;
  lastError: BLEError | null;

  // Device configuration
  deviceMac: string | null;
  bleKey: string | null;

  // Real-time measurement data
  liveWeight: number | null;
  isStable: boolean;

  // Scanning
  isScanning: boolean;
  scanTimeout: number;
  discoveredDevices: BLEDeviceInfo[];

  // Connection settings
  autoConnect: boolean;
  retryCount: number;
  maxRetries: number;

  // Actions
  setConnectionState: (state: BLEConnectionState) => void;
  setLastError: (error: BLEError | null) => void;
  setDeviceConfig: (config: Partial<BLEConfig>) => void;
  clearDeviceConfig: () => void;

  setLiveWeight: (weight: number | null) => void;
  setIsStable: (stable: boolean) => void;

  setIsScanning: (scanning: boolean) => void;
  setScanTimeout: (timeout: number) => void;
  addDiscoveredDevice: (device: BLEDeviceInfo) => void;
  clearDiscoveredDevices: () => void;

  setAutoConnect: (auto: boolean) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;

  reset: () => void;
}

/**
 * Initial state
 */
const initialState = {
  connectionState: 'disconnected' as BLEConnectionState,
  lastError: null,
  deviceMac: null,
  bleKey: null,
  liveWeight: null,
  isStable: false,
  isScanning: false,
  scanTimeout: 30000,
  discoveredDevices: [] as BLEDeviceInfo[],
  autoConnect: false,
  retryCount: 0,
  maxRetries: 3,
};

/**
 * Create the BLE store
 */
export const useBLEStore = create<BLEState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      setConnectionState: (connectionState) => {
        set({ connectionState });

        // Reset retry count on successful connection
        if (connectionState === 'connected') {
          set({ retryCount: 0, lastError: null });
        }

        // Clear live weight when disconnected
        if (connectionState === 'disconnected') {
          set({ liveWeight: null, isStable: false });
        }
      },

      setLastError: (lastError) => set({ lastError }),

      setDeviceConfig: (config) =>
        set({
          deviceMac: config.deviceMac ?? get().deviceMac,
          bleKey: config.bleKey ?? get().bleKey,
        }),

      clearDeviceConfig: () =>
        set({
          deviceMac: null,
          bleKey: null,
        }),

      setLiveWeight: (liveWeight) => set({ liveWeight }),

      setIsStable: (isStable) => set({ isStable }),

      setIsScanning: (isScanning) => set({ isScanning }),

      setScanTimeout: (scanTimeout) => set({ scanTimeout }),

      addDiscoveredDevice: (device) =>
        set((state) => {
          // Check if device already exists (by MAC address)
          const exists = state.discoveredDevices.some((d) => d.mac === device.mac);
          if (exists) {
            // Update existing device (e.g., RSSI might change)
            return {
              discoveredDevices: state.discoveredDevices.map((d) =>
                d.mac === device.mac ? device : d
              ),
            };
          }
          // Add new device
          return {
            discoveredDevices: [...state.discoveredDevices, device],
          };
        }),

      clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

      setAutoConnect: (autoConnect) => set({ autoConnect }),

      incrementRetryCount: () =>
        set((state) => ({ retryCount: state.retryCount + 1 })),

      resetRetryCount: () => set({ retryCount: 0 }),

      reset: () =>
        set((state) => ({
          ...initialState,
          // Keep device config and auto-connect preference
          deviceMac: state.deviceMac,
          bleKey: state.bleKey,
          autoConnect: state.autoConnect,
        })),
    }),
    {
      name: 'thescale-ble-storage',
      // Persist device configuration and preferences
      partialize: (state) => ({
        deviceMac: state.deviceMac,
        bleKey: state.bleKey,
        autoConnect: state.autoConnect,
        scanTimeout: state.scanTimeout,
      }),
    }
  )
);

/**
 * Selector for checking if connected
 */
export const useIsConnected = () =>
  useBLEStore((state) =>
    state.connectionState === 'connected' || state.connectionState === 'reading'
  );

/**
 * Selector for checking if busy (scanning, connecting, or reading)
 */
export const useIsBusy = () =>
  useBLEStore((state) =>
    state.connectionState === 'scanning' ||
    state.connectionState === 'connecting' ||
    state.connectionState === 'reading'
  );

/**
 * Selector for checking if has error
 */
export const useHasError = () =>
  useBLEStore((state) => state.connectionState === 'error');

/**
 * Selector for checking if device is configured
 */
export const useIsDeviceConfigured = () =>
  useBLEStore((state) => !!state.deviceMac && !!state.bleKey);

/**
 * Selector for can retry
 */
export const useCanRetry = () =>
  useBLEStore((state) => state.retryCount < state.maxRetries);

/**
 * Get user-friendly status message
 */
export const getStatusMessage = (state: BLEConnectionState): string => {
  const messages: Record<BLEConnectionState, string> = {
    disconnected: 'Rozłączono',
    scanning: 'Szukam wagi...',
    connecting: 'Łączenie...',
    connected: 'Połączono',
    reading: 'Odczyt pomiaru...',
    error: 'Błąd połączenia',
  };
  return messages[state];
};

/**
 * Get status color class
 */
export const getStatusColor = (state: BLEConnectionState): string => {
  const colors: Record<BLEConnectionState, string> = {
    disconnected: 'text-gray-500',
    scanning: 'text-yellow-500',
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
    reading: 'text-blue-500',
    error: 'text-red-500',
  };
  return colors[state];
};
