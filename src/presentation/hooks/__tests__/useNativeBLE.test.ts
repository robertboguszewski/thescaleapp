/**
 * useNativeBLE Hook Tests (TDD)
 *
 * Tests for the Native BLE hook that uses @abandonware/noble via IPC.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNativeBLE } from '../useNativeBLE';
import type { NativeBLEDevice, NativeBLEMeasurement, NativeBLEStatus, IpcResponse } from '../../../shared/types';

// Mock the window.electronAPI.nativeBLE
const mockNativeBLE = {
  startScanning: vi.fn(),
  stopScanning: vi.fn(),
  disconnect: vi.fn(),
  setDevice: vi.fn(),
  getStatus: vi.fn(),
  onMeasurement: vi.fn(),
  onConnected: vi.fn(),
  onDisconnected: vi.fn(),
  onScanning: vi.fn(),
  onDiscovered: vi.fn(),
  onError: vi.fn(),
  onReady: vi.fn(),
  onUnavailable: vi.fn(),
};

// Store event handlers for testing
const eventHandlers: Record<string, ((data?: any) => void)[]> = {
  measurement: [],
  connected: [],
  disconnected: [],
  scanning: [],
  discovered: [],
  error: [],
  ready: [],
  unavailable: [],
};

// Helper to trigger events
function triggerEvent(event: string, data?: any) {
  eventHandlers[event]?.forEach((handler) => handler(data));
}

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks();

  // Reset event handlers
  Object.keys(eventHandlers).forEach((key) => {
    eventHandlers[key] = [];
  });

  // Setup mock implementations
  mockNativeBLE.startScanning.mockResolvedValue({ success: true, data: undefined });
  mockNativeBLE.stopScanning.mockResolvedValue({ success: true, data: undefined });
  mockNativeBLE.disconnect.mockResolvedValue({ success: true, data: undefined });
  mockNativeBLE.setDevice.mockResolvedValue({ success: true, data: undefined });
  mockNativeBLE.getStatus.mockResolvedValue({
    success: true,
    data: {
      isConnected: false,
      isScanning: false,
      device: null,
      state: 'idle',
    } as NativeBLEStatus,
  });

  // Setup event subscription mocks
  mockNativeBLE.onMeasurement.mockImplementation((handler) => {
    eventHandlers.measurement.push(handler);
    return () => {
      eventHandlers.measurement = eventHandlers.measurement.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onConnected.mockImplementation((handler) => {
    eventHandlers.connected.push(handler);
    return () => {
      eventHandlers.connected = eventHandlers.connected.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onDisconnected.mockImplementation((handler) => {
    eventHandlers.disconnected.push(handler);
    return () => {
      eventHandlers.disconnected = eventHandlers.disconnected.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onScanning.mockImplementation((handler) => {
    eventHandlers.scanning.push(handler);
    return () => {
      eventHandlers.scanning = eventHandlers.scanning.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onDiscovered.mockImplementation((handler) => {
    eventHandlers.discovered.push(handler);
    return () => {
      eventHandlers.discovered = eventHandlers.discovered.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onError.mockImplementation((handler) => {
    eventHandlers.error.push(handler);
    return () => {
      eventHandlers.error = eventHandlers.error.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onReady.mockImplementation((handler) => {
    eventHandlers.ready.push(handler);
    return () => {
      eventHandlers.ready = eventHandlers.ready.filter((h) => h !== handler);
    };
  });

  mockNativeBLE.onUnavailable.mockImplementation((handler) => {
    eventHandlers.unavailable.push(handler);
    return () => {
      eventHandlers.unavailable = eventHandlers.unavailable.filter((h) => h !== handler);
    };
  });

  // Attach mock to window
  (window as any).electronAPI = {
    nativeBLE: mockNativeBLE,
  };
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe('useNativeBLE', () => {
  describe('initialization', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useNativeBLE());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isScanning).toBe(false);
      expect(result.current.deviceName).toBeNull();
      expect(result.current.lastMeasurement).toBeNull();
      expect(result.current.lastError).toBeNull();
    });

    it('should subscribe to all events on mount', () => {
      renderHook(() => useNativeBLE());

      expect(mockNativeBLE.onMeasurement).toHaveBeenCalled();
      expect(mockNativeBLE.onConnected).toHaveBeenCalled();
      expect(mockNativeBLE.onDisconnected).toHaveBeenCalled();
      expect(mockNativeBLE.onScanning).toHaveBeenCalled();
      expect(mockNativeBLE.onDiscovered).toHaveBeenCalled();
      expect(mockNativeBLE.onError).toHaveBeenCalled();
      expect(mockNativeBLE.onReady).toHaveBeenCalled();
      expect(mockNativeBLE.onUnavailable).toHaveBeenCalled();
    });

    it('should fetch initial status on mount', async () => {
      mockNativeBLE.getStatus.mockResolvedValueOnce({
        success: true,
        data: {
          isConnected: true,
          isScanning: false,
          device: { id: '123', name: 'MIBFS' },
          state: 'connected',
        },
      });

      const { result } = renderHook(() => useNativeBLE());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.deviceName).toBe('MIBFS');
      });
    });

    it('should unsubscribe from all events on unmount', () => {
      const { unmount } = renderHook(() => useNativeBLE());

      unmount();

      // All event handler arrays should be empty after unmount
      expect(eventHandlers.measurement).toHaveLength(0);
      expect(eventHandlers.connected).toHaveLength(0);
      expect(eventHandlers.disconnected).toHaveLength(0);
    });
  });

  describe('startScanning', () => {
    it('should call startScanning API', async () => {
      const { result } = renderHook(() => useNativeBLE());

      await act(async () => {
        await result.current.startScanning();
      });

      expect(mockNativeBLE.startScanning).toHaveBeenCalled();
    });

    it('should handle scanning errors', async () => {
      mockNativeBLE.startScanning.mockResolvedValueOnce({
        success: false,
        error: { code: 'BLE_ERROR', message: 'Bluetooth not available' },
      });

      const { result } = renderHook(() => useNativeBLE());

      await act(async () => {
        await result.current.startScanning();
      });

      expect(result.current.lastError).toBe('Bluetooth not available');
    });
  });

  describe('stopScanning', () => {
    it('should call stopScanning API', async () => {
      const { result } = renderHook(() => useNativeBLE());

      await act(async () => {
        await result.current.stopScanning();
      });

      expect(mockNativeBLE.stopScanning).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should call disconnect API', async () => {
      const { result } = renderHook(() => useNativeBLE());

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockNativeBLE.disconnect).toHaveBeenCalled();
    });
  });

  describe('setDevice', () => {
    it('should call setDevice API with MAC address', async () => {
      const { result } = renderHook(() => useNativeBLE());

      await act(async () => {
        await result.current.setDevice('11:22:33:44:55:66');
      });

      expect(mockNativeBLE.setDevice).toHaveBeenCalledWith('11:22:33:44:55:66');
    });
  });

  describe('event handling', () => {
    it('should update state on measurement event', async () => {
      const { result } = renderHook(() => useNativeBLE());

      const measurement: NativeBLEMeasurement = {
        weightKg: 70.5,
        impedanceOhm: 500,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        triggerEvent('measurement', measurement);
      });

      expect(result.current.lastMeasurement).toEqual(measurement);
    });

    it('should update state on connected event', () => {
      const { result } = renderHook(() => useNativeBLE());

      const device: NativeBLEDevice = { id: '123', name: 'MIBFS' };

      act(() => {
        triggerEvent('connected', device);
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.deviceName).toBe('MIBFS');
    });

    it('should update state on disconnected event', () => {
      const { result } = renderHook(() => useNativeBLE());

      // First connect
      act(() => {
        triggerEvent('connected', { id: '123', name: 'MIBFS' });
      });

      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      act(() => {
        triggerEvent('disconnected');
      });

      expect(result.current.isConnected).toBe(false);
    });

    it('should update state on scanning event', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('scanning');
      });

      expect(result.current.isScanning).toBe(true);
    });

    it('should update state on discovered event', () => {
      const { result } = renderHook(() => useNativeBLE());

      const device: NativeBLEDevice = { id: '123', name: 'MIBFS' };

      act(() => {
        triggerEvent('discovered', device);
      });

      expect(result.current.discoveredDevices).toContainEqual(device);
    });

    it('should not add duplicate discovered devices', () => {
      const { result } = renderHook(() => useNativeBLE());

      const device: NativeBLEDevice = { id: '123', name: 'MIBFS' };

      act(() => {
        triggerEvent('discovered', device);
        triggerEvent('discovered', device);
      });

      expect(result.current.discoveredDevices.filter((d) => d.id === '123')).toHaveLength(1);
    });

    it('should update state on error event', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('error', 'Connection failed');
      });

      expect(result.current.lastError).toBe('Connection failed');
    });

    it('should update isReady on ready event', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('ready');
      });

      expect(result.current.isReady).toBe(true);
    });

    it('should update isReady on unavailable event', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('ready');
      });

      expect(result.current.isReady).toBe(true);

      act(() => {
        triggerEvent('unavailable', 'poweredOff');
      });

      expect(result.current.isReady).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear the last error', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('error', 'Some error');
      });

      expect(result.current.lastError).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.lastError).toBeNull();
    });
  });

  describe('clearDiscoveredDevices', () => {
    it('should clear discovered devices list', () => {
      const { result } = renderHook(() => useNativeBLE());

      act(() => {
        triggerEvent('discovered', { id: '1', name: 'Device1' });
        triggerEvent('discovered', { id: '2', name: 'Device2' });
      });

      expect(result.current.discoveredDevices).toHaveLength(2);

      act(() => {
        result.current.clearDiscoveredDevices();
      });

      expect(result.current.discoveredDevices).toHaveLength(0);
    });
  });

  describe('onMeasurement callback', () => {
    it('should call provided onMeasurement callback when measurement received', () => {
      const onMeasurement = vi.fn();
      const { result } = renderHook(() => useNativeBLE({ onMeasurement }));

      const measurement: NativeBLEMeasurement = {
        weightKg: 70.5,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        triggerEvent('measurement', measurement);
      });

      expect(onMeasurement).toHaveBeenCalledWith(measurement);
    });
  });

  describe('auto-start scanning', () => {
    it('should auto-start scanning when autoStart is true', async () => {
      mockNativeBLE.getStatus.mockResolvedValueOnce({
        success: true,
        data: {
          isConnected: false,
          isScanning: false,
          device: null,
          state: 'idle',
        },
      });

      renderHook(() => useNativeBLE({ autoStart: true }));

      // Wait for the hook to initialize and auto-start
      await waitFor(() => {
        expect(mockNativeBLE.startScanning).toHaveBeenCalled();
      });
    });

    it('should not auto-start scanning when already connected', async () => {
      mockNativeBLE.getStatus.mockResolvedValueOnce({
        success: true,
        data: {
          isConnected: true,
          isScanning: false,
          device: { id: '123', name: 'MIBFS' },
          state: 'connected',
        },
      });

      renderHook(() => useNativeBLE({ autoStart: true }));

      await waitFor(() => {
        expect(mockNativeBLE.getStatus).toHaveBeenCalled();
      });

      // Should not start scanning when already connected
      expect(mockNativeBLE.startScanning).not.toHaveBeenCalled();
    });
  });
});
