/**
 * Tests for BLE Store - Device Name Feature
 *
 * TDD tests for:
 * - Device name storage in BLEState
 * - setDeviceConfig with deviceName
 * - clearDeviceConfig clears deviceName
 * - Initial state has null deviceName
 *
 * @module presentation/stores/__tests__/bleStore.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useBLEStore } from '../bleStore';

describe('BLE Store - Device Name', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useBLEStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have null deviceName in initial state', () => {
      const state = useBLEStore.getState();
      expect(state.deviceName).toBeNull();
    });

    it('should have null deviceMac in initial state', () => {
      const state = useBLEStore.getState();
      expect(state.deviceMac).toBeNull();
    });

    it('should have null bleKey in initial state', () => {
      const state = useBLEStore.getState();
      expect(state.bleKey).toBeNull();
    });
  });

  describe('setDeviceConfig', () => {
    it('should set deviceName when provided', () => {
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'abc123',
          deviceName: 'Xiaomi Scale S400',
        });
      });

      const state = useBLEStore.getState();
      expect(state.deviceName).toBe('Xiaomi Scale S400');
    });

    it('should preserve existing deviceName when not provided in config', () => {
      // First set a device name
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'abc123',
          deviceName: 'Mi Scale',
        });
      });

      // Then update only MAC
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceMac: '11:22:33:44:55:66',
        });
      });

      const state = useBLEStore.getState();
      expect(state.deviceName).toBe('Mi Scale');
      expect(state.deviceMac).toBe('11:22:33:44:55:66');
    });

    it('should set all device config fields at once', () => {
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'secretkey123',
          deviceName: 'Test Scale',
        });
      });

      const state = useBLEStore.getState();
      expect(state.deviceMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(state.bleKey).toBe('secretkey123');
      expect(state.deviceName).toBe('Test Scale');
    });

    it('should allow updating deviceName to a new value', () => {
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceName: 'Old Name',
        });
      });

      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceName: 'New Name',
        });
      });

      expect(useBLEStore.getState().deviceName).toBe('New Name');
    });
  });

  describe('clearDeviceConfig', () => {
    it('should clear deviceName along with other config', () => {
      // Set device config
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'abc123',
          deviceName: 'Mi Scale',
        });
      });

      // Verify it was set
      expect(useBLEStore.getState().deviceName).toBe('Mi Scale');

      // Clear config
      act(() => {
        useBLEStore.getState().clearDeviceConfig();
      });

      // Verify all are cleared
      const state = useBLEStore.getState();
      expect(state.deviceMac).toBeNull();
      expect(state.bleKey).toBeNull();
      expect(state.deviceName).toBeNull();
    });
  });

  describe('reset', () => {
    it('should preserve deviceName after reset (keeps device config)', () => {
      act(() => {
        useBLEStore.getState().setDeviceConfig({
          deviceName: 'Test Scale',
          deviceMac: 'AA:BB:CC:DD:EE:FF',
        });
      });

      act(() => {
        useBLEStore.getState().reset();
      });

      // Reset preserves device config (deviceMac, bleKey, deviceName, autoConnect)
      const state = useBLEStore.getState();
      expect(state.deviceName).toBe('Test Scale');
      expect(state.deviceMac).toBe('AA:BB:CC:DD:EE:FF');
      // But resets connection state
      expect(state.connectionState).toBe('disconnected');
      expect(state.liveWeight).toBeNull();
    });
  });
});
