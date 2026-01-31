/**
 * Xiaomi Cloud Store
 *
 * Zustand store for managing Xiaomi cloud authentication and device retrieval.
 * Handles QR code login flow and BLE key extraction.
 *
 * @module presentation/stores/xiaomiStore
 */

import { create } from 'zustand';
import type {
  QRLoginSession,
  QRLoginStatus,
  XiaomiCloudDevice,
  BLEKeyResult,
  XiaomiRegion,
} from '../../shared/types';

/**
 * Xiaomi cloud state interface
 */
interface XiaomiState {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // QR Login state
  qrSession: QRLoginSession | null;
  loginStatus: QRLoginStatus | null;
  isPolling: boolean;

  // Device state
  devices: XiaomiCloudDevice[];
  selectedDevice: XiaomiCloudDevice | null;
  bleKey: BLEKeyResult | null;

  // Region selection
  selectedRegion: XiaomiRegion;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (authenticated: boolean) => void;

  setQRSession: (session: QRLoginSession | null) => void;
  setLoginStatus: (status: QRLoginStatus | null) => void;
  setIsPolling: (polling: boolean) => void;

  setDevices: (devices: XiaomiCloudDevice[]) => void;
  setSelectedDevice: (device: XiaomiCloudDevice | null) => void;
  setBLEKey: (key: BLEKeyResult | null) => void;

  setSelectedRegion: (region: XiaomiRegion) => void;

  reset: () => void;
}

/**
 * Initial state
 */
const initialState = {
  isAuthenticated: false,
  isLoading: false,
  error: null,
  qrSession: null,
  loginStatus: null,
  isPolling: false,
  devices: [] as XiaomiCloudDevice[],
  selectedDevice: null,
  bleKey: null,
  selectedRegion: 'de' as XiaomiRegion,
};

/**
 * Create the Xiaomi store
 */
export const useXiaomiStore = create<XiaomiState>()((set) => ({
  ...initialState,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  setQRSession: (qrSession) => set({ qrSession }),
  setLoginStatus: (loginStatus) => set({ loginStatus }),
  setIsPolling: (isPolling) => set({ isPolling }),

  setDevices: (devices) => set({ devices }),
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setBLEKey: (bleKey) => set({ bleKey }),

  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),

  reset: () => set(initialState),
}));

/**
 * Selector for BLE devices only (Mi Scale is BLE)
 */
export const useBLEDevices = () =>
  useXiaomiStore((state) => state.devices.filter((d) => d.isBLE));

/**
 * Selector for Mi Scale devices (model contains 'scale' or name is 'MIBFS')
 */
export const useMiScaleDevices = () =>
  useXiaomiStore((state) =>
    state.devices.filter(
      (d) =>
        d.isBLE &&
        (d.model.toLowerCase().includes('scale') ||
          d.name.toLowerCase().includes('scale') ||
          d.name === 'MIBFS' ||
          d.model.includes('miscale'))
    )
  );
