/**
 * NobleBLEAdapter Tests (TDD)
 *
 * Tests written BEFORE implementation following TDD methodology.
 * Uses mocked Noble to test adapter behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';

import { NobleBLEAdapter, type INoble } from '../NobleBLEAdapter';
import type { BLEAdapterConfig } from '../BLETypes';

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

let mockNoble: ReturnType<typeof createMockNoble>;

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

describe('NobleBLEAdapter', () => {
  let adapter: NobleBLEAdapter;
  let defaultConfig: Partial<BLEAdapterConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNoble = createMockNoble();

    defaultConfig = {
      autoConnect: false,
      scanInterval: 5000,
      scanTimeout: 30000,
    };
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.disconnect();
      adapter.removeAllListeners();
    }
  });

  describe('initialization', () => {
    it('should create adapter with default config', () => {
      adapter = new NobleBLEAdapter({}, mockNoble);
      expect(adapter).toBeInstanceOf(NobleBLEAdapter);
    });

    it('should create adapter with custom config', () => {
      adapter = new NobleBLEAdapter({
        deviceMac: '11:22:33:44:55:66',
        autoConnect: false,
        scanInterval: 10000,
      }, mockNoble);
      expect(adapter).toBeInstanceOf(NobleBLEAdapter);
    });

    it('should emit ready when bluetooth is powered on', async () => {
      const readyHandler = vi.fn();
      adapter = new NobleBLEAdapter(defaultConfig, mockNoble);
      adapter.on('ready', readyHandler);

      // Simulate state change
      mockNoble.emit('stateChange', 'poweredOn');

      expect(readyHandler).toHaveBeenCalled();
    });

    it('should emit unavailable when bluetooth is not powered on', () => {
      const unavailableHandler = vi.fn();
      adapter = new NobleBLEAdapter(defaultConfig, mockNoble);
      adapter.on('unavailable', unavailableHandler);

      mockNoble.emit('stateChange', 'poweredOff');

      expect(unavailableHandler).toHaveBeenCalledWith('poweredOff');
    });
  });

  describe('scanning', () => {
    beforeEach(() => {
      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);
    });

    it('should start scanning when requested', async () => {
      await adapter.startScanning();
      expect(mockNoble.startScanningAsync).toHaveBeenCalled();
    });

    it('should scan for Mi Scale services', async () => {
      await adapter.startScanning();
      expect(mockNoble.startScanningAsync).toHaveBeenCalledWith(
        expect.arrayContaining(['181b', '181d']),
        true // allowDuplicates
      );
    });

    it('should emit scanning event when scan starts', async () => {
      const scanningHandler = vi.fn();
      adapter.on('scanning', scanningHandler);

      await adapter.startScanning();
      expect(scanningHandler).toHaveBeenCalled();
    });

    it('should not start scanning if already scanning', async () => {
      await adapter.startScanning();
      await adapter.startScanning();

      expect(mockNoble.startScanningAsync).toHaveBeenCalledTimes(1);
    });

    it('should stop scanning when requested', async () => {
      await adapter.startScanning();
      await adapter.stopScanning();

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
    });

    it('should not stop scanning if not scanning', async () => {
      await adapter.stopScanning();
      expect(mockNoble.stopScanningAsync).not.toHaveBeenCalled();
    });

    it('should not start scanning when bluetooth is not powered on', async () => {
      mockNoble.state = 'poweredOff';
      await adapter.startScanning();

      expect(mockNoble.startScanningAsync).not.toHaveBeenCalled();
    });
  });

  describe('device discovery', () => {
    beforeEach(() => {
      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);
    });

    it('should emit discovered event for Mi Scale devices', () => {
      const discoveredHandler = vi.fn();
      adapter.on('discovered', discoveredHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      mockNoble.emit('discover', peripheral);

      expect(discoveredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        })
      );
    });

    it('should ignore non-Mi Scale devices', () => {
      const discoveredHandler = vi.fn();
      adapter.on('discovered', discoveredHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'RandomDevice',
      });

      mockNoble.emit('discover', peripheral);

      expect(discoveredHandler).not.toHaveBeenCalled();
    });

    it('should recognize various Mi Scale name patterns', () => {
      const discoveredHandler = vi.fn();
      adapter.on('discovered', discoveredHandler);

      const patterns = ['MIBFS', 'MIBCS', 'XMTZC01', 'MI_SCALE', 'Mi Scale 2'];

      patterns.forEach((name, i) => {
        const peripheral = createMockPeripheral({
          id: `11:22:33:44:55:${i.toString(16).padStart(2, '0')}`,
          name,
        });
        mockNoble.emit('discover', peripheral);
      });

      expect(discoveredHandler).toHaveBeenCalledTimes(patterns.length);
    });

    it('should only connect to saved device when deviceMac is set', () => {
      adapter = new NobleBLEAdapter({
        ...defaultConfig,
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        autoConnect: true,
      }, mockNoble);

      const connectingHandler = vi.fn();
      adapter.on('connecting', connectingHandler);

      // Different device discovered
      const otherPeripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      mockNoble.emit('discover', otherPeripheral);

      // Should not try to connect to a different device
      expect(connectingHandler).not.toHaveBeenCalled();
    });
  });

  describe('connection', () => {
    beforeEach(() => {
      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);
    });

    // TDD Tests for isConnecting flag (race condition protection)
    describe('isConnecting race condition protection', () => {
      it('should prevent concurrent connection attempts', async () => {
        const peripheral = createMockPeripheral({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        });
        // Make connection slow enough to test race condition
        let resolveConnect: (() => void) | undefined;
        peripheral.connectAsync.mockImplementation(() =>
          new Promise<void>(resolve => { resolveConnect = resolve; })
        );

        // Start two concurrent connection attempts
        const promise1 = adapter['connectToPeripheral'](peripheral);
        // Wait a tick for the first connection to start
        await new Promise(r => setImmediate(r));
        const promise2 = adapter['connectToPeripheral'](peripheral);

        // Resolve the pending connection
        if (resolveConnect) {
          resolveConnect();
        }
        await Promise.all([promise1, promise2]);

        // connectAsync should only be called once
        expect(peripheral.connectAsync).toHaveBeenCalledTimes(1);
      });

      it('should set isConnecting to true during connection attempt', async () => {
        const peripheral = createMockPeripheral({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        });

        let resolveConnect: () => void;
        peripheral.connectAsync.mockImplementation(() =>
          new Promise<void>(resolve => { resolveConnect = resolve; })
        );

        // Start connection but don't await
        const connectPromise = adapter['connectToPeripheral'](peripheral);

        // Wait a tick for sync code to execute
        await new Promise(r => setImmediate(r));

        // Should be connecting now
        expect(adapter['isConnecting']).toBe(true);

        // Finish connection
        resolveConnect!();
        await connectPromise;
      });

      it('should reset isConnecting to false after successful connection', async () => {
        const peripheral = createMockPeripheral({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        });

        await adapter['connectToPeripheral'](peripheral);

        expect(adapter['isConnecting']).toBe(false);
      });

      it('should reset isConnecting to false after connection failure', async () => {
        const errorHandler = vi.fn();
        adapter.on('error', errorHandler);

        const peripheral = createMockPeripheral({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        });
        peripheral.connectAsync.mockRejectedValue(new Error('Connection failed'));

        await adapter['connectToPeripheral'](peripheral);

        expect(adapter['isConnecting']).toBe(false);
        expect(errorHandler).toHaveBeenCalled();
      });

      it('should not emit connecting event for rejected concurrent attempts', async () => {
        const connectingHandler = vi.fn();
        adapter.on('connecting', connectingHandler);

        const peripheral = createMockPeripheral({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        });

        let resolveConnect: () => void;
        peripheral.connectAsync.mockImplementation(() =>
          new Promise<void>(resolve => { resolveConnect = resolve; })
        );

        // Start first connection
        const promise1 = adapter['connectToPeripheral'](peripheral);
        await new Promise(r => setImmediate(r));

        // Start second connection (should be rejected)
        const promise2 = adapter['connectToPeripheral'](peripheral);

        // Resolve the first connection
        resolveConnect!();
        await Promise.all([promise1, promise2]);

        // connecting event should only be emitted once
        expect(connectingHandler).toHaveBeenCalledTimes(1);
      });
    });

    it('should emit connecting event when connecting', async () => {
      const connectingHandler = vi.fn();
      adapter.on('connecting', connectingHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      // Start async connection (don't await)
      const connectPromise = adapter['connectToPeripheral'](peripheral);

      // Wait a tick for the sync part to execute
      await new Promise(r => setImmediate(r));

      expect(connectingHandler).toHaveBeenCalledWith('11:22:33:44:55:66');

      await connectPromise;
    });

    it('should emit connected event after successful connection', async () => {
      const connectedHandler = vi.fn();
      adapter.on('connected', connectedHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);

      expect(connectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '11:22:33:44:55:66',
          name: 'MIBFS',
        })
      );
    });

    it('should stop scanning before connecting', async () => {
      await adapter.startScanning();
      mockNoble.stopScanningAsync.mockClear();

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
    });

    it('should report isConnected correctly', async () => {
      expect(adapter.isConnected()).toBe(false);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);

      expect(adapter.isConnected()).toBe(true);
    });

    it('should return connected device info', async () => {
      expect(adapter.getConnectedDevice()).toBeNull();

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);

      const device = adapter.getConnectedDevice();
      expect(device).toEqual({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });
    });

    it('should emit error on connection failure', async () => {
      const errorHandler = vi.fn();
      adapter.on('error', errorHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });
      peripheral.connectAsync.mockRejectedValue(new Error('Connection failed'));

      await adapter['connectToPeripheral'](peripheral);

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('disconnection', () => {
    beforeEach(() => {
      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);
    });

    it('should emit disconnected event on peripheral disconnect', async () => {
      const disconnectedHandler = vi.fn();
      adapter.on('disconnected', disconnectedHandler);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);

      // Simulate peripheral disconnect
      peripheral.emit('disconnect');

      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should clear connected peripheral on disconnect', async () => {
      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      expect(adapter.isConnected()).toBe(true);

      peripheral.emit('disconnect');

      expect(adapter.isConnected()).toBe(false);
    });

    it('should schedule reconnect after disconnect when autoConnect is true', async () => {
      vi.useFakeTimers();

      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: true }, mockNoble);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      mockNoble.startScanningAsync.mockClear();

      peripheral.emit('disconnect');

      // Fast-forward to reconnect interval
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockNoble.startScanningAsync).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not schedule reconnect when autoConnect is false', async () => {
      vi.useFakeTimers();

      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      mockNoble.startScanningAsync.mockClear();
      peripheral.emit('disconnect');

      await vi.advanceTimersByTimeAsync(10000);

      expect(mockNoble.startScanningAsync).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should disconnect cleanly', async () => {
      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      await adapter.disconnect();

      expect(peripheral.disconnectAsync).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('measurement parsing', () => {
    beforeEach(() => {
      adapter = new NobleBLEAdapter({ ...defaultConfig, autoConnect: false }, mockNoble);
    });

    it('should emit measurement when advertisement contains valid weight data', () => {
      const measurementHandler = vi.fn();
      adapter.on('measurement', measurementHandler);

      // Create valid Mi Scale advertisement data
      const manufacturerData = Buffer.alloc(14);
      manufacturerData[0] = 0x20; // Stabilized flag
      manufacturerData.writeUInt16LE(14000, 11); // 70kg

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        manufacturerData,
      });

      mockNoble.emit('discover', peripheral);

      expect(measurementHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          weightKg: 70,
        })
      );
    });

    it('should not emit measurement for unstable weight', () => {
      const measurementHandler = vi.fn();
      adapter.on('measurement', measurementHandler);

      const manufacturerData = Buffer.alloc(14);
      manufacturerData[0] = 0x00; // Not stabilized
      manufacturerData.writeUInt16LE(14000, 11);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
        manufacturerData,
      });

      mockNoble.emit('discover', peripheral);

      expect(measurementHandler).not.toHaveBeenCalled();
    });
  });

  describe('device MAC management', () => {
    it('should allow setting device MAC', () => {
      adapter = new NobleBLEAdapter({}, mockNoble);
      adapter.setDeviceMac('11:22:33:44:55:66');

      // MAC should be stored (internal state)
      expect(adapter['config'].deviceMac).toBe('11:22:33:44:55:66');
    });

    it('should allow clearing device MAC', () => {
      adapter = new NobleBLEAdapter({ deviceMac: '11:22:33:44:55:66' }, mockNoble);
      adapter.setDeviceMac(null);

      expect(adapter['config'].deviceMac).toBeNull();
    });
  });

  describe('state management', () => {
    it('should return idle state initially', () => {
      adapter = new NobleBLEAdapter({ autoConnect: false });
      expect(adapter.getState()).toBe('idle');
    });

    it('should return scanning state when scanning', async () => {
      adapter = new NobleBLEAdapter({ autoConnect: false }, mockNoble);
      await adapter.startScanning();
      expect(adapter.getState()).toBe('scanning');
    });

    it('should return connected state when connected', async () => {
      adapter = new NobleBLEAdapter({ autoConnect: false });

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      expect(adapter.getState()).toBe('connected');
    });

    it('should return disconnected state after disconnect', async () => {
      adapter = new NobleBLEAdapter({ autoConnect: false });

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter['connectToPeripheral'](peripheral);
      peripheral.emit('disconnect');

      expect(adapter.getState()).toBe('disconnected');
    });
  });

  describe('cleanup', () => {
    it('should remove all listeners on cleanup', () => {
      adapter = new NobleBLEAdapter({}, mockNoble);
      adapter.on('measurement', vi.fn());
      adapter.on('connected', vi.fn());

      adapter.removeAllListeners();

      expect(adapter.listenerCount('measurement')).toBe(0);
      expect(adapter.listenerCount('connected')).toBe(0);
    });

    it('should stop scanning and disconnect on cleanup', async () => {
      adapter = new NobleBLEAdapter({ autoConnect: false }, mockNoble);

      const peripheral = createMockPeripheral({
        id: '11:22:33:44:55:66',
        name: 'MIBFS',
      });

      await adapter.startScanning();
      mockNoble.stopScanningAsync.mockClear();
      await adapter['connectToPeripheral'](peripheral);

      await adapter.disconnect();

      expect(mockNoble.stopScanningAsync).toHaveBeenCalled();
      expect(peripheral.disconnectAsync).toHaveBeenCalled();
    });
  });
});
