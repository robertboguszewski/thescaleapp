/**
 * useBLE Hook Tests
 *
 * Tests for the consolidated BLE hook.
 *
 * @vitest-environment jsdom
 * @module presentation/hooks/__tests__/useBLE.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useBLE } from '../useBLE';
import { BLEProvider } from '../../contexts/BLEContext';
import { BLEService } from '../../services/BLEService';
import { useBLEStore } from '../../stores/bleStore';

// Mock electronAPI
const mockNativeBLE = {
  onMeasurement: vi.fn().mockReturnValue(vi.fn()),
  onConnected: vi.fn().mockReturnValue(vi.fn()),
  onDisconnected: vi.fn().mockReturnValue(vi.fn()),
  onScanning: vi.fn().mockReturnValue(vi.fn()),
  onDiscovered: vi.fn().mockReturnValue(vi.fn()),
  onError: vi.fn().mockReturnValue(vi.fn()),
  onReady: vi.fn().mockReturnValue(vi.fn()),
  onUnavailable: vi.fn().mockReturnValue(vi.fn()),
  startScanning: vi.fn().mockResolvedValue({ success: true }),
  stopScanning: vi.fn().mockResolvedValue({ success: true }),
  setDevice: vi.fn().mockResolvedValue({ success: true }),
  getStatus: vi.fn().mockResolvedValue({ success: true, data: { isConnected: false, isScanning: false } }),
};

const mockElectronAPI = {
  nativeBLE: mockNativeBLE,
  onBluetoothScanningStatus: vi.fn().mockReturnValue(vi.fn()),
  onBluetoothScanTimeout: vi.fn().mockReturnValue(vi.fn()),
};

describe('useBLE', () => {
  beforeEach(() => {
    BLEService.resetInstance();
    useBLEStore.getState().reset();
    useBLEStore.getState().clearDeviceConfig();
    (window as any).electronAPI = mockElectronAPI;
    vi.clearAllMocks();
  });

  afterEach(() => {
    BLEService.resetInstance();
    delete (window as any).electronAPI;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(BLEProvider, null, children);

  describe('Initial State', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isScanning).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.liveWeight).toBeNull();
      expect(result.current.lastMeasurement).toBeNull();
      expect(result.current.lastError).toBeNull();
    });
  });

  describe('State Derivation', () => {
    it('should derive isConnected correctly', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Initially disconnected
      expect(result.current.isConnected).toBe(false);

      // Simulate connection
      act(() => {
        useBLEStore.getState().setConnectionState('connected');
      });

      expect(result.current.isConnected).toBe(true);

      // Also connected when reading
      act(() => {
        useBLEStore.getState().setConnectionState('reading');
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('should derive isConnecting correctly', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      expect(result.current.isConnecting).toBe(false);

      act(() => {
        useBLEStore.getState().setConnectionState('connecting');
      });

      expect(result.current.isConnecting).toBe(true);
    });
  });

  describe('Actions', () => {
    it('should start scanning', async () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.startScanning();
      });

      expect(success).toBe(true);
      expect(mockNativeBLE.startScanning).toHaveBeenCalled();
      expect(result.current.connectionState).toBe('scanning');
    });

    it('should stop scanning', async () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Start scanning first
      await act(async () => {
        await result.current.startScanning();
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.stopScanning();
      });

      expect(success).toBe(true);
      expect(mockNativeBLE.stopScanning).toHaveBeenCalled();
    });

    it('should set device', async () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.setDevice('00:11:22:33:44:55');
      });

      expect(success).toBe(true);
      expect(mockNativeBLE.setDevice).toHaveBeenCalledWith('00:11:22:33:44:55');
      expect(result.current.deviceMac).toBe('00:11:22:33:44:55');
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Set an error first
      act(() => {
        useBLEStore.getState().setLastError({
          code: 'TEST_ERROR',
          message: 'Test error',
          recoverable: true,
        });
      });

      expect(result.current.lastError).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.lastError).toBeNull();
    });
  });

  describe('Status Helpers', () => {
    it('should return correct status message', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      expect(result.current.getStatusMessage()).toBe('Rozlaczono');

      act(() => {
        useBLEStore.getState().setConnectionState('connected');
      });

      expect(result.current.getStatusMessage()).toBe('Polaczono');

      act(() => {
        useBLEStore.getState().setConnectionState('scanning');
      });

      expect(result.current.getStatusMessage()).toBe('Szukam wagi...');
    });

    it('should return correct status color', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      expect(result.current.getStatusColor()).toBe('text-gray-500');

      act(() => {
        useBLEStore.getState().setConnectionState('connected');
      });

      expect(result.current.getStatusColor()).toBe('text-green-500');

      act(() => {
        useBLEStore.getState().setConnectionState('error');
      });

      expect(result.current.getStatusColor()).toBe('text-red-500');
    });
  });

  describe('Connect/Disconnect', () => {
    it('should connect when device is configured', async () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Configure device first
      await act(async () => {
        await result.current.setDevice('00:11:22:33:44:55');
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(true);
      expect(mockNativeBLE.setDevice).toHaveBeenCalledWith('00:11:22:33:44:55');
      expect(mockNativeBLE.startScanning).toHaveBeenCalled();
    });

    it('should not connect when no device is configured', async () => {
      // Ensure device config is cleared
      act(() => {
        useBLEStore.getState().clearDeviceConfig();
      });

      const { result } = renderHook(() => useBLE(), { wrapper });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.connect();
      });

      expect(success).toBe(false);
    });

    it('should disconnect', async () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Simulate connected state
      act(() => {
        useBLEStore.getState().setConnectionState('connected');
      });

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockNativeBLE.stopScanning).toHaveBeenCalled();
      expect(result.current.connectionState).toBe('disconnected');
    });
  });

  describe('Store Integration', () => {
    it('should reflect store state changes', () => {
      const { result } = renderHook(() => useBLE(), { wrapper });

      // Update store directly
      act(() => {
        useBLEStore.getState().setConnectionState('connected');
        useBLEStore.getState().setDeviceConfig({ deviceName: 'Mi Scale' });
        useBLEStore.getState().setLiveWeight(75.5);
        useBLEStore.getState().setIsStable(true);
      });

      expect(result.current.connectionState).toBe('connected');
      expect(result.current.deviceName).toBe('Mi Scale');
      expect(result.current.liveWeight).toBe(75.5);
      expect(result.current.isStable).toBe(true);
    });
  });
});
