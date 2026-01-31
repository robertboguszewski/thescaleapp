/**
 * Bluetooth Device Selector Tests (TDD)
 *
 * Tests for the device selection logic.
 * Key test: Only connect to configured device, never to random devices.
 *
 * @module main/ble/__tests__/BluetoothDeviceSelector.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  selectDevice,
  BluetoothDeviceSelectorManager,
  DEFAULT_MI_SCALE_PATTERNS,
  type BluetoothDevice,
} from '../BluetoothDeviceSelector';

describe('selectDevice', () => {
  const configWithSavedDevice = {
    scanTimeoutMs: 60000,
    savedDeviceMac: 'saved-device-mac-123',
    miScalePatterns: DEFAULT_MI_SCALE_PATTERNS,
  };

  const configFirstTimeSetup = {
    scanTimeoutMs: 60000,
    miScalePatterns: DEFAULT_MI_SCALE_PATTERNS,
    // No savedDeviceMac - first-time setup
  };

  describe('with saved device (normal operation)', () => {
    it('should select ONLY the saved device when found', () => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'other-device', deviceName: 'Samsung Soundbar' },
        { deviceId: 'saved-device-mac-123', deviceName: 'MIBCS' },
        { deviceId: 'another-device', deviceName: 'iPhone' },
      ];

      const result = selectDevice(devices, configWithSavedDevice);

      expect(result.action).toBe('select');
      expect(result.deviceId).toBe('saved-device-mac-123');
    });

    it('should wait if saved device not found - NEVER select other devices', () => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'other-device', deviceName: 'Samsung Soundbar' },
        { deviceId: 'another-device', deviceName: 'iPhone' },
      ];

      const result = selectDevice(devices, configWithSavedDevice);

      expect(result.action).toBe('wait');
      expect(result.deviceId).toBeUndefined();
    });

    it('should wait silently without mentioning other devices', () => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'soundbar', deviceName: 'Samsung Soundbar' },
      ];

      const result = selectDevice(devices, configWithSavedDevice);

      // Message should NOT mention Samsung Soundbar
      expect(result.message).not.toContain('Samsung');
      expect(result.message).toContain('wagę');
    });

    it('should wait when no devices found', () => {
      const result = selectDevice([], configWithSavedDevice);

      expect(result.action).toBe('wait');
      expect(result.message).toContain('wagę');
    });
  });

  describe('first-time setup (no saved device)', () => {
    it('should auto-select Mi Scale by pattern', () => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'id-soundbar', deviceName: 'Samsung Soundbar' },
        { deviceId: 'id-scale', deviceName: 'MIBCS' },
      ];

      const result = selectDevice(devices, configFirstTimeSetup);

      expect(result.action).toBe('select');
      expect(result.deviceId).toBe('id-scale');
    });

    it.each([
      ['MIBFS', 'Mi Body Fat Scale'],
      ['MIBCS', 'Mi Body Composition Scale'],
      ['XMTZC05HM', 'Xiaomi Chinese variant'],
      ['MI_SCALE', 'MI SCALE underscore'],
      ['Mi Scale 2', 'Mi Scale with space'],
      ['Body Scale Pro', 'Body Scale variant'],
      ['Xiaomi Scale', 'Xiaomi branded'],
    ])('should recognize Mi Scale pattern "%s" (%s)', (deviceName) => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'id-scale', deviceName },
      ];

      const result = selectDevice(devices, configFirstTimeSetup);

      expect(result.action).toBe('select');
      expect(result.deviceId).toBe('id-scale');
    });

    it('should NOT auto-select random devices - wait for Mi Scale', () => {
      const devices: BluetoothDevice[] = [
        { deviceId: 'id-soundbar', deviceName: 'Samsung Soundbar' },
        { deviceId: 'id-phone', deviceName: 'iPhone' },
      ];

      const result = selectDevice(devices, configFirstTimeSetup);

      expect(result.action).toBe('wait');
      expect(result.deviceId).toBeUndefined();
    });

    it('should wait when no devices found', () => {
      const result = selectDevice([], configFirstTimeSetup);

      expect(result.action).toBe('wait');
    });
  });
});

describe('BluetoothDeviceSelectorManager', () => {
  let mockCallback: ReturnType<typeof vi.fn>;
  let mockOnStatusChange: ReturnType<typeof vi.fn>;
  let mockOnTimeout: ReturnType<typeof vi.fn>;
  let manager: BluetoothDeviceSelectorManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCallback = vi.fn();
    mockOnStatusChange = vi.fn();
    mockOnTimeout = vi.fn();

    manager = new BluetoothDeviceSelectorManager(
      { scanTimeoutMs: 60000 },
      {
        onStatusChange: mockOnStatusChange,
        onTimeout: mockOnTimeout,
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startSession', () => {
    it('should set scanning status', () => {
      manager.startSession(mockCallback);

      expect(mockOnStatusChange).toHaveBeenCalledWith({
        scanning: true,
        message: expect.stringContaining('wagę'),
      });
    });

    it('should be active after starting', () => {
      manager.startSession(mockCallback);

      expect(manager.isActive()).toBe(true);
    });
  });

  describe('setSavedDeviceMac', () => {
    it('should only select saved device when set', () => {
      manager.setSavedDeviceMac('my-scale-mac');
      manager.startSession(mockCallback);

      // Other device should be ignored
      manager.handleDevicesUpdate([
        { deviceId: 'other-device', deviceName: 'Soundbar' },
      ]);

      expect(mockCallback).not.toHaveBeenCalled();

      // Saved device should be selected
      manager.handleDevicesUpdate([
        { deviceId: 'my-scale-mac', deviceName: 'MIBCS' },
      ]);

      expect(mockCallback).toHaveBeenCalledWith('my-scale-mac');
    });
  });

  describe('timeout behavior', () => {
    it('should call onTimeout after configured time', () => {
      manager.startSession(mockCallback);

      vi.advanceTimersByTime(60000);

      expect(mockOnTimeout).toHaveBeenCalled();
    });

    it('should cancel session after timeout', () => {
      manager.startSession(mockCallback);

      vi.advanceTimersByTime(60000);

      expect(mockCallback).toHaveBeenCalledWith('');
      expect(manager.isActive()).toBe(false);
    });

    it('should NOT timeout before configured time', () => {
      manager.startSession(mockCallback);

      vi.advanceTimersByTime(59999);

      expect(mockOnTimeout).not.toHaveBeenCalled();
    });
  });

  describe('handleDevicesUpdate', () => {
    it('should auto-select Mi Scale in first-time setup', () => {
      manager.startSession(mockCallback);

      manager.handleDevicesUpdate([
        { deviceId: 'mi-scale-id', deviceName: 'MIBCS' },
      ]);

      expect(mockCallback).toHaveBeenCalledWith('mi-scale-id');
    });

    it('should NOT call callback when no devices (wait action)', () => {
      manager.startSession(mockCallback);

      const result = manager.handleDevicesUpdate([]);

      expect(result.action).toBe('wait');
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should call callback with empty string', () => {
      manager.startSession(mockCallback);

      manager.cancel();

      expect(mockCallback).toHaveBeenCalledWith('');
    });

    it('should be inactive after cancel', () => {
      manager.startSession(mockCallback);

      manager.cancel();

      expect(manager.isActive()).toBe(false);
    });
  });
});
