/**
 * Bleak BLE Adapter
 *
 * Uses Python's bleak library via subprocess for reliable BLE scanning
 * on macOS Sequoia. Bleak uses CoreBluetooth directly, which works
 * correctly on newer macOS versions.
 *
 * S400 sends weight data via BLE advertisement broadcasts (not GATT),
 * so this adapter parses advertisements during continuous scanning.
 *
 * @module main/ble/BleakBLEAdapter
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import {
  type BLEAdapterConfig,
  type BLEDevice,
  type BLEConnectionState,
  type BLEAdapterEvents,
  type IBLEAdapter,
  type RawMeasurement,
  type BLEScanMode,
} from './BLETypes';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: BLEAdapterConfig = {
  deviceMac: null,
  bleKey: null,  // 32 hex char bindkey for MiBeacon decryption
  autoConnect: true,
  scanInterval: 5000,
  scanTimeout: 60000, // Longer timeout for advertisement-based scanning
  allowDuplicates: true,
  scanMode: 'mibeacon', // Default to MiBeacon passive scanning
};

/**
 * Message types from Python scanner
 */
interface ScannerMessage {
  type: 'status' | 'discovered' | 'measurement' | 'error' | 'debug';
  status?: string;
  message?: string;
  error?: string;
  device?: {
    id: string;
    name: string;
    rssi?: number;
  };
  deviceId?: string;
  deviceName?: string;
  measurement?: {
    weightKg: number;
    impedanceOhm?: number;
    impedanceLowOhm?: number;
    heartRateBpm?: number;
    profileId?: number;
    isStabilized?: boolean;
    isImpedanceMeasurement?: boolean;
    isHeartRateMeasurement?: boolean;
    weightRemoved?: boolean;
    timestamp?: string;
  };
  devicesFound?: number;
  measurementsReceived?: number;
}

/**
 * Bleak BLE Adapter using Python subprocess
 *
 * Features:
 * - Uses CoreBluetooth via bleak for reliable macOS support
 * - Works on macOS Sequoia (unlike noble's XPC bindings)
 * - Automatic process management and restart
 * - JSON-based IPC with Python process
 */
export class BleakBLEAdapter extends EventEmitter implements IBLEAdapter {
  private config: BLEAdapterConfig;
  private state: BLEConnectionState = 'idle';
  private isScanning = false;
  private pythonProcess: ChildProcess | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectedDeviceId: string | null = null;
  private connectedDeviceName: string | null = null;

  constructor(config: Partial<BLEAdapterConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the path to the Python scanner script based on scan mode
   */
  private getScannerPath(): string {
    // In development, use the scripts directory
    // In production, it should be bundled with the app
    const isDev = !app.isPackaged;

    // Select script based on scan mode
    const scriptName = this.config.scanMode === 'gatt'
      ? 'ble_gatt_scanner.py'
      : 'ble-scanner.py';

    let scannerPath: string;

    if (isDev) {
      // In development, app.getAppPath() returns the project root
      scannerPath = path.join(app.getAppPath(), 'scripts', scriptName);
    } else {
      // In production, look in Resources
      scannerPath = path.join(process.resourcesPath, 'scripts', scriptName);
    }

    console.log('[BleakBLEAdapter] Scanner path:', scannerPath);
    console.log('[BleakBLEAdapter] Scan mode:', this.config.scanMode);
    console.log('[BleakBLEAdapter] Is packaged:', app.isPackaged);

    return scannerPath;
  }

  /**
   * Start the Python scanner process
   */
  private startPythonProcess(): void {
    if (this.pythonProcess) {
      console.log('[BleakBLEAdapter] Python process already running');
      return;
    }

    const scannerPath = this.getScannerPath();

    // Check if scanner script exists
    if (!fs.existsSync(scannerPath)) {
      const error = new Error(`BLE scanner script not found at: ${scannerPath}`);
      console.error('[BleakBLEAdapter]', error.message);
      this.emit('error', error);
      return;
    }

    const args = [scannerPath];

    // Build arguments based on scan mode
    if (this.config.scanMode === 'gatt') {
      // GATT mode requires device MAC for direct connection
      if (!this.config.deviceMac) {
        const error = new Error('GATT mode requires a device MAC address');
        console.error('[BleakBLEAdapter]', error.message);
        this.emit('error', error);
        return;
      }
      args.push('--device-mac', this.config.deviceMac);
      args.push('--scan-duration', String(this.config.scanTimeout / 1000));
    } else {
      // MiBeacon mode - passive scanning
      args.push('--scan-duration', String(this.config.scanTimeout / 1000));
      args.push('--continuous'); // Keep scanning for advertisement-based measurements

      if (this.config.deviceMac) {
        args.push('--device-mac', this.config.deviceMac);
      }

      if (this.config.bleKey) {
        args.push('--bindkey', this.config.bleKey);
      }
    }

    console.log('[BleakBLEAdapter] Starting Python scanner:', 'python3', args.join(' '));

    try {
      this.pythonProcess = spawn('python3', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        // Ensure we find python3 in PATH
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' },
      });

      this.pythonProcess.stdout?.on('data', (data) => {
        this.handlePythonOutput(data.toString());
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        console.error('[BleakBLEAdapter] Python stderr:', data.toString());
      });

      this.pythonProcess.on('close', (code) => {
        console.log('[BleakBLEAdapter] Python process exited with code:', code);
        this.pythonProcess = null;
        this.isScanning = false;

        if (this.state === 'scanning' && this.config.autoConnect) {
          this.scheduleReconnect();
        }
      });

      this.pythonProcess.on('error', (error) => {
        console.error('[BleakBLEAdapter] Failed to start Python process:', error);
        this.emit('error', error);
        this.pythonProcess = null;
        this.isScanning = false;
      });
    } catch (error) {
      console.error('[BleakBLEAdapter] Error spawning Python process:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle output from Python process
   */
  private handlePythonOutput(output: string): void {
    // Split by newlines in case multiple JSON messages arrive together
    const lines = output.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message: ScannerMessage = JSON.parse(line);
        this.handleScannerMessage(message);
      } catch (e) {
        console.log('[BleakBLEAdapter] Non-JSON output:', line);
      }
    }
  }

  /**
   * Handle parsed message from scanner
   */
  private handleScannerMessage(message: ScannerMessage): void {
    switch (message.type) {
      case 'status':
        console.log('[BleakBLEAdapter] Status:', message.status, message.message);

        if (message.status === 'scanning' || message.status === 'initializing') {
          this.state = 'scanning';
          this.emit('scanning');
        } else if (message.status === 'stopped') {
          this.isScanning = false;
          console.log('[BleakBLEAdapter] Scan completed, devices found:', message.devicesFound, 'measurements:', message.measurementsReceived);

          // Auto-restart if enabled and we should keep scanning
          if (this.config.autoConnect) {
            this.scheduleReconnect();
          }
        } else if (message.status === 'restarting') {
          console.log('[BleakBLEAdapter] Scanner restarting...');
        }
        break;

      case 'discovered':
        if (message.device) {
          console.log('[BleakBLEAdapter] Mi Scale found:', message.device);
          const device: BLEDevice = {
            id: message.device.id,
            name: message.device.name,
            rssi: message.device.rssi,
          };

          // Track discovered device as "connected" for UI purposes
          // (advertisement-based, not actual GATT connection)
          if (!this.connectedDeviceId) {
            this.connectedDeviceId = message.device.id;
            this.connectedDeviceName = message.device.name;
            this.config.deviceMac = message.device.id;
            this.state = 'connected';

            this.emit('connected', device);
          }

          this.emit('discovered', device);
        }
        break;

      case 'measurement':
        if (message.measurement) {
          console.log('[BleakBLEAdapter] Measurement received:', message.measurement);

          // Update connected device info from measurement
          if (message.deviceId && !this.connectedDeviceId) {
            this.connectedDeviceId = message.deviceId;
            this.connectedDeviceName = message.deviceName || 'Mi Scale';
            this.state = 'connected';
          }

          // Emit all measurements (both stabilized and in-progress for UI feedback)
          const rawMeasurement: RawMeasurement = {
            weightKg: message.measurement.weightKg,
            impedanceOhm: message.measurement.impedanceOhm,
            impedanceLowOhm: message.measurement.impedanceLowOhm,
            heartRateBpm: message.measurement.heartRateBpm,
            profileId: message.measurement.profileId,
            timestamp: message.measurement.timestamp ? new Date(message.measurement.timestamp) : new Date(),
            isStabilized: message.measurement.isStabilized,
            isImpedanceMeasurement: message.measurement.isImpedanceMeasurement,
            isHeartRateMeasurement: message.measurement.isHeartRateMeasurement,
          };

          // Always emit measurement for real-time feedback
          console.log('[BleakBLEAdapter] Emitting measurement, listeners:', this.listenerCount('measurement'));
          this.emit('measurement', rawMeasurement);
        }
        break;

      case 'error':
        console.error('[BleakBLEAdapter] Scanner error:', message.error, message.message);
        this.emit('error', new Error(message.message || message.error || 'Unknown error'));
        break;

      case 'debug':
        // Log debug messages for troubleshooting
        if (message.message) {
          console.log('[BleakBLEAdapter] Debug:', message.message);
        }
        break;
    }
  }

  /**
   * Schedule a scan restart
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[BleakBLEAdapter] Restarting scan...');
      this.startScanning().catch(console.error);
    }, this.config.scanInterval);
  }

  /**
   * Start scanning for BLE devices
   */
  async startScanning(): Promise<void> {
    if (this.isScanning) {
      console.log('[BleakBLEAdapter] Already scanning');
      return;
    }

    console.log('[BleakBLEAdapter] Starting scan...');
    this.isScanning = true;
    this.state = 'scanning';

    // Emit ready event (Python bleak handles Bluetooth state internally)
    this.emit('ready');

    this.startPythonProcess();
  }

  /**
   * Stop scanning for BLE devices
   */
  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    console.log('[BleakBLEAdapter] Stopping scan...');
    this.isScanning = false;

    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
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

    // Stop scanning
    await this.stopScanning();

    // Clear connection state
    this.connectedDeviceId = null;
    this.connectedDeviceName = null;
    this.state = 'idle';

    this.emit('disconnected');
  }

  /**
   * Set the target device MAC address
   */
  setDeviceMac(mac: string | null): void {
    this.config.deviceMac = mac;
  }

  /**
   * Set the BLE bindkey for MiBeacon decryption
   */
  setBleKey(key: string | null): void {
    this.config.bleKey = key;
  }

  /**
   * Set the scan mode
   * - 'mibeacon': Passive scanning of MiBeacon advertisements (final measurements only)
   * - 'gatt': Active GATT connection for real-time weight updates
   */
  setScanMode(mode: BLEScanMode): void {
    console.log('[BleakBLEAdapter] Setting scan mode:', mode);
    this.config.scanMode = mode;
  }

  /**
   * Get current scan mode
   */
  getScanMode(): BLEScanMode {
    return this.config.scanMode;
  }

  /**
   * Get currently connected device info
   */
  getConnectedDevice(): BLEDevice | null {
    if (!this.connectedDeviceId) return null;

    return {
      id: this.connectedDeviceId,
      name: this.connectedDeviceName || 'Mi Scale',
    };
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectedDeviceId !== null;
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
