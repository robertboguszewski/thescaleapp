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
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * Measurement debounce time in milliseconds
 */
const MEASUREMENT_DEBOUNCE_MS = 5000;

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
  deviceName: string | null;

  // Real-time measurement data
  liveWeight: number | null;
  liveHeartRate: number | null;
  liveImpedance: number | null;
  isStable: boolean;

  // Measurement data (centralized - for BLEService)
  lastMeasurement: RawMeasurement | null;
  lastMeasurementTimestamp: number;

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
  setLiveHeartRate: (heartRate: number | null) => void;
  setLiveImpedance: (impedance: number | null) => void;
  setIsStable: (stable: boolean) => void;

  setIsScanning: (scanning: boolean) => void;
  setScanTimeout: (timeout: number) => void;
  addDiscoveredDevice: (device: BLEDeviceInfo) => void;
  clearDiscoveredDevices: () => void;

  setAutoConnect: (auto: boolean) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;

  /**
   * Handle incoming measurement with debouncing
   * Returns true if measurement was accepted, false if debounced
   */
  handleMeasurement: (measurement: RawMeasurement) => boolean;

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
  deviceName: null,
  liveWeight: null,
  liveHeartRate: null,
  liveImpedance: null,
  isStable: false,
  // Centralized measurement state
  lastMeasurement: null as RawMeasurement | null,
  lastMeasurementTimestamp: 0,
  // Scanning
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
          set({ liveWeight: null, liveHeartRate: null, liveImpedance: null, isStable: false });
        }
      },

      setLastError: (lastError) => set({ lastError }),

      setDeviceConfig: (config) =>
        set({
          deviceMac: config.deviceMac ?? get().deviceMac,
          bleKey: config.bleKey ?? get().bleKey,
          deviceName: config.deviceName ?? get().deviceName,
        }),

      clearDeviceConfig: () =>
        set({
          deviceMac: null,
          bleKey: null,
          deviceName: null,
        }),

      setLiveWeight: (liveWeight) => set({ liveWeight }),

      setLiveHeartRate: (liveHeartRate) => set({ liveHeartRate }),

      setLiveImpedance: (liveImpedance) => set({ liveImpedance }),

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

      handleMeasurement: (measurement) => {
        const now = Date.now();
        const lastTimestamp = get().lastMeasurementTimestamp;

        // Debounce: ignore measurements within MEASUREMENT_DEBOUNCE_MS
        if (now - lastTimestamp < MEASUREMENT_DEBOUNCE_MS) {
          console.log('[bleStore] Measurement debounced (too soon after last)');
          return false;
        }

        // Validate measurement range (2-300 kg is realistic for humans)
        if (measurement.weightKg < 2 || measurement.weightKg > 300) {
          console.log('[bleStore] Measurement rejected (invalid range):', measurement.weightKg);
          return false;
        }

        // Accept measurement
        set({
          lastMeasurement: measurement,
          lastMeasurementTimestamp: now,
          liveWeight: measurement.weightKg,
          isStable: true,
        });

        console.log('[bleStore] Measurement accepted:', measurement.weightKg, 'kg');
        return true;
      },

      reset: () =>
        set((state) => ({
          ...initialState,
          // Keep device config and auto-connect preference
          deviceMac: state.deviceMac,
          bleKey: state.bleKey,
          deviceName: state.deviceName,
          autoConnect: state.autoConnect,
        })),
    }),
    {
      name: 'thescale-ble-storage',
      // Persist device configuration and preferences
      partialize: (state) => ({
        deviceMac: state.deviceMac,
        bleKey: state.bleKey,
        deviceName: state.deviceName,
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
 * Get user-friendly status message (translation key)
 * Components using this should call t() on the returned key
 */
export const getStatusMessage = (state: BLEConnectionState): string => {
  const messages: Record<BLEConnectionState, string> = {
    disconnected: 'ble:status.disconnected',
    scanning: 'ble:status.scanning',
    connecting: 'ble:status.connecting',
    connected: 'ble:status.connected',
    reading: 'ble:status.reading',
    error: 'ble:status.error',
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
