/**
 * Noble BLE Adapter
 *
 * Native Bluetooth adapter using @abandonware/noble for true background scanning.
 * Runs in Electron main process with full system Bluetooth access.
 *
 * @module main/ble/NobleBLEAdapter
 */

import { EventEmitter } from 'events';
import {
  type BLEAdapterConfig,
  type BLEDevice,
  type BLEConnectionState,
  type BLEAdapterEvents,
  type IBLEAdapter,
  BLE_UUIDS,
  isMiScaleDevice,
  getFullDeviceName,
} from './BLETypes';
import { MiScaleParser } from './MiScaleParser';

/**
 * Noble-like interface for dependency injection
 */
export interface INoble extends EventEmitter {
  state: string;
  startScanningAsync(serviceUUIDs?: string[], allowDuplicates?: boolean): Promise<void>;
  stopScanningAsync(): Promise<void>;
}

// Noble is loaded lazily to avoid initialization issues with Electron
// Using @stoprocent/noble which has better macOS support via official CoreBluetooth bindings
let nobleModule: INoble | null = null;
let nobleLoadAttempted = false;

/**
 * Lazily load noble module
 * This prevents noble from initializing before Electron is ready
 */
function getNoble(): INoble | null {
  if (nobleLoadAttempted) {
    return nobleModule;
  }
  nobleLoadAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const noble = require('@stoprocent/noble');
    nobleModule = noble.default || noble;
    console.log('[NobleBLEAdapter] Loaded @stoprocent/noble for BLE');
  } catch (e) {
    console.warn('[NobleBLEAdapter] Noble not available:', e);
    nobleModule = null;
  }

  return nobleModule;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: BLEAdapterConfig = {
  deviceMac: null,
  bleKey: null,
  autoConnect: true,
  scanInterval: 5000,
  scanTimeout: 30000,
  allowDuplicates: true,
};

/**
 * Noble BLE Adapter for native Bluetooth access
 *
 * Features:
 * - True background scanning without user gesture
 * - Automatic reconnection on disconnect
 * - Mi Scale device detection and filtering
 * - Advertisement data parsing for weight measurements
 */
export class NobleBLEAdapter extends EventEmitter implements IBLEAdapter {
  private config: BLEAdapterConfig;
  private parser: MiScaleParser;
  private noble: INoble | null;
  private state: BLEConnectionState = 'idle';
  private isScanning = false;
  private isConnecting = false;
  private connectedPeripheral: any = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BLEAdapterConfig> = {}, noble?: INoble | null) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new MiScaleParser();
    // Use provided noble instance or lazily load it
    this.noble = noble !== undefined ? noble : getNoble();
    this.setupNobleEvents();
  }

  /**
   * Setup event listeners for noble
   */
  private setupNobleEvents(): void {
    if (!this.noble) return;

    this.noble.on('stateChange', this.handleStateChange.bind(this));
    this.noble.on('discover', this.handleDiscover.bind(this));
  }

  /**
   * Handle Bluetooth state changes
   */
  private handleStateChange(state: string): void {
    console.log('[NobleBLEAdapter] State changed:', state);

    if (state === 'poweredOn') {
      this.emit('ready');
      if (this.config.autoConnect) {
        this.startScanning().catch(console.error);
      }
    } else {
      this.emit('unavailable', state);
    }
  }

  /**
   * Handle discovered peripheral
   */
  private handleDiscover(peripheral: any): void {
    const { localName, manufacturerData, serviceUuids } = peripheral.advertisement;

    // Log ALL discovered devices for debugging
    console.log('[NobleBLEAdapter] Device found:', {
      id: peripheral.id,
      name: localName || '(no name)',
      rssi: peripheral.rssi,
      services: serviceUuids || [],
    });

    // Check if this is a Mi Scale
    if (!isMiScaleDevice(localName)) {
      return;
    }

    const fullName = getFullDeviceName(localName);
    console.log('[NobleBLEAdapter] Mi Scale found:', localName, '->', fullName, peripheral.id);

    const device: BLEDevice = {
      id: peripheral.id,
      name: fullName,
      rssi: peripheral.rssi,
    };

    // Emit discovered event
    this.emit('discovered', device);

    // If we have a saved device MAC, only connect to that one
    if (this.config.deviceMac && peripheral.id !== this.config.deviceMac) {
      return;
    }

    // Try to parse measurement from advertisement data
    if (manufacturerData) {
      const measurement = this.parser.parseAdvertisementData(manufacturerData);
      if (measurement) {
        this.emit('measurement', measurement);
      }
    }

    // Connect if not already connected and auto-connect is enabled
    if (!this.connectedPeripheral && this.config.autoConnect) {
      this.connectToPeripheral(peripheral).catch(console.error);
    }
  }

  /**
   * Connect to a peripheral
   * Protected against race conditions with isConnecting flag
   */
  private async connectToPeripheral(peripheral: any): Promise<void> {
    // Race condition protection: prevent concurrent connection attempts
    if (this.isConnecting) {
      console.log('[NobleBLEAdapter] Connection already in progress, skipping');
      return;
    }

    this.isConnecting = true;

    try {
      // Stop scanning before connecting (required by some adapters)
      await this.stopScanning();

      console.log('[NobleBLEAdapter] Connecting to:', peripheral.id);
      this.state = 'connecting';
      this.emit('connecting', peripheral.id);

      await peripheral.connectAsync();
      this.connectedPeripheral = peripheral;
      this.config.deviceMac = peripheral.id;
      this.state = 'connected';

      console.log('[NobleBLEAdapter] Connected!');
      this.emit('connected', {
        id: peripheral.id,
        name: getFullDeviceName(peripheral.advertisement.localName),
      });

      // Setup disconnect handler
      peripheral.once('disconnect', () => {
        console.log('[NobleBLEAdapter] Disconnected');
        this.connectedPeripheral = null;
        this.state = 'disconnected';
        this.emit('disconnected');

        // Auto-reconnect if enabled
        if (this.config.autoConnect) {
          this.scheduleReconnect();
        }
      });

      // Subscribe to characteristic notifications
      await this.subscribeToNotifications(peripheral);
    } catch (error) {
      console.error('[NobleBLEAdapter] Connection error:', error);
      this.state = 'error';
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Subscribe to weight measurement notifications
   */
  private async subscribeToNotifications(peripheral: any): Promise<void> {
    try {
      const services = await peripheral.discoverServicesAsync([
        BLE_UUIDS.BODY_COMPOSITION_SERVICE,
        BLE_UUIDS.WEIGHT_SCALE_SERVICE,
      ]);

      for (const service of services) {
        const characteristics = await service.discoverCharacteristicsAsync([
          BLE_UUIDS.BODY_COMPOSITION_MEASUREMENT,
          BLE_UUIDS.WEIGHT_MEASUREMENT,
        ]);

        for (const char of characteristics) {
          if (char.properties.includes('notify')) {
            char.on('data', (data: Buffer) => {
              const measurement = this.parser.parseCharacteristicData(char.uuid, data);
              if (measurement) {
                this.emit('measurement', measurement);
              }
            });

            await char.subscribeAsync();
            console.log('[NobleBLEAdapter] Subscribed to:', char.uuid);
          }
        }
      }
    } catch (error) {
      console.error('[NobleBLEAdapter] Failed to subscribe to notifications:', error);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[NobleBLEAdapter] Attempting reconnect...');
      this.startScanning().catch(console.error);
    }, this.config.scanInterval);
  }

  /**
   * Start scanning for BLE devices
   */
  async startScanning(): Promise<void> {
    if (this.isScanning) return;

    if (!this.noble || this.noble.state !== 'poweredOn') {
      console.log('[NobleBLEAdapter] Bluetooth not ready, waiting...');
      return;
    }

    console.log('[NobleBLEAdapter] Starting scan...');
    this.isScanning = true;
    this.state = 'scanning';
    this.emit('scanning');

    // Scan for ALL devices (empty array = no UUID filter)
    // Mi Scale may not advertise standard service UUIDs, so we filter by name instead
    await this.noble.startScanningAsync(
      [], // No UUID filter - scan all devices
      this.config.allowDuplicates
    );
  }

  /**
   * Stop scanning for BLE devices
   */
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    console.log('[NobleBLEAdapter] Stopping scan...');
    this.isScanning = false;

    if (this.noble) {
      await this.noble.stopScanningAsync();
    }
  }

  /**
   * Disconnect from current device and cleanup
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disconnect peripheral
    if (this.connectedPeripheral) {
      try {
        await this.connectedPeripheral.disconnectAsync();
      } catch (e) {
        console.error('[NobleBLEAdapter] Error disconnecting:', e);
      }
      this.connectedPeripheral = null;
    }

    // Stop scanning
    await this.stopScanning();
    this.state = 'idle';
  }

  /**
   * Set the target device MAC address
   */
  setDeviceMac(mac: string | null): void {
    this.config.deviceMac = mac;
  }

  /**
   * Get currently connected device info
   */
  getConnectedDevice(): BLEDevice | null {
    if (!this.connectedPeripheral) return null;

    return {
      id: this.connectedPeripheral.id,
      name: getFullDeviceName(this.connectedPeripheral.advertisement?.localName),
    };
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectedPeripheral !== null;
  }

  /**
   * Get current connection state
   */
  getState(): BLEConnectionState {
    return this.state;
  }

  /**
   * Type-safe event handling
   */
  on<K extends keyof BLEAdapterEvents>(event: K, listener: BLEAdapterEvents[K]): this {
    return super.on(event, listener as (...args: any[]) => void);
  }

  off<K extends keyof BLEAdapterEvents>(event: K, listener: BLEAdapterEvents[K]): this {
    return super.off(event, listener as (...args: any[]) => void);
  }

  removeAllListeners(): this {
    super.removeAllListeners();
    return this;
  }
}
