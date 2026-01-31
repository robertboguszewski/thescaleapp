/**
 * App Component
 *
 * Main application component that serves as the root of the React tree.
 * Initializes core application state and renders the main layout.
 *
 * @module presentation/App
 */

import React, { useEffect, useRef } from 'react';
import { AppLayout } from './components/layout';
import { useProfile, useMeasurement } from './hooks';
import { useBLE } from './hooks/useBLE';
import { useBLEStore } from './stores/bleStore';

/**
 * Main App component
 *
 * Renders the application layout and initializes required hooks.
 * The AppLayout component handles tab navigation and content rendering internally.
 * Initializes background BLE connection for automatic scale detection.
 */
export function App(): React.ReactElement {
  // Load profiles on mount - this hook handles initial data fetching
  // and sets up the profile state in the store
  useProfile();

  // Load measurements when profile changes - this hook auto-loads
  // measurements for the current profile via useEffect
  useMeasurement();

  // Get BLE state from the new unified hook
  const { isConnected, isConnecting, connect } = useBLE();
  const { autoConnect, deviceMac } = useBLEStore();

  // Track if auto-connect was already started (prevent multiple calls)
  const autoConnectStartedRef = useRef(false);

  // Auto-start BLE connection if configured (only once on mount)
  useEffect(() => {
    if (autoConnect && deviceMac && !autoConnectStartedRef.current) {
      autoConnectStartedRef.current = true;
      console.log('[App] Auto-connect enabled, starting BLE connection...');
      connect();
    }
  }, [autoConnect, deviceMac]); // Removed connect from deps to prevent loops

  // Log connection status changes
  useEffect(() => {
    if (isConnected) {
      console.log('[App] BLE connected - ready to receive measurements');
    } else if (isConnecting) {
      console.log('[App] BLE connecting...');
    }
  }, [isConnected, isConnecting]);

  return <AppLayout />;
}

export default App;
