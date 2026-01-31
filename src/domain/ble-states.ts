/**
 * BLE State Messages
 * User-friendly messages for each BLE connection state
 *
 * All messages are in Polish as per project requirements.
 *
 * @module domain/ble-states
 */

import { BLEConnectionState } from '../application/ports/BLEPort';

/**
 * Message configuration for a BLE state
 */
export interface BLEStateMessage {
  /** Short title describing the state */
  title: string;
  /** Detailed description for the user */
  description: string;
  /** Icon identifier (can be mapped to actual icons in UI layer) */
  icon: 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'reading' | 'error';
  /** Optional action button label */
  action?: string;
}

/**
 * Messages for each BLE connection state
 * Designed for user-friendly display in the UI
 */
export const BLE_STATE_MESSAGES: Record<BLEConnectionState, BLEStateMessage> = {
  disconnected: {
    title: 'ble:states.disconnected.title',
    description: 'ble:states.disconnected.description',
    icon: 'disconnected',
    action: 'ble:states.disconnected.action'
  },
  scanning: {
    title: 'ble:states.scanning.title',
    description: 'ble:states.scanning.description',
    icon: 'scanning'
  },
  connecting: {
    title: 'ble:states.connecting.title',
    description: 'ble:states.connecting.description',
    icon: 'connecting'
  },
  connected: {
    title: 'ble:states.connected.title',
    description: 'ble:states.connected.description',
    icon: 'connected',
    action: 'ble:states.connected.action'
  },
  reading: {
    title: 'ble:states.reading.title',
    description: 'ble:states.reading.description',
    icon: 'reading'
  },
  error: {
    title: 'ble:states.error.title',
    description: 'ble:states.error.description',
    icon: 'error',
    action: 'ble:states.error.action'
  }
};

/**
 * Get message for a specific BLE state
 * @param state - Current BLE connection state
 * @returns Message configuration for the state
 */
export function getBLEStateMessage(state: BLEConnectionState): BLEStateMessage {
  return BLE_STATE_MESSAGES[state];
}

/**
 * Check if a state allows user action
 * @param state - Current BLE connection state
 * @returns True if user can perform an action
 */
export function isActionableState(state: BLEConnectionState): boolean {
  return BLE_STATE_MESSAGES[state].action !== undefined;
}

/**
 * Check if a state indicates active operation
 * @param state - Current BLE connection state
 * @returns True if an operation is in progress
 */
export function isActiveState(state: BLEConnectionState): boolean {
  return state === 'scanning' || state === 'connecting' || state === 'reading';
}

/**
 * Check if a state indicates successful connection
 * @param state - Current BLE connection state
 * @returns True if connected
 */
export function isConnectedState(state: BLEConnectionState): boolean {
  return state === 'connected' || state === 'reading';
}
