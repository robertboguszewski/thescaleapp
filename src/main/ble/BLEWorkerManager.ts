/**
 * BLE Worker Manager
 *
 * Manages the BLE utility process and handles communication.
 * Provides a clean API for the main process to interact with BLE.
 *
 * @module main/ble/BLEWorkerManager
 */

import { utilityProcess, UtilityProcess, app } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import type { BLEDevice, RawMeasurement, BLEConnectionState } from './BLETypes';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface WorkerMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

export interface BLEWorkerManagerEvents {
  ready: (data: { state: string; available: boolean; error?: string }) => void;
  stateChange: (data: { state: string }) => void;
  discovered: (device: BLEDevice) => void;
  measurement: (measurement: RawMeasurement) => void;
  connecting: (data: { deviceId: string }) => void;
  connected: (data: { deviceId: string }) => void;
  disconnected: () => void;
  scanStarted: () => void;
  scanStopped: (data: { devices: BLEDevice[] }) => void;
  error: (error: Error) => void;
}

/**
 * BLE Worker Manager
 *
 * Spawns a utility process for BLE operations and provides
 * a promise-based API for the main process.
 */
export class BLEWorkerManager extends EventEmitter {
  private worker: UtilityProcess | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private state: BLEConnectionState = 'idle';
  private isReady = false;
  private workerPath: string;

  constructor() {
    super();
    // Worker path - will be compiled to dist/main/ble/ble-worker.cjs
    this.workerPath = path.join(__dirname, 'ble-worker.cjs');
  }

  /**
   * Start the BLE worker process
   */
  async start(): Promise<void> {
    if (this.worker) {
      console.log('[BLEWorkerManager] Worker already running');
      return;
    }

    console.log('[BLEWorkerManager] Starting worker from:', this.workerPath);

    return new Promise((resolve, reject) => {
      try {
        this.worker = utilityProcess.fork(this.workerPath, [], {
          stdio: 'pipe',
          env: {
            ...process.env,
            // Allow loading unsigned native modules on macOS
            ELECTRON_RUN_AS_NODE: '1',
          },
        });

        // Handle worker messages
        this.worker.on('message', (message: WorkerMessage) => {
          this.handleWorkerMessage(message);
        });

        // Handle worker stdout/stderr
        if (this.worker.stdout) {
          this.worker.stdout.on('data', (data) => {
            console.log('[BLE-Worker]', data.toString().trim());
          });
        }

        if (this.worker.stderr) {
          this.worker.stderr.on('data', (data) => {
            console.error('[BLE-Worker ERROR]', data.toString().trim());
          });
        }

        // Handle worker exit
        this.worker.on('exit', (code) => {
          console.log('[BLEWorkerManager] Worker exited with code:', code);
          this.worker = null;
          this.isReady = false;
          this.rejectAllPending(new Error(`Worker exited with code ${code}`));
        });

        // Wait for ready event
        const timeout = setTimeout(() => {
          reject(new Error('Worker startup timeout'));
        }, 10000);

        const onReady = (data: any) => {
          clearTimeout(timeout);
          this.isReady = true;
          this.removeListener('ready', onReady);
          resolve();
        };

        this.once('ready', onReady);

      } catch (error) {
        console.error('[BLEWorkerManager] Failed to start worker:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the BLE worker process
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    console.log('[BLEWorkerManager] Stopping worker...');
    this.worker.kill();
    this.worker = null;
    this.isReady = false;
    this.rejectAllPending(new Error('Worker stopped'));
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    console.log('[BLEWorkerManager] Received:', message.type);

    if (message.type === 'response' && message.requestId) {
      // Handle response to a pending request
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.requestId);

        if (message.payload?.success) {
          pending.resolve(message.payload.data);
        } else {
          pending.reject(new Error(message.payload?.error || 'Unknown error'));
        }
      }
    } else if (message.type === 'event' && message.payload) {
      // Handle events from worker
      const { eventType, data } = message.payload;
      this.emit(eventType, data);

      // Update internal state
      if (eventType === 'stateChange' && data?.state) {
        this.updateState(data.state);
      }
    }
  }

  /**
   * Update internal BLE state
   */
  private updateState(bluetoothState: string): void {
    switch (bluetoothState) {
      case 'poweredOn':
        if (this.state === 'idle') {
          this.state = 'idle';
        }
        break;
      case 'poweredOff':
      case 'unauthorized':
        this.state = 'error';
        break;
    }
  }

  /**
   * Send a request to the worker and wait for response
   */
  private sendRequest(type: string, payload?: any, timeoutMs = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not running'));
        return;
      }

      const requestId = `req_${++this.requestId}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.worker.postMessage({
        type,
        requestId,
        ...payload,
      });
    });
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Scan for BLE devices
   */
  async scanForDevices(timeoutMs = 10000): Promise<BLEDevice[]> {
    if (!this.isReady) {
      throw new Error('Worker not ready');
    }

    this.state = 'scanning';

    try {
      const result = await this.sendRequest('scan', { timeoutMs }, timeoutMs + 5000);

      // Collect discovered devices during scan
      const devices: BLEDevice[] = [];
      const onDiscovered = (device: BLEDevice) => {
        devices.push(device);
      };
      this.on('discovered', onDiscovered);

      // Wait for scan to complete
      await new Promise<void>((resolve) => {
        const onScanStopped = () => {
          this.removeListener('scanStopped', onScanStopped);
          this.removeListener('discovered', onDiscovered);
          resolve();
        };
        this.once('scanStopped', onScanStopped);

        // Also resolve on timeout from result
        if (result?.devices) {
          setTimeout(() => {
            this.removeListener('scanStopped', onScanStopped);
            this.removeListener('discovered', onDiscovered);
            resolve();
          }, 100);
        }
      });

      this.state = 'idle';
      return result?.devices || devices;

    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<BLEDevice[]> {
    if (!this.isReady) {
      return [];
    }

    const result = await this.sendRequest('stopScan');
    this.state = 'idle';
    return result?.devices || [];
  }

  /**
   * Connect to a device
   */
  async connect(deviceId: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('Worker not ready');
    }

    this.state = 'connecting';

    try {
      await this.sendRequest('connect', { deviceId });
      this.state = 'connected';
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect(): Promise<void> {
    if (!this.isReady) {
      return;
    }

    await this.sendRequest('disconnect');
    this.state = 'disconnected';
  }

  /**
   * Get current state
   */
  getState(): BLEConnectionState {
    return this.state;
  }

  /**
   * Check if worker is ready
   */
  isWorkerReady(): boolean {
    return this.isReady;
  }

  /**
   * Type-safe event handling
   */
  on<K extends keyof BLEWorkerManagerEvents>(
    event: K,
    listener: BLEWorkerManagerEvents[K]
  ): this {
    return super.on(event, listener as (...args: any[]) => void);
  }

  off<K extends keyof BLEWorkerManagerEvents>(
    event: K,
    listener: BLEWorkerManagerEvents[K]
  ): this {
    return super.off(event, listener as (...args: any[]) => void);
  }
}

// Singleton instance
let managerInstance: BLEWorkerManager | null = null;

/**
 * Get the BLE Worker Manager instance
 */
export function getBLEWorkerManager(): BLEWorkerManager {
  if (!managerInstance) {
    managerInstance = new BLEWorkerManager();
  }
  return managerInstance;
}

/**
 * Initialize BLE Worker (call after app is ready)
 */
export async function initializeBLEWorker(): Promise<BLEWorkerManager> {
  const manager = getBLEWorkerManager();

  try {
    await manager.start();
    console.log('[BLEWorkerManager] Worker initialized successfully');
  } catch (error) {
    console.error('[BLEWorkerManager] Failed to initialize worker:', error);
    // Don't throw - BLE may not be available but app should still work
  }

  return manager;
}
