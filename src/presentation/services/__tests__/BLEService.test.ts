/**
 * BLEService Tests (TDD)
 *
 * Tests for the singleton BLE service that manages all IPC subscriptions
 * and coordinates BLE state centrally.
 *
 * @vitest-environment jsdom
 * @module presentation/services/__tests__/BLEService.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BLEService } from '../BLEService';
import { useBLEStore } from '../../stores/bleStore';

// Mock electronAPI
const mockNativeBLE = {
  onMeasurement: vi.fn(),
  onConnected: vi.fn(),
  onDisconnected: vi.fn(),
  onScanning: vi.fn(),
  onDiscovered: vi.fn(),
  onError: vi.fn(),
  onReady: vi.fn(),
  onUnavailable: vi.fn(),
  startScanning: vi.fn().mockResolvedValue({ success: true }),
  stopScanning: vi.fn().mockResolvedValue({ success: true }),
  setDevice: vi.fn().mockResolvedValue({ success: true }),
  getStatus: vi.fn().mockResolvedValue({ success: true, data: { isConnected: false, isScanning: false } }),
};

const mockElectronAPI = {
  nativeBLE: mockNativeBLE,
  onBluetoothScanningStatus: vi.fn(),
  onBluetoothScanTimeout: vi.fn(),
};

describe('BLEService', () => {
  beforeEach(() => {
    // Reset singleton
    BLEService.resetInstance();

    // Reset store
    useBLEStore.getState().reset();

    // Setup mock
    (window as any).electronAPI = mockElectronAPI;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations that return unsubscribe functions
    mockNativeBLE.onMeasurement.mockReturnValue(vi.fn());
    mockNativeBLE.onConnected.mockReturnValue(vi.fn());
    mockNativeBLE.onDisconnected.mockReturnValue(vi.fn());
    mockNativeBLE.onScanning.mockReturnValue(vi.fn());
    mockNativeBLE.onDiscovered.mockReturnValue(vi.fn());
    mockNativeBLE.onError.mockReturnValue(vi.fn());
    mockNativeBLE.onReady.mockReturnValue(vi.fn());
    mockNativeBLE.onUnavailable.mockReturnValue(vi.fn());
    mockElectronAPI.onBluetoothScanningStatus.mockReturnValue(vi.fn());
    mockElectronAPI.onBluetoothScanTimeout.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    BLEService.resetInstance();
    delete (window as any).electronAPI;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BLEService.getInstance();
      const instance2 = BLEService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = BLEService.getInstance();
      BLEService.resetInstance();
      const instance2 = BLEService.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should subscribe to IPC events on initialize', () => {
      const service = BLEService.getInstance();
      service.initialize();

      expect(mockNativeBLE.onMeasurement).toHaveBeenCalledTimes(1);
      expect(mockNativeBLE.onConnected).toHaveBeenCalledTimes(1);
      expect(mockNativeBLE.onDisconnected).toHaveBeenCalledTimes(1);
    });

    it('should only initialize once (idempotent)', () => {
      const service = BLEService.getInstance();
      service.initialize();
      service.initialize();
      service.initialize();

      // Should only subscribe once
      expect(mockNativeBLE.onMeasurement).toHaveBeenCalledTimes(1);
    });

    it('should handle missing electronAPI gracefully', () => {
      delete (window as any).electronAPI;

      const service = BLEService.getInstance();

      // Should not throw
      expect(() => service.initialize()).not.toThrow();
    });
  });

  describe('Measurement Handling', () => {
    it('should update store when measurement received', () => {
      const service = BLEService.getInstance();
      service.initialize();

      // Get the callback that was passed to onMeasurement
      const measurementCallback = mockNativeBLE.onMeasurement.mock.calls[0][0];

      // Simulate measurement
      measurementCallback({ weightKg: 75.5, impedanceOhm: 500 });

      const state = useBLEStore.getState();
      expect(state.lastMeasurement).toEqual({ weightKg: 75.5, impedanceOhm: 500 });
      expect(state.liveWeight).toBe(75.5);
    });

    it('should debounce rapid measurements', () => {
      const service = BLEService.getInstance();
      service.initialize();

      const measurementCallback = mockNativeBLE.onMeasurement.mock.calls[0][0];

      // First measurement - accepted
      measurementCallback({ weightKg: 75.5 });
      expect(useBLEStore.getState().lastMeasurement?.weightKg).toBe(75.5);

      // Rapid second measurement - should be debounced
      measurementCallback({ weightKg: 76.0 });
      expect(useBLEStore.getState().lastMeasurement?.weightKg).toBe(75.5); // Still 75.5
    });

    it('should reject invalid weight values', () => {
      const service = BLEService.getInstance();
      service.initialize();

      const measurementCallback = mockNativeBLE.onMeasurement.mock.calls[0][0];

      // Invalid weight (too low)
      measurementCallback({ weightKg: 0.5 });
      expect(useBLEStore.getState().lastMeasurement).toBeNull();

      // Invalid weight (too high)
      measurementCallback({ weightKg: 500 });
      expect(useBLEStore.getState().lastMeasurement).toBeNull();
    });
  });

  describe('Connection State', () => {
    it('should update store on connected event', () => {
      const service = BLEService.getInstance();
      service.initialize();

      const connectedCallback = mockNativeBLE.onConnected.mock.calls[0][0];
      connectedCallback({ id: 'device-123', name: 'Mi Scale' });

      expect(useBLEStore.getState().connectionState).toBe('connected');
      expect(useBLEStore.getState().deviceName).toBe('Mi Scale');
    });

    it('should update store on disconnected event', () => {
      const service = BLEService.getInstance();
      service.initialize();

      // First connect
      const connectedCallback = mockNativeBLE.onConnected.mock.calls[0][0];
      connectedCallback({ id: 'device-123', name: 'Mi Scale' });

      // Then disconnect
      const disconnectedCallback = mockNativeBLE.onDisconnected.mock.calls[0][0];
      disconnectedCallback();

      expect(useBLEStore.getState().connectionState).toBe('disconnected');
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe all listeners on dispose', () => {
      const unsubMeasurement = vi.fn();
      const unsubConnected = vi.fn();
      mockNativeBLE.onMeasurement.mockReturnValue(unsubMeasurement);
      mockNativeBLE.onConnected.mockReturnValue(unsubConnected);

      const service = BLEService.getInstance();
      service.initialize();
      service.dispose();

      expect(unsubMeasurement).toHaveBeenCalled();
      expect(unsubConnected).toHaveBeenCalled();
    });

    it('should allow re-initialization after dispose', () => {
      const service = BLEService.getInstance();
      service.initialize();
      service.dispose();

      // Clear mocks after dispose
      vi.clearAllMocks();
      mockNativeBLE.onMeasurement.mockReturnValue(vi.fn());

      // Should be able to initialize again
      service.initialize();
      expect(mockNativeBLE.onMeasurement).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scanning Status', () => {
    it('should update scanning state', () => {
      const service = BLEService.getInstance();
      service.initialize();

      const scanningCallback = mockNativeBLE.onScanning.mock.calls[0][0];
      scanningCallback();

      expect(useBLEStore.getState().isScanning).toBe(true);
    });

    it('should handle Bluetooth scanning status from main process', () => {
      const service = BLEService.getInstance();
      service.initialize();

      const statusCallback = mockElectronAPI.onBluetoothScanningStatus.mock.calls[0][0];
      statusCallback({ scanning: true, message: 'Scanning...' });

      expect(useBLEStore.getState().connectionState).toBe('scanning');
    });
  });
});
