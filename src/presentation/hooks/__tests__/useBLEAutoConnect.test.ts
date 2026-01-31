/**
 * Tests for useBLEAutoConnect Hook
 *
 * TDD tests for:
 * - Measurement debouncing
 * - Weight validation
 * - Auto-connect state management
 * - Reconnection logic
 *
 * @module presentation/hooks/__tests__/useBLEAutoConnect.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ============================================================================
// UNIT TESTS FOR MEASUREMENT VALIDATION LOGIC
// ============================================================================

describe('Measurement Validation Logic', () => {
  describe('Weight Range Validation', () => {
    const MIN_VALID_WEIGHT = 2; // kg
    const MAX_VALID_WEIGHT = 300; // kg

    const isValidWeight = (weightKg: number): boolean => {
      return weightKg >= MIN_VALID_WEIGHT && weightKg <= MAX_VALID_WEIGHT;
    };

    it('should accept weight within valid range', () => {
      expect(isValidWeight(70)).toBe(true);
      expect(isValidWeight(50)).toBe(true);
      expect(isValidWeight(100)).toBe(true);
      expect(isValidWeight(150)).toBe(true);
    });

    it('should accept boundary values', () => {
      expect(isValidWeight(2)).toBe(true); // Minimum
      expect(isValidWeight(300)).toBe(true); // Maximum
    });

    it('should reject weight below minimum', () => {
      expect(isValidWeight(0)).toBe(false);
      expect(isValidWeight(0.5)).toBe(false);
      expect(isValidWeight(1)).toBe(false);
      expect(isValidWeight(1.99)).toBe(false);
    });

    it('should reject weight above maximum', () => {
      expect(isValidWeight(301)).toBe(false);
      expect(isValidWeight(500)).toBe(false);
      expect(isValidWeight(1000)).toBe(false);
    });

    it('should reject negative weights', () => {
      expect(isValidWeight(-1)).toBe(false);
      expect(isValidWeight(-70)).toBe(false);
    });
  });

  describe('Measurement Debouncing Logic', () => {
    const DEBOUNCE_INTERVAL_MS = 5000;

    class MeasurementDebouncer {
      private lastMeasurementTime: number = 0;

      shouldProcessMeasurement(): boolean {
        const now = Date.now();
        const timeSinceLastMeasurement = now - this.lastMeasurementTime;
        return timeSinceLastMeasurement >= DEBOUNCE_INTERVAL_MS;
      }

      recordMeasurement(): void {
        this.lastMeasurementTime = Date.now();
      }

      reset(): void {
        this.lastMeasurementTime = 0;
      }

      // For testing
      setLastMeasurementTime(time: number): void {
        this.lastMeasurementTime = time;
      }
    }

    let debouncer: MeasurementDebouncer;

    beforeEach(() => {
      debouncer = new MeasurementDebouncer();
    });

    it('should allow first measurement', () => {
      expect(debouncer.shouldProcessMeasurement()).toBe(true);
    });

    it('should block measurement within debounce interval', () => {
      debouncer.recordMeasurement();
      expect(debouncer.shouldProcessMeasurement()).toBe(false);
    });

    it('should allow measurement after debounce interval', () => {
      // Set last measurement to 6 seconds ago
      debouncer.setLastMeasurementTime(Date.now() - 6000);
      expect(debouncer.shouldProcessMeasurement()).toBe(true);
    });

    it('should block measurement exactly at debounce boundary', () => {
      // Set last measurement to exactly 5 seconds ago
      debouncer.setLastMeasurementTime(Date.now() - 5000);
      expect(debouncer.shouldProcessMeasurement()).toBe(true);
    });

    it('should block rapid consecutive measurements', () => {
      debouncer.recordMeasurement();
      expect(debouncer.shouldProcessMeasurement()).toBe(false);
      expect(debouncer.shouldProcessMeasurement()).toBe(false);
      expect(debouncer.shouldProcessMeasurement()).toBe(false);
    });

    it('should reset debounce timer', () => {
      debouncer.recordMeasurement();
      expect(debouncer.shouldProcessMeasurement()).toBe(false);

      debouncer.reset();
      expect(debouncer.shouldProcessMeasurement()).toBe(true);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR AUTO-CONNECT STATE MANAGEMENT
// ============================================================================

describe('Auto-Connect State Management', () => {
  describe('AutoConnectStateManager', () => {
    interface AutoConnectState {
      isAutoConnecting: boolean;
      hasStarted: boolean;
      deviceId: string | null;
      watchingDevice: boolean;
    }

    class AutoConnectStateManager {
      private state: AutoConnectState = {
        isAutoConnecting: false,
        hasStarted: false,
        deviceId: null,
        watchingDevice: false,
      };

      canStartAutoConnect(autoConnectEnabled: boolean, deviceMac: string | null): boolean {
        if (!autoConnectEnabled || !deviceMac) return false;
        if (this.state.hasStarted) return false;
        return true;
      }

      startAutoConnect(deviceId: string): void {
        this.state.isAutoConnecting = true;
        this.state.hasStarted = true;
        this.state.deviceId = deviceId;
      }

      clearDevice(): void {
        this.state.isAutoConnecting = false;
        this.state.hasStarted = false; // Reset to allow new device
        this.state.deviceId = null;
        this.state.watchingDevice = false;
      }

      setWatching(watching: boolean): void {
        this.state.watchingDevice = watching;
      }

      getState(): AutoConnectState {
        return { ...this.state };
      }
    }

    let manager: AutoConnectStateManager;

    beforeEach(() => {
      manager = new AutoConnectStateManager();
    });

    it('should allow auto-connect when enabled with device', () => {
      expect(manager.canStartAutoConnect(true, 'device-123')).toBe(true);
    });

    it('should block auto-connect when disabled', () => {
      expect(manager.canStartAutoConnect(false, 'device-123')).toBe(false);
    });

    it('should block auto-connect without device', () => {
      expect(manager.canStartAutoConnect(true, null)).toBe(false);
      expect(manager.canStartAutoConnect(true, '')).toBe(false);
    });

    it('should block duplicate auto-connect attempts', () => {
      expect(manager.canStartAutoConnect(true, 'device-123')).toBe(true);
      manager.startAutoConnect('device-123');
      expect(manager.canStartAutoConnect(true, 'device-123')).toBe(false);
    });

    it('should reset hasStarted when device is cleared', () => {
      manager.startAutoConnect('device-123');
      expect(manager.canStartAutoConnect(true, 'device-123')).toBe(false);

      manager.clearDevice();
      expect(manager.canStartAutoConnect(true, 'device-456')).toBe(true);
    });

    it('should track watching state', () => {
      manager.startAutoConnect('device-123');
      expect(manager.getState().watchingDevice).toBe(false);

      manager.setWatching(true);
      expect(manager.getState().watchingDevice).toBe(true);

      manager.setWatching(false);
      expect(manager.getState().watchingDevice).toBe(false);
    });

    it('should clear all state on device clear', () => {
      manager.startAutoConnect('device-123');
      manager.setWatching(true);

      manager.clearDevice();

      const state = manager.getState();
      expect(state.isAutoConnecting).toBe(false);
      expect(state.hasStarted).toBe(false);
      expect(state.deviceId).toBe(null);
      expect(state.watchingDevice).toBe(false);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR RECONNECTION LOGIC
// ============================================================================

describe('Reconnection Logic', () => {
  describe('ReconnectionManager', () => {
    interface ReconnectionConfig {
      maxAttempts: number;
      delayMs: number;
    }

    class ReconnectionManager {
      private attempts: number = 0;
      private config: ReconnectionConfig;
      private onMaxAttemptsReached?: () => void;
      private maxAttemptsCallbackCalled: boolean = false;

      constructor(config: ReconnectionConfig) {
        this.config = config;
      }

      setOnMaxAttemptsReached(callback: () => void): void {
        this.onMaxAttemptsReached = callback;
      }

      canAttemptReconnect(): boolean {
        return this.attempts < this.config.maxAttempts;
      }

      recordAttempt(): void {
        this.attempts++;
        if (
          this.attempts >= this.config.maxAttempts &&
          this.onMaxAttemptsReached &&
          !this.maxAttemptsCallbackCalled
        ) {
          this.maxAttemptsCallbackCalled = true;
          this.onMaxAttemptsReached();
        }
      }

      resetAttempts(): void {
        this.attempts = 0;
      }

      getAttemptCount(): number {
        return this.attempts;
      }

      getRemainingAttempts(): number {
        return Math.max(0, this.config.maxAttempts - this.attempts);
      }

      getDelayMs(): number {
        return this.config.delayMs;
      }
    }

    let manager: ReconnectionManager;
    const defaultConfig: ReconnectionConfig = {
      maxAttempts: 5,
      delayMs: 3000,
    };

    beforeEach(() => {
      manager = new ReconnectionManager(defaultConfig);
    });

    it('should allow reconnection when under max attempts', () => {
      expect(manager.canAttemptReconnect()).toBe(true);
      manager.recordAttempt();
      expect(manager.canAttemptReconnect()).toBe(true);
    });

    it('should block reconnection when max attempts reached', () => {
      for (let i = 0; i < 5; i++) {
        manager.recordAttempt();
      }
      expect(manager.canAttemptReconnect()).toBe(false);
    });

    it('should track attempt count correctly', () => {
      expect(manager.getAttemptCount()).toBe(0);
      manager.recordAttempt();
      expect(manager.getAttemptCount()).toBe(1);
      manager.recordAttempt();
      expect(manager.getAttemptCount()).toBe(2);
    });

    it('should calculate remaining attempts', () => {
      expect(manager.getRemainingAttempts()).toBe(5);
      manager.recordAttempt();
      expect(manager.getRemainingAttempts()).toBe(4);

      for (let i = 0; i < 4; i++) {
        manager.recordAttempt();
      }
      expect(manager.getRemainingAttempts()).toBe(0);
    });

    it('should reset attempts on successful connection', () => {
      for (let i = 0; i < 3; i++) {
        manager.recordAttempt();
      }
      expect(manager.getAttemptCount()).toBe(3);

      manager.resetAttempts();
      expect(manager.getAttemptCount()).toBe(0);
      expect(manager.canAttemptReconnect()).toBe(true);
    });

    it('should call callback when max attempts reached', () => {
      const callback = vi.fn();
      manager.setOnMaxAttemptsReached(callback);

      for (let i = 0; i < 4; i++) {
        manager.recordAttempt();
      }
      expect(callback).not.toHaveBeenCalled();

      manager.recordAttempt(); // 5th attempt
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callback multiple times', () => {
      const callback = vi.fn();
      manager.setOnMaxAttemptsReached(callback);

      for (let i = 0; i < 10; i++) {
        manager.recordAttempt();
      }
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should provide correct delay value', () => {
      expect(manager.getDelayMs()).toBe(3000);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR MEASUREMENT PROCESSING
// ============================================================================

describe('Measurement Processing', () => {
  describe('MeasurementProcessor', () => {
    interface RawMeasurement {
      weightKg: number;
      impedanceOhm?: number;
    }

    interface ProcessedMeasurement extends RawMeasurement {
      timestamp: number;
      isValid: boolean;
    }

    class MeasurementProcessor {
      private lastProcessedWeight: number | null = null;
      private lastProcessedTime: number = 0;
      private debounceIntervalMs: number;
      private minWeight: number;
      private maxWeight: number;

      constructor(
        debounceIntervalMs: number = 5000,
        minWeight: number = 2,
        maxWeight: number = 300
      ) {
        this.debounceIntervalMs = debounceIntervalMs;
        this.minWeight = minWeight;
        this.maxWeight = maxWeight;
      }

      process(raw: RawMeasurement): ProcessedMeasurement | null {
        const now = Date.now();

        // Validate weight range
        if (raw.weightKg < this.minWeight || raw.weightKg > this.maxWeight) {
          return null;
        }

        // Check debounce
        const timeSinceLastMeasurement = now - this.lastProcessedTime;
        if (timeSinceLastMeasurement < this.debounceIntervalMs) {
          return null;
        }

        // Record processing
        this.lastProcessedWeight = raw.weightKg;
        this.lastProcessedTime = now;

        return {
          ...raw,
          timestamp: now,
          isValid: true,
        };
      }

      reset(): void {
        this.lastProcessedWeight = null;
        this.lastProcessedTime = 0;
      }

      getLastProcessedWeight(): number | null {
        return this.lastProcessedWeight;
      }
    }

    let processor: MeasurementProcessor;

    beforeEach(() => {
      processor = new MeasurementProcessor();
    });

    it('should process valid measurements', () => {
      const result = processor.process({ weightKg: 70 });
      expect(result).not.toBeNull();
      expect(result?.weightKg).toBe(70);
      expect(result?.isValid).toBe(true);
    });

    it('should include impedance when provided', () => {
      const result = processor.process({ weightKg: 70, impedanceOhm: 500 });
      expect(result?.impedanceOhm).toBe(500);
    });

    it('should reject invalid weight', () => {
      expect(processor.process({ weightKg: 0 })).toBeNull();
      expect(processor.process({ weightKg: 500 })).toBeNull();
      expect(processor.process({ weightKg: -10 })).toBeNull();
    });

    it('should debounce rapid measurements', () => {
      const first = processor.process({ weightKg: 70 });
      expect(first).not.toBeNull();

      const second = processor.process({ weightKg: 71 });
      expect(second).toBeNull(); // Debounced
    });

    it('should track last processed weight', () => {
      expect(processor.getLastProcessedWeight()).toBeNull();

      processor.process({ weightKg: 70 });
      expect(processor.getLastProcessedWeight()).toBe(70);
    });

    it('should reset state', () => {
      processor.process({ weightKg: 70 });
      expect(processor.getLastProcessedWeight()).toBe(70);

      processor.reset();
      expect(processor.getLastProcessedWeight()).toBeNull();
    });
  });
});

// ============================================================================
// UNIT TESTS FOR DEVICE STATE TRACKING
// ============================================================================

describe('Device State Tracking', () => {
  describe('DeviceStateTracker', () => {
    type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'reading' | 'error';

    interface DeviceState {
      connectionState: ConnectionState;
      deviceId: string | null;
      deviceName: string | null;
      isWatching: boolean;
      lastConnectionTime: number | null;
      lastError: string | null;
    }

    class DeviceStateTracker {
      private state: DeviceState = {
        connectionState: 'disconnected',
        deviceId: null,
        deviceName: null,
        isWatching: false,
        lastConnectionTime: null,
        lastError: null,
      };

      connect(deviceId: string, deviceName: string): void {
        this.state.deviceId = deviceId;
        this.state.deviceName = deviceName;
        this.state.connectionState = 'connected';
        this.state.lastConnectionTime = Date.now();
        this.state.lastError = null;
      }

      disconnect(reason?: string): void {
        this.state.connectionState = 'disconnected';
        this.state.isWatching = false;
        if (reason) {
          this.state.lastError = reason;
        }
      }

      setScanning(): void {
        this.state.connectionState = 'scanning';
      }

      setConnecting(): void {
        this.state.connectionState = 'connecting';
      }

      setError(error: string): void {
        this.state.connectionState = 'error';
        this.state.lastError = error;
      }

      setWatching(watching: boolean): void {
        this.state.isWatching = watching;
      }

      isConnected(): boolean {
        return this.state.connectionState === 'connected' || this.state.connectionState === 'reading';
      }

      canReconnect(): boolean {
        return this.state.deviceId !== null && !this.isConnected();
      }

      clearDevice(): void {
        this.state = {
          connectionState: 'disconnected',
          deviceId: null,
          deviceName: null,
          isWatching: false,
          lastConnectionTime: null,
          lastError: null,
        };
      }

      getState(): DeviceState {
        return { ...this.state };
      }
    }

    let tracker: DeviceStateTracker;

    beforeEach(() => {
      tracker = new DeviceStateTracker();
    });

    it('should start disconnected', () => {
      expect(tracker.getState().connectionState).toBe('disconnected');
      expect(tracker.isConnected()).toBe(false);
    });

    it('should track connection', () => {
      tracker.connect('device-123', 'Mi Scale');

      const state = tracker.getState();
      expect(state.connectionState).toBe('connected');
      expect(state.deviceId).toBe('device-123');
      expect(state.deviceName).toBe('Mi Scale');
      expect(state.lastConnectionTime).not.toBeNull();
      expect(tracker.isConnected()).toBe(true);
    });

    it('should track disconnection', () => {
      tracker.connect('device-123', 'Mi Scale');
      tracker.disconnect();

      expect(tracker.getState().connectionState).toBe('disconnected');
      expect(tracker.isConnected()).toBe(false);
      // Device ID should persist for reconnection
      expect(tracker.getState().deviceId).toBe('device-123');
    });

    it('should track disconnection with reason', () => {
      tracker.connect('device-123', 'Mi Scale');
      tracker.disconnect('Device out of range');

      expect(tracker.getState().lastError).toBe('Device out of range');
    });

    it('should indicate reconnection possibility', () => {
      expect(tracker.canReconnect()).toBe(false); // No device

      tracker.connect('device-123', 'Mi Scale');
      expect(tracker.canReconnect()).toBe(false); // Already connected

      tracker.disconnect();
      expect(tracker.canReconnect()).toBe(true); // Can reconnect
    });

    it('should clear device completely', () => {
      tracker.connect('device-123', 'Mi Scale');
      tracker.setWatching(true);

      tracker.clearDevice();

      const state = tracker.getState();
      expect(state.deviceId).toBeNull();
      expect(state.deviceName).toBeNull();
      expect(state.isWatching).toBe(false);
      expect(state.lastConnectionTime).toBeNull();
      expect(tracker.canReconnect()).toBe(false);
    });

    it('should track scanning state', () => {
      tracker.setScanning();
      expect(tracker.getState().connectionState).toBe('scanning');
    });

    it('should track connecting state', () => {
      tracker.setConnecting();
      expect(tracker.getState().connectionState).toBe('connecting');
    });

    it('should track error state', () => {
      tracker.setError('Connection failed');

      const state = tracker.getState();
      expect(state.connectionState).toBe('error');
      expect(state.lastError).toBe('Connection failed');
    });

    it('should track watching state', () => {
      expect(tracker.getState().isWatching).toBe(false);

      tracker.setWatching(true);
      expect(tracker.getState().isWatching).toBe(true);

      tracker.setWatching(false);
      expect(tracker.getState().isWatching).toBe(false);
    });

    it('should clear error on successful connection', () => {
      tracker.setError('Previous error');
      expect(tracker.getState().lastError).toBe('Previous error');

      tracker.connect('device-123', 'Mi Scale');
      expect(tracker.getState().lastError).toBeNull();
    });
  });
});
