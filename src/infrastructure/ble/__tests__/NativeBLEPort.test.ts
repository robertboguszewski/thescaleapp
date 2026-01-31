/**
 * NativeBLEPort Tests (TDD)
 *
 * Tests for the BLEPort implementation that wraps NobleBLEAdapter.
 * Verifies correct integration with Clean Architecture port interface.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';

import { NativeBLEPort, isNativeBLEAvailable, type NativeBLEPortConfig } from '../NativeBLEPort';
import type { INoble } from '../../../main/ble/NobleBLEAdapter';
import type { BLEConnectionState, BLEError, BLEDeviceInfo } from '../../../application/ports/BLEPort';
import type { RawMeasurement } from '../../../domain/calculations/types';

// Create mock noble for dependency injection
function createMockNoble(): INoble & {
  startScanningAsync: ReturnType<typeof vi.fn>;
  stopScanningAsync: ReturnType<typeof vi.fn>;
} {
  const mockNoble = new EventEmitter() as any;
  mockNoble.state = 'poweredOn';
  mockNoble.startScanningAsync = vi.fn().mockResolvedValue(undefined);
  mockNoble.stopScanningAsync = vi.fn().mockResolvedValue(undefined);
  return mockNoble;
}

// Helper to create mock peripheral
function createMockPeripheral(options: {
  id: string;
  name?: string;
  manufacturerData?: Buffer;
  rssi?: number;
}): any {
  const peripheral = new EventEmitter() as any;
  peripheral.id = options.id;
  peripheral.rssi = options.rssi || -50;
  peripheral.advertisement = {
    localName: options.name || 'Unknown',
    manufacturerData: options.manufacturerData,
  };
  peripheral.connectAsync = vi.fn().mockResolvedValue(undefined);
  peripheral.disconnectAsync = vi.fn().mockResolvedValue(undefined);
  peripheral.discoverServicesAsync = vi.fn().mockResolvedValue([]);
  return peripheral;
}

// Helper to create valid Mi Scale advertisement data
function createMiScaleAdvertisement(weightKg: number, stabilized = true): Buffer {
  const data = Buffer.alloc(14);
  data[0] = stabilized ? 0x20 : 0x00; // Stabilized flag
  data.writeUInt16LE(Math.round(weightKg * 200), 11); // Weight in 5g units
  return data;
}

describe('NativeBLEPort', () => {
  let port: NativeBLEPort;
  let mockNoble: ReturnType<typeof createMockNoble>;
  let defaultConfig: NativeBLEPortConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNoble = createMockNoble();
    defaultConfig = {
      scanTimeoutMs: 10000,
      connectTimeoutMs: 5000,
      readTimeoutMs: 5000,
      autoConnect: false,
    };
  });

  afterEach(async () => {
    // Flush all pending timers and promises
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    if (port) {
      await port.dispose();
    }
    // Small delay to allow any remaining async operations to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe('initialization', () => {
    it('should create port with default config', () => {
      port = new NativeBLEPort({}, mockNoble);
      expect(port).toBeInstanceOf(NativeBLEPort);
    });

    it('should create port with custom config', () => {
      port = new NativeBLEPort({
        scanTimeoutMs: 60000,
        connectTimeoutMs: 15000,
      }, mockNoble);
      expect(port).toBeInstanceOf(NativeBLEPort);
    });

    it('should start in disconnected state', () => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
      expect(port.getState()).toBe('disconnected');
    });
  });

  describe('getState', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should return disconnected state initially', () => {
      expect(port.getState()).toBe('disconnected');
    });

    it('should return scanning state when scanning', async () => {
      const startPromise = port.scanForDevices(1000);
      await vi.advanceTimersByTimeAsync(0);
      expect(port.getState()).toBe('scanning');
      await vi.advanceTimersByTimeAsync(1000);
      await startPromise;
    });
  });

  describe('onStateChange', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should call callback on state change', async () => {
      const callback = vi.fn();
      port.onStateChange(callback);

      const scanPromise = port.scanForDevices(1000);
      await vi.advanceTimersByTimeAsync(0);

      expect(callback).toHaveBeenCalledWith('scanning');

      await vi.advanceTimersByTimeAsync(1000);
      await scanPromise;
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = port.onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should not call callback after unsubscribe', async () => {
      const callback = vi.fn();
      const unsubscribe = port.onStateChange(callback);
      unsubscribe();

      const scanPromise = port.scanForDevices(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await scanPromise;

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should call callback on error', () => {
      const callback = vi.fn();
      port.onError(callback);

      // Simulate Bluetooth unavailable
      mockNoble.emit('stateChange', 'poweredOff');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BLUETOOTH_OFF',
          recoverable: true,
        })
      );
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = port.onError(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should not call callback after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = port.onError(callback);
      unsubscribe();

      mockNoble.emit('stateChange', 'poweredOff');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onDeviceDiscovered', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should call callback when device is discovered', async () => {
      const callback = vi.fn();
      port.onDeviceDiscovered(callback);

      const scanPromise = port.scanForDevices(2000);
      await vi.advanceTimersByTimeAsync(0);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        rssi: -65,
      });
      mockNoble.emit('discover', peripheral);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          mac: '11:22:33:44:55:66',
          name: 'MIBFS',
          rssi: -65,
        })
      );

      await vi.advanceTimersByTimeAsync(2000);
      await scanPromise;
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = port.onDeviceDiscovered(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('scanForDevices', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should return empty array when no devices found', async () => {
      const devicesPromise = port.scanForDevices(1000);
      await vi.advanceTimersByTimeAsync(1000);
      const devices = await devicesPromise;

      expect(devices).toEqual([]);
    });

    it('should return discovered devices', async () => {
      const devicesPromise = port.scanForDevices(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Discover device
      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        rssi: -65,
      });
      mockNoble.emit('discover', peripheral);

      await vi.advanceTimersByTimeAsync(2000);
      const devices = await devicesPromise;

      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual({
        mac: '11:22:33:44:55:66',
        name: 'MIBFS',
        rssi: -65,
      });
    });

    it('should not include duplicate devices', async () => {
      const devicesPromise = port.scanForDevices(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Discover same device twice
      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });
      mockNoble.emit('discover', peripheral);
      mockNoble.emit('discover', peripheral);

      await vi.advanceTimersByTimeAsync(2000);
      const devices = await devicesPromise;

      expect(devices).toHaveLength(1);
    });

    it('should include multiple different devices', async () => {
      const devicesPromise = port.scanForDevices(2000);
      await vi.advanceTimersByTimeAsync(0);

      // Discover two different devices
      mockNoble.emit('discover', createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      }));
      mockNoble.emit('discover', createMockPeripheral({
        id: 'AA:BB:CC:DD:EE:FF',
        name: 'MIBCS',
      }));

      await vi.advanceTimersByTimeAsync(2000);
      const devices = await devicesPromise;

      expect(devices).toHaveLength(2);
    });

    it('should stop scanning after timeout', async () => {
      const devicesPromise = port.scanForDevices(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await devicesPromise;

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
    });
  });

  describe('stopScan', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should stop scanning', async () => {
      const scanPromise = port.scanForDevices(5000);
      await vi.advanceTimersByTimeAsync(0);

      port.stopScan();

      await vi.advanceTimersByTimeAsync(5000);
      await scanPromise;

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should set state to disconnected', async () => {
      await port.disconnect();
      expect(port.getState()).toBe('disconnected');
    });
  });

  describe('readMeasurement', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should resolve with measurement when received', async () => {
      // Ensure adapter is in poweredOn state first
      mockNoble.emit('stateChange', 'poweredOn');

      // Create weight data through advertisement
      const measurementPromise = port.readMeasurement();

      // Discover device with weight data
      const manufacturerData = createMiScaleAdvertisement(70.5, true);
      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        manufacturerData,
      });
      mockNoble.emit('discover', peripheral);

      const measurement = await measurementPromise;

      expect(measurement.weightKg).toBe(70.5);
    });

    it('should timeout if no measurement received', async () => {
      // Register error handler to prevent unhandled rejection
      const errorHandler = vi.fn();
      port.onError(errorHandler);

      // Catch rejection inline to prevent unhandled rejection warning
      const readPromise = port.readMeasurement().catch((e) => e);
      await vi.advanceTimersByTimeAsync(5000);

      const error = await readPromise;
      expect(error).toBeDefined();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'READ_FAILED' })
      );
    });

    it('should deduplicate measurements within time window', async () => {
      // Register error handler to prevent unhandled rejection
      const errorHandler = vi.fn();
      port.onError(errorHandler);

      mockNoble.emit('stateChange', 'poweredOn');

      // First measurement
      const manufacturerData1 = createMiScaleAdvertisement(70.5, true);
      const peripheral1 = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        manufacturerData: manufacturerData1,
      });
      mockNoble.emit('discover', peripheral1);

      // Store the pending measurement
      const firstMeasurement = await port.readMeasurement();
      expect(firstMeasurement.weightKg).toBe(70.5);

      // Second measurement immediately (should be deduplicated)
      const manufacturerData2 = createMiScaleAdvertisement(70.5, true);
      const peripheral2 = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        manufacturerData: manufacturerData2,
      });
      mockNoble.emit('discover', peripheral2);

      // This should timeout because duplicate was ignored
      // Catch rejection inline to prevent unhandled rejection warning
      const secondPromise = port.readMeasurement().catch((e) => e);
      await vi.advanceTimersByTimeAsync(5000);

      const error = await secondPromise;
      expect(error).toBeDefined();
    });
  });

  describe('isDeviceAvailable', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should return false when no device configured', async () => {
      const availablePromise = port.isDeviceAvailable();
      await vi.advanceTimersByTimeAsync(5000);
      const available = await availablePromise;

      expect(available).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should emit BLUETOOTH_OFF error when bluetooth unavailable', () => {
      const errorCallback = vi.fn();
      port.onError(errorCallback);

      mockNoble.emit('stateChange', 'poweredOff');

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BLUETOOTH_OFF',
          recoverable: true,
          suggestion: expect.any(String),
        })
      );
    });

    it('should update state to error on bluetooth unavailable', () => {
      mockNoble.emit('stateChange', 'poweredOff');
      expect(port.getState()).toBe('error');
    });
  });

  describe('BLEPort interface compliance', () => {
    beforeEach(() => {
      port = new NativeBLEPort(defaultConfig, mockNoble);
    });

    it('should implement getState', () => {
      expect(typeof port.getState).toBe('function');
      expect(port.getState()).toBeDefined();
    });

    it('should implement onStateChange', () => {
      expect(typeof port.onStateChange).toBe('function');
      const unsubscribe = port.onStateChange(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('should implement onError', () => {
      expect(typeof port.onError).toBe('function');
      const unsubscribe = port.onError(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('should implement onDeviceDiscovered', () => {
      expect(typeof port.onDeviceDiscovered).toBe('function');
      const unsubscribe = port.onDeviceDiscovered(() => {});
      expect(typeof unsubscribe).toBe('function');
    });

    it('should implement scan', () => {
      expect(typeof port.scan).toBe('function');
    });

    it('should implement scanForDevices', () => {
      expect(typeof port.scanForDevices).toBe('function');
    });

    it('should implement stopScan', () => {
      expect(typeof port.stopScan).toBe('function');
    });

    it('should implement connect', () => {
      expect(typeof port.connect).toBe('function');
    });

    it('should implement disconnect', () => {
      expect(typeof port.disconnect).toBe('function');
    });

    it('should implement readMeasurement', () => {
      expect(typeof port.readMeasurement).toBe('function');
    });

    it('should implement isDeviceAvailable', () => {
      expect(typeof port.isDeviceAvailable).toBe('function');
    });
  });

  describe('dispose', () => {
    it('should cleanup all resources', async () => {
      port = new NativeBLEPort(defaultConfig, mockNoble);

      const stateCallback = vi.fn();
      const errorCallback = vi.fn();
      const discoveredCallback = vi.fn();

      port.onStateChange(stateCallback);
      port.onError(errorCallback);
      port.onDeviceDiscovered(discoveredCallback);

      await port.dispose();

      // Trigger events - callbacks should not be called
      mockNoble.emit('stateChange', 'poweredOff');

      // After dispose, callbacks should have been cleared
      // The error callback was registered before dispose, so it won't be called after
      // We can verify dispose worked by checking that subsequent events don't trigger anything
      expect(stateCallback).not.toHaveBeenCalledWith('error');
    });
  });

  describe('timeout configuration', () => {
    it('should use custom scan timeout', async () => {
      port = new NativeBLEPort({ scanTimeoutMs: 2000 }, mockNoble);

      const devicesPromise = port.scanForDevices();
      await vi.advanceTimersByTimeAsync(2000);
      await devicesPromise;

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
    });

    it('should use custom read timeout', async () => {
      port = new NativeBLEPort({ readTimeoutMs: 3000 }, mockNoble);

      // Register error handler to prevent unhandled rejection
      const errorHandler = vi.fn();
      port.onError(errorHandler);

      // Catch rejection inline to prevent unhandled rejection warning
      const readPromise = port.readMeasurement().catch((e) => e);
      await vi.advanceTimersByTimeAsync(3000);

      const error = await readPromise;
      expect(error).toBeDefined();
    });
  });
});

describe('isNativeBLEAvailable', () => {
  it('should return false when noble is not installed', () => {
    // In test environment, noble is not installed
    const available = isNativeBLEAvailable();
    expect(available).toBe(false);
  });
});
