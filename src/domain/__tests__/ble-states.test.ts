/**
 * Tests for BLE States
 * @module domain/__tests__/ble-states.test
 */

import { describe, it, expect } from 'vitest';
import {
  BLE_STATE_MESSAGES,
  getBLEStateMessage,
  isActionableState,
  isActiveState,
  isConnectedState
} from '../ble-states';
import { BLEConnectionState } from '../../application/ports/BLEPort';

describe('BLE States', () => {
  describe('BLE_STATE_MESSAGES', () => {
    const allStates: BLEConnectionState[] = [
      'disconnected',
      'scanning',
      'connecting',
      'connected',
      'reading',
      'error'
    ];

    it('should have messages for all states', () => {
      allStates.forEach(state => {
        expect(BLE_STATE_MESSAGES[state]).toBeDefined();
      });
    });

    it('should have required fields for all states', () => {
      allStates.forEach(state => {
        const message = BLE_STATE_MESSAGES[state];
        expect(typeof message.title).toBe('string');
        expect(typeof message.description).toBe('string');
        expect(typeof message.icon).toBe('string');
        expect(message.title.length).toBeGreaterThan(0);
        expect(message.description.length).toBeGreaterThan(0);
      });
    });

    it('should have action for disconnected state', () => {
      expect(BLE_STATE_MESSAGES.disconnected.action).toBeDefined();
      expect(BLE_STATE_MESSAGES.disconnected.action).toBe('Połącz');
    });

    it('should have action for connected state', () => {
      expect(BLE_STATE_MESSAGES.connected.action).toBeDefined();
      expect(BLE_STATE_MESSAGES.connected.action).toBe('Rozpocznij pomiar');
    });

    it('should have action for error state', () => {
      expect(BLE_STATE_MESSAGES.error.action).toBeDefined();
      expect(BLE_STATE_MESSAGES.error.action).toBe('Spróbuj ponownie');
    });

    it('should not have action for scanning state', () => {
      expect(BLE_STATE_MESSAGES.scanning.action).toBeUndefined();
    });

    it('should not have action for connecting state', () => {
      expect(BLE_STATE_MESSAGES.connecting.action).toBeUndefined();
    });

    it('should not have action for reading state', () => {
      expect(BLE_STATE_MESSAGES.reading.action).toBeUndefined();
    });

    it('should have matching icon identifiers', () => {
      allStates.forEach(state => {
        expect(BLE_STATE_MESSAGES[state].icon).toBe(state);
      });
    });
  });

  describe('getBLEStateMessage', () => {
    it('should return message for disconnected', () => {
      const message = getBLEStateMessage('disconnected');
      expect(message).toEqual(BLE_STATE_MESSAGES.disconnected);
    });

    it('should return message for scanning', () => {
      const message = getBLEStateMessage('scanning');
      expect(message).toEqual(BLE_STATE_MESSAGES.scanning);
    });

    it('should return message for connecting', () => {
      const message = getBLEStateMessage('connecting');
      expect(message).toEqual(BLE_STATE_MESSAGES.connecting);
    });

    it('should return message for connected', () => {
      const message = getBLEStateMessage('connected');
      expect(message).toEqual(BLE_STATE_MESSAGES.connected);
    });

    it('should return message for reading', () => {
      const message = getBLEStateMessage('reading');
      expect(message).toEqual(BLE_STATE_MESSAGES.reading);
    });

    it('should return message for error', () => {
      const message = getBLEStateMessage('error');
      expect(message).toEqual(BLE_STATE_MESSAGES.error);
    });
  });

  describe('isActionableState', () => {
    it('should return true for disconnected', () => {
      expect(isActionableState('disconnected')).toBe(true);
    });

    it('should return true for connected', () => {
      expect(isActionableState('connected')).toBe(true);
    });

    it('should return true for error', () => {
      expect(isActionableState('error')).toBe(true);
    });

    it('should return false for scanning', () => {
      expect(isActionableState('scanning')).toBe(false);
    });

    it('should return false for connecting', () => {
      expect(isActionableState('connecting')).toBe(false);
    });

    it('should return false for reading', () => {
      expect(isActionableState('reading')).toBe(false);
    });
  });

  describe('isActiveState', () => {
    it('should return true for scanning', () => {
      expect(isActiveState('scanning')).toBe(true);
    });

    it('should return true for connecting', () => {
      expect(isActiveState('connecting')).toBe(true);
    });

    it('should return true for reading', () => {
      expect(isActiveState('reading')).toBe(true);
    });

    it('should return false for disconnected', () => {
      expect(isActiveState('disconnected')).toBe(false);
    });

    it('should return false for connected', () => {
      expect(isActiveState('connected')).toBe(false);
    });

    it('should return false for error', () => {
      expect(isActiveState('error')).toBe(false);
    });
  });

  describe('isConnectedState', () => {
    it('should return true for connected', () => {
      expect(isConnectedState('connected')).toBe(true);
    });

    it('should return true for reading', () => {
      expect(isConnectedState('reading')).toBe(true);
    });

    it('should return false for disconnected', () => {
      expect(isConnectedState('disconnected')).toBe(false);
    });

    it('should return false for scanning', () => {
      expect(isConnectedState('scanning')).toBe(false);
    });

    it('should return false for connecting', () => {
      expect(isConnectedState('connecting')).toBe(false);
    });

    it('should return false for error', () => {
      expect(isConnectedState('error')).toBe(false);
    });
  });
});
