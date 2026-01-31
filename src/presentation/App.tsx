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
import { useProfile, useBLEAutoConnect } from './hooks';
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

  // Initialize BLE auto-connect service
  const { startAutoConnect, isAutoConnecting, isConnected } = useBLEAutoConnect();
  const { autoConnect, deviceMac } = useBLEStore();

  // Track if auto-connect was already started (prevent multiple calls)
  const autoConnectStartedRef = useRef(false);

  // Auto-start BLE connection if configured (only once on mount)
  useEffect(() => {
    if (autoConnect && deviceMac && !autoConnectStartedRef.current) {
      autoConnectStartedRef.current = true;
      console.log('[App] Auto-connect enabled, starting BLE service...');
      startAutoConnect();
    }
  }, [autoConnect, deviceMac]); // Removed startAutoConnect from deps

  // Log connection status changes
  useEffect(() => {
    if (isConnected) {
      console.log('[App] BLE connected - ready to receive measurements');
    } else if (isAutoConnecting) {
      console.log('[App] BLE auto-connecting...');
    }
  }, [isConnected, isAutoConnecting]);

  return <AppLayout />;
}

export default App;
