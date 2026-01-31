/**
 * BLEService
 *
 * Singleton service that manages all BLE IPC subscriptions centrally.
 * This eliminates the problem of multiple hook instances creating duplicate subscriptions.
 *
 * @module presentation/services/BLEService
 */

import { useBLEStore } from '../stores/bleStore';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * Native BLE device interface
 */
interface NativeBLEDevice {
  id: string;
  name: string;
  mac?: string;
}

/**
 * Native BLE measurement interface
 */
interface NativeBLEMeasurement {
  weightKg: number;
  impedanceOhm?: number;
}

/**
 * Unsubscribe function type
 */
type Unsubscribe = () => void;

/**
 * BLEService singleton class
 *
 * Manages all BLE IPC subscriptions in one place to prevent:
 * - Duplicate event subscriptions from multiple hook instances
 * - Race conditions between components
 * - Memory leaks from forgotten unsubscribes
 */
export class BLEService {
  private static instance: BLEService | null = null;

  private initialized = false;
  private unsubscribers: Unsubscribe[] = [];

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): BLEService {
    if (!BLEService.instance) {
      BLEService.instance = new BLEService();
    }
    return BLEService.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (BLEService.instance) {
      BLEService.instance.dispose();
      BLEService.instance = null;
    }
  }

  /**
   * Initialize the service and subscribe to IPC events
   * Idempotent - calling multiple times has no effect
   */
  public initialize(): void {
    if (this.initialized) {
      console.log('[BLEService] Already initialized, skipping');
      return;
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      console.warn('[BLEService] electronAPI not available');
      return;
    }

    const nativeBLE = electronAPI.nativeBLE;
    if (!nativeBLE) {
      console.warn('[BLEService] nativeBLE API not available');
      return;
    }

    console.log('[BLEService] Initializing...');

    // Subscribe to measurement events
    const unsubMeasurement = nativeBLE.onMeasurement((measurement: NativeBLEMeasurement) => {
      this.handleMeasurement(measurement);
    });
    this.unsubscribers.push(unsubMeasurement);

    // Subscribe to connected events
    const unsubConnected = nativeBLE.onConnected((device: NativeBLEDevice) => {
      this.handleConnected(device);
    });
    this.unsubscribers.push(unsubConnected);

    // Subscribe to disconnected events
    const unsubDisconnected = nativeBLE.onDisconnected(() => {
      this.handleDisconnected();
    });
    this.unsubscribers.push(unsubDisconnected);

    // Subscribe to scanning events
    const unsubScanning = nativeBLE.onScanning(() => {
      this.handleScanning();
    });
    this.unsubscribers.push(unsubScanning);

    // Subscribe to discovered events
    const unsubDiscovered = nativeBLE.onDiscovered((device: NativeBLEDevice) => {
      this.handleDiscovered(device);
    });
    this.unsubscribers.push(unsubDiscovered);

    // Subscribe to error events
    const unsubError = nativeBLE.onError((error: string) => {
      this.handleError(error);
    });
    this.unsubscribers.push(unsubError);

    // Subscribe to ready events
    const unsubReady = nativeBLE.onReady(() => {
      this.handleReady();
    });
    this.unsubscribers.push(unsubReady);

    // Subscribe to unavailable events
    const unsubUnavailable = nativeBLE.onUnavailable(() => {
      this.handleUnavailable();
    });
    this.unsubscribers.push(unsubUnavailable);

    // Subscribe to Bluetooth scanning status from main process
    if (electronAPI.onBluetoothScanningStatus) {
      const unsubScanStatus = electronAPI.onBluetoothScanningStatus(
        (status: { scanning: boolean; message?: string }) => {
          this.handleBluetoothScanningStatus(status);
        }
      );
      this.unsubscribers.push(unsubScanStatus);
    }

    // Subscribe to scan timeout events
    if (electronAPI.onBluetoothScanTimeout) {
      const unsubScanTimeout = electronAPI.onBluetoothScanTimeout(() => {
        this.handleScanTimeout();
      });
      this.unsubscribers.push(unsubScanTimeout);
    }

    this.initialized = true;
    console.log('[BLEService] Initialized successfully');
  }

  /**
   * Dispose the service and unsubscribe all listeners
   */
  public dispose(): void {
    console.log('[BLEService] Disposing...');

    // Call all unsubscribe functions
    this.unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.warn('[BLEService] Error during unsubscribe:', err);
      }
    });

    this.unsubscribers = [];
    this.initialized = false;

    console.log('[BLEService] Disposed');
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // ====== Event Handlers ======

  /**
   * Handle measurement event
   */
  private handleMeasurement(measurement: NativeBLEMeasurement): void {
    console.log('[BLEService] Measurement received:', measurement);

    const store = useBLEStore.getState();

    // Use store's handleMeasurement which includes debouncing and validation
    const accepted = store.handleMeasurement({
      weightKg: measurement.weightKg,
      impedanceOhm: measurement.impedanceOhm,
    });

    if (accepted) {
      console.log('[BLEService] Measurement accepted:', measurement.weightKg, 'kg');
    }
  }

  /**
   * Handle connected event
   */
  private handleConnected(device: NativeBLEDevice): void {
    console.log('[BLEService] Connected to device:', device.name);

    const store = useBLEStore.getState();
    store.setConnectionState('connected');
    store.setDeviceConfig({ deviceName: device.name });
  }

  /**
   * Handle disconnected event
   */
  private handleDisconnected(): void {
    console.log('[BLEService] Disconnected');

    const store = useBLEStore.getState();
    store.setConnectionState('disconnected');
  }

  /**
   * Handle scanning event
   */
  private handleScanning(): void {
    console.log('[BLEService] Scanning started');

    const store = useBLEStore.getState();
    store.setIsScanning(true);
  }

  /**
   * Handle discovered device event
   */
  private handleDiscovered(device: NativeBLEDevice): void {
    console.log('[BLEService] Device discovered:', device.name);

    const store = useBLEStore.getState();
    store.addDiscoveredDevice({
      mac: device.mac || device.id,
      name: device.name,
      rssi: 0,
    });
  }

  /**
   * Handle error event
   */
  private handleError(error: string): void {
    console.error('[BLEService] Error:', error);

    const store = useBLEStore.getState();
    store.setLastError({
      code: 'BLE_ERROR',
      message: error,
      recoverable: true,
    });
    store.setConnectionState('error');
  }

  /**
   * Handle ready event
   */
  private handleReady(): void {
    console.log('[BLEService] BLE adapter ready');
    // Could emit a custom event or update store if needed
  }

  /**
   * Handle unavailable event
   */
  private handleUnavailable(): void {
    console.warn('[BLEService] BLE adapter unavailable');

    const store = useBLEStore.getState();
    store.setLastError({
      code: 'BLE_UNAVAILABLE',
      message: 'Bluetooth adapter is not available',
      recoverable: false,
    });
  }

  /**
   * Handle Bluetooth scanning status from main process
   */
  private handleBluetoothScanningStatus(status: { scanning: boolean; message?: string }): void {
    console.log('[BLEService] Bluetooth scanning status:', status);

    const store = useBLEStore.getState();
    if (status.scanning) {
      store.setConnectionState('scanning');
    }
    store.setIsScanning(status.scanning);
  }

  /**
   * Handle scan timeout
   */
  private handleScanTimeout(): void {
    console.log('[BLEService] Scan timeout');

    const store = useBLEStore.getState();
    store.setIsScanning(false);
    store.setConnectionState('disconnected');
  }

  // ====== Public Actions ======

  /**
   * Start BLE scanning
   */
  public async startScanning(): Promise<boolean> {
    const nativeBLE = (window as any).electronAPI?.nativeBLE;
    if (!nativeBLE) {
      console.warn('[BLEService] Cannot start scanning - nativeBLE not available');
      return false;
    }

    try {
      const response = await nativeBLE.startScanning();
      return response.success;
    } catch (err) {
      console.error('[BLEService] Start scanning error:', err);
      return false;
    }
  }

  /**
   * Stop BLE scanning
   */
  public async stopScanning(): Promise<boolean> {
    const nativeBLE = (window as any).electronAPI?.nativeBLE;
    if (!nativeBLE) {
      return false;
    }

    try {
      const response = await nativeBLE.stopScanning();
      return response.success;
    } catch (err) {
      console.error('[BLEService] Stop scanning error:', err);
      return false;
    }
  }

  /**
   * Set target device MAC address
   */
  public async setDevice(mac: string): Promise<boolean> {
    const nativeBLE = (window as any).electronAPI?.nativeBLE;
    if (!nativeBLE) {
      return false;
    }

    try {
      const response = await nativeBLE.setDevice(mac);
      return response.success;
    } catch (err) {
      console.error('[BLEService] Set device error:', err);
      return false;
    }
  }

  /**
   * Get current BLE status
   */
  public async getStatus(): Promise<{ isConnected: boolean; isScanning: boolean } | null> {
    const nativeBLE = (window as any).electronAPI?.nativeBLE;
    if (!nativeBLE) {
      return null;
    }

    try {
      const response = await nativeBLE.getStatus();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('[BLEService] Get status error:', err);
      return null;
    }
  }
}

/**
 * Get the BLEService singleton instance
 * Convenience function for easier imports
 */
export function getBLEService(): BLEService {
  return BLEService.getInstance();
}
