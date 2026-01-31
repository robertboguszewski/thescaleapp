/**
 * BLEContext
 *
 * React context that provides BLE functionality to the application.
 * Initializes BLEService singleton and provides access to BLE operations.
 *
 * @module presentation/contexts/BLEContext
 */

import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { BLEService, getBLEService } from '../services/BLEService';

/**
 * BLE Context value interface
 */
interface BLEContextValue {
  /**
   * The BLEService instance
   */
  service: BLEService;

  /**
   * Start BLE scanning
   */
  startScanning: () => Promise<boolean>;

  /**
   * Stop BLE scanning
   */
  stopScanning: () => Promise<boolean>;

  /**
   * Set target device MAC address
   */
  setDevice: (mac: string) => Promise<boolean>;

  /**
   * Get current BLE status
   */
  getStatus: () => Promise<{ isConnected: boolean; isScanning: boolean } | null>;
}

/**
 * Create the BLE context
 */
const BLEContext = createContext<BLEContextValue | null>(null);

/**
 * BLE Provider Props
 */
interface BLEProviderProps {
  children: ReactNode;
}

/**
 * BLEProvider Component
 *
 * Wraps the application to provide BLE functionality.
 * Initializes the BLEService singleton on mount and disposes on unmount.
 */
export function BLEProvider({ children }: BLEProviderProps): JSX.Element {
  const serviceRef = useRef<BLEService | null>(null);

  // Get or create the service instance
  if (!serviceRef.current) {
    serviceRef.current = getBLEService();
  }

  const service = serviceRef.current;

  // Initialize service on mount
  useEffect(() => {
    console.log('[BLEProvider] Initializing BLEService...');
    service.initialize();

    // Cleanup on unmount
    return () => {
      console.log('[BLEProvider] Cleaning up BLEService...');
      // Note: We don't dispose the singleton here because other parts
      // of the app might still need it. The singleton persists for the
      // lifetime of the application.
    };
  }, [service]);

  // Create context value
  const contextValue: BLEContextValue = {
    service,
    startScanning: () => service.startScanning(),
    stopScanning: () => service.stopScanning(),
    setDevice: (mac: string) => service.setDevice(mac),
    getStatus: () => service.getStatus(),
  };

  return <BLEContext.Provider value={contextValue}>{children}</BLEContext.Provider>;
}

/**
 * useBLEContext Hook
 *
 * Access the BLE context. Must be used within a BLEProvider.
 *
 * @throws Error if used outside of BLEProvider
 */
export function useBLEContext(): BLEContextValue {
  const context = useContext(BLEContext);

  if (!context) {
    throw new Error('useBLEContext must be used within a BLEProvider');
  }

  return context;
}

/**
 * Export context for testing
 */
export { BLEContext };
