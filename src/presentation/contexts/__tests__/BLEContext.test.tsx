/**
 * BLEContext Tests
 *
 * Tests for the BLE context provider and hook.
 *
 * @vitest-environment jsdom
 * @module presentation/contexts/__tests__/BLEContext.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { BLEProvider, useBLEContext } from '../BLEContext';
import { BLEService } from '../../services/BLEService';

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

describe('BLEContext', () => {
  beforeEach(() => {
    // Reset singleton
    BLEService.resetInstance();

    // Setup mock
    (window as any).electronAPI = mockElectronAPI;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    BLEService.resetInstance();
    delete (window as any).electronAPI;
  });

  describe('BLEProvider', () => {
    it('should render children', () => {
      render(
        <BLEProvider>
          <div data-testid="child">Child Content</div>
        </BLEProvider>
      );

      expect(screen.getByTestId('child')).toBeDefined();
      expect(screen.getByTestId('child').textContent).toBe('Child Content');
    });

    it('should initialize BLEService on mount', () => {
      render(
        <BLEProvider>
          <div>Content</div>
        </BLEProvider>
      );

      // BLEService should have subscribed to events
      expect(mockNativeBLE.onMeasurement).toHaveBeenCalledTimes(1);
      expect(mockNativeBLE.onConnected).toHaveBeenCalledTimes(1);
    });

    it('should provide same service instance across re-renders', () => {
      const serviceInstances: BLEService[] = [];

      function TestComponent() {
        const { service } = useBLEContext();
        serviceInstances.push(service);
        return <div>Test</div>;
      }

      const { rerender } = render(
        <BLEProvider>
          <TestComponent />
        </BLEProvider>
      );

      rerender(
        <BLEProvider>
          <TestComponent />
        </BLEProvider>
      );

      expect(serviceInstances[0]).toBe(serviceInstances[1]);
    });
  });

  describe('useBLEContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useBLEContext());
      }).toThrow('useBLEContext must be used within a BLEProvider');

      consoleSpy.mockRestore();
    });

    it('should provide context value when used inside provider', () => {
      const { result } = renderHook(() => useBLEContext(), {
        wrapper: BLEProvider,
      });

      expect(result.current).toBeDefined();
      expect(result.current.service).toBeDefined();
      expect(result.current.startScanning).toBeDefined();
      expect(result.current.stopScanning).toBeDefined();
      expect(result.current.setDevice).toBeDefined();
      expect(result.current.getStatus).toBeDefined();
    });

    it('should call startScanning on service', async () => {
      const { result } = renderHook(() => useBLEContext(), {
        wrapper: BLEProvider,
      });

      const success = await result.current.startScanning();
      expect(success).toBe(true);
      expect(mockNativeBLE.startScanning).toHaveBeenCalled();
    });

    it('should call stopScanning on service', async () => {
      const { result } = renderHook(() => useBLEContext(), {
        wrapper: BLEProvider,
      });

      const success = await result.current.stopScanning();
      expect(success).toBe(true);
      expect(mockNativeBLE.stopScanning).toHaveBeenCalled();
    });

    it('should call setDevice on service', async () => {
      const { result } = renderHook(() => useBLEContext(), {
        wrapper: BLEProvider,
      });

      const success = await result.current.setDevice('00:11:22:33:44:55');
      expect(success).toBe(true);
      expect(mockNativeBLE.setDevice).toHaveBeenCalledWith('00:11:22:33:44:55');
    });

    it('should call getStatus on service', async () => {
      const { result } = renderHook(() => useBLEContext(), {
        wrapper: BLEProvider,
      });

      const status = await result.current.getStatus();
      expect(status).toEqual({ isConnected: false, isScanning: false });
      expect(mockNativeBLE.getStatus).toHaveBeenCalled();
    });
  });
});
