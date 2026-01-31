/**
 * useBLEAutoConnect Hook
 *
 * Background BLE service that automatically connects to configured devices
 * and continuously listens for weight measurements.
 *
 * Features:
 * - Auto-connect on app startup
 * - Persistent background listening
 * - Auto-reconnect on disconnect
 * - Real-time measurement capture
 *
 * @module presentation/hooks/useBLEAutoConnect
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBLEStore } from '../stores/bleStore';
import { useMeasurementStore } from '../stores/measurementStore';
import { useProfileStore, useCurrentProfile } from '../stores/profileStore';
import { useAppStore } from '../stores/appStore';
import { calculateAllMetrics } from '../../domain/calculations';
import type { RawMeasurement } from '../../domain/calculations/types';

/**
 * Check if native BLE is available (running in Electron with Python bleak)
 */
function isNativeBLEAvailable(): boolean {
  return !!(window as any).electronAPI?.nativeBLE;
}

/**
 * Standard BLE Service UUIDs
 */
const SERVICE_UUIDS = {
  BODY_COMPOSITION: 0x181b,
  WEIGHT_SCALE: 0x181d,
  XIAOMI: 0xfe95,
} as const;

/**
 * Standard BLE Characteristic UUIDs
 */
const CHARACTERISTIC_UUIDS = {
  BODY_COMPOSITION_MEASUREMENT: 0x2a9c,
  WEIGHT_MEASUREMENT: 0x2a9d,
} as const;

/**
 * Convert UUID number to full UUID string
 */
function uuidFromNumber(uuid: number): string {
  return `0000${uuid.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`;
}

/**
 * Parse weight from standard BLE Weight Measurement characteristic
 */
function parseWeightMeasurement(dataView: DataView): { weightKg: number; isStable: boolean } | null {
  if (dataView.byteLength < 3) return null;

  const flags = dataView.getUint8(0);
  const isImperial = (flags & 0x01) !== 0;
  const isStable = (flags & 0x20) !== 0; // Measurement complete flag

  const weightRaw = dataView.getUint16(1, true);

  let weightKg: number;
  if (isImperial) {
    weightKg = (weightRaw * 0.01) * 0.453592;
  } else {
    weightKg = weightRaw * 0.01;
  }

  console.log('[AutoBLE] Weight parsed:', { flags, isStable, weightKg });
  return { weightKg, isStable };
}

/**
 * Parse body composition measurement
 */
function parseBodyComposition(dataView: DataView): Partial<RawMeasurement> | null {
  if (dataView.byteLength < 4) return null;

  const result: Partial<RawMeasurement> = {};
  const flags = dataView.getUint16(0, true);
  const isImperial = (flags & 0x0001) !== 0;
  const hasImpedance = (flags & 0x0200) !== 0;
  const hasWeight = (flags & 0x0400) !== 0;

  let offset = 4; // Skip flags and body fat

  // Skip optional fields based on flags
  if ((flags & 0x0002) !== 0) offset += 7; // timestamp
  if ((flags & 0x0004) !== 0) offset += 1; // user ID
  if ((flags & 0x0008) !== 0) offset += 4; // BMI/height

  // Weight
  if (hasWeight && dataView.byteLength > offset + 1) {
    const weightRaw = dataView.getUint16(offset, true);
    offset += 2;
    result.weightKg = isImperial
      ? (weightRaw * 0.01) * 0.453592
      : weightRaw * 0.005;
  }

  // Skip more optional fields
  if ((flags & 0x0800) !== 0) offset += 2; // height
  if ((flags & 0x0010) !== 0) offset += 2; // muscle %
  if ((flags & 0x0020) !== 0) offset += 2; // muscle mass
  if ((flags & 0x0040) !== 0) offset += 2; // fat free mass
  if ((flags & 0x0080) !== 0) offset += 2; // soft lean mass
  if ((flags & 0x0100) !== 0) offset += 2; // body water

  // Impedance
  if (hasImpedance && dataView.byteLength > offset + 1) {
    const impedanceRaw = dataView.getUint16(offset, true);
    result.impedanceOhm = impedanceRaw * 0.1;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Auto-connect configuration
 */
interface AutoConnectConfig {
  /** Enable auto-connect on startup */
  enabled: boolean;
  /** Reconnect delay in ms */
  reconnectDelay: number;
  /** Max reconnect attempts */
  maxReconnectAttempts: number;
  /** Scan timeout in ms */
  scanTimeout: number;
}

const DEFAULT_CONFIG: AutoConnectConfig = {
  enabled: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: 5,
  scanTimeout: 30000,
};

/**
 * Hook return type
 */
interface UseBLEAutoConnectReturn {
  /** Whether auto-connect is active */
  isAutoConnecting: boolean;
  /** Whether currently connected */
  isConnected: boolean;
  /** Connected device name */
  deviceName: string | null;
  /** Last measurement */
  lastMeasurement: RawMeasurement | null;
  /** Start auto-connect */
  startAutoConnect: () => Promise<void>;
  /** Stop auto-connect */
  stopAutoConnect: () => void;
  /** Manually trigger scan */
  scanAndConnect: () => Promise<boolean>;
  /** Save current device for auto-connect */
  saveDevice: (deviceId: string, deviceName: string) => void;
  /** Clear saved device */
  clearSavedDevice: () => void;
}

/**
 * Hook for automatic BLE connection and background measurement listening
 */
export function useBLEAutoConnect(config: Partial<AutoConnectConfig> = {}): UseBLEAutoConnectReturn {
  const { t } = useTranslation('ble');
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // State
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<RawMeasurement | null>(null);

  // Refs for persistent connection
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const characteristicsRef = useRef<BluetoothRemoteGATTCharacteristic[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);
  const notificationShownRef = useRef(false);
  const lastMeasurementTimeRef = useRef<number>(0);
  const maxAttemptsCallbackCalledRef = useRef(false);

  // Store hooks
  const {
    deviceMac,
    autoConnect,
    setConnectionState,
    setLiveWeight,
    setIsStable,
    setAutoConnect,
    setDeviceConfig,
    clearDeviceConfig,
  } = useBLEStore();

  const { addNotification } = useAppStore();
  const { setCurrentMeasurement, addMeasurement } = useMeasurementStore();
  const currentProfile = useCurrentProfile();

  const isConnected = serverRef.current?.connected ?? false;

  /**
   * Handle measurement received
   * Includes debouncing to prevent duplicate measurements
   */
  const handleMeasurement = useCallback((raw: RawMeasurement) => {
    // Debounce: ignore measurements within 5 seconds of the last one
    const now = Date.now();
    const timeSinceLastMeasurement = now - lastMeasurementTimeRef.current;
    if (timeSinceLastMeasurement < 5000) {
      console.log('[AutoBLE] Ignoring duplicate measurement (debounce)');
      return;
    }

    // Validate measurement range (2-300 kg is realistic for humans)
    if (raw.weightKg < 2 || raw.weightKg > 300) {
      console.log('[AutoBLE] Ignoring invalid weight:', raw.weightKg);
      return;
    }

    lastMeasurementTimeRef.current = now;
    console.log('[AutoBLE] Measurement received:', raw);
    setLastMeasurement(raw);
    setLiveWeight(raw.weightKg);
    setIsStable(true);

    // Calculate metrics if we have a profile
    const profileForCalc = currentProfile
      ? {
          gender: currentProfile.gender,
          birthYear: currentProfile.birthYear,
          heightCm: currentProfile.heightCm,
          ethnicity: currentProfile.ethnicity,
        }
      : {
          gender: 'male' as const,
          age: 30,
          heightCm: 175,
        };

    const calculated = calculateAllMetrics(profileForCalc, raw);

    setCurrentMeasurement({
      raw,
      calculated,
      timestamp: new Date(),
      isSaved: false,
    });

    // Auto-save measurement if profile exists
    if (currentProfile) {
      addMeasurement({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        userProfileId: currentProfile.id,
        raw,
        calculated,
      });

      addNotification({
        type: 'success',
        title: t('notifications.measurementSaved.title'),
        message: t('notifications.measurementSaved.message', { weight: raw.weightKg.toFixed(1), profileName: currentProfile.name }),
        duration: 5000,
      });
    } else {
      addNotification({
        type: 'info',
        title: t('notifications.newMeasurement.title'),
        message: t('notifications.newMeasurement.message', { weight: raw.weightKg.toFixed(1) }),
        duration: 8000,
      });
    }
  }, [currentProfile, setCurrentMeasurement, addMeasurement, setLiveWeight, setIsStable, addNotification]);

  // Track if using native BLE
  const usingNativeBLERef = useRef(false);

  /**
   * Native BLE Effect
   * Uses Python bleak via IPC when running in Electron on macOS Sequoia
   * This bypasses broken Web Bluetooth
   */
  useEffect(() => {
    if (!isNativeBLEAvailable()) {
      console.log('[AutoBLE] Native BLE not available, using Web Bluetooth');
      return;
    }

    // Skip if already using native BLE or if device is not configured
    if (usingNativeBLERef.current || !deviceMac || !autoConnect) {
      return;
    }

    usingNativeBLERef.current = true;
    console.log('[AutoBLE] Using Native BLE (Python bleak) for auto-connect');

    const nativeBLE = (window as any).electronAPI.nativeBLE;
    const cleanupFns: (() => void)[] = [];

    // Subscribe to measurement events
    const unsubMeasurement = nativeBLE.onMeasurement((measurement: { weightKg: number; impedanceOhm?: number; timestamp: string }) => {
      console.log('[AutoBLE/Native] Measurement received:', measurement);
      handleMeasurement({
        weightKg: measurement.weightKg,
        impedanceOhm: measurement.impedanceOhm,
        timestamp: new Date(measurement.timestamp),
      });
    });
    cleanupFns.push(unsubMeasurement);

    // Subscribe to connected events
    const unsubConnected = nativeBLE.onConnected((device: { id: string; name: string }) => {
      console.log('[AutoBLE/Native] Connected to:', device.name);
      setDeviceName(device.name);
      setConnectionState('connected');
    });
    cleanupFns.push(unsubConnected);

    // Subscribe to disconnected events
    const unsubDisconnected = nativeBLE.onDisconnected(() => {
      console.log('[AutoBLE/Native] Disconnected');
      setConnectionState('disconnected');
    });
    cleanupFns.push(unsubDisconnected);

    // Subscribe to scanning events
    const unsubScanning = nativeBLE.onScanning(() => {
      console.log('[AutoBLE/Native] Scanning started');
      setConnectionState('scanning');
    });
    cleanupFns.push(unsubScanning);

    // Subscribe to discovered events
    const unsubDiscovered = nativeBLE.onDiscovered((device: { id: string; name: string }) => {
      console.log('[AutoBLE/Native] Device discovered:', device.name);
    });
    cleanupFns.push(unsubDiscovered);

    // Subscribe to error events
    const unsubError = nativeBLE.onError((error: string) => {
      console.error('[AutoBLE/Native] Error:', error);
    });
    cleanupFns.push(unsubError);

    // Start scanning automatically
    console.log('[AutoBLE/Native] Starting native BLE scanning...');
    nativeBLE.startScanning().catch((err: Error) => {
      console.error('[AutoBLE/Native] Failed to start scanning:', err);
    });

    // Cleanup on unmount
    return () => {
      console.log('[AutoBLE/Native] Cleaning up...');
      cleanupFns.forEach(fn => fn());
      nativeBLE.stopScanning().catch(console.error);
      usingNativeBLERef.current = false;
    };
  }, [deviceMac, autoConnect, handleMeasurement, setConnectionState]);

  /**
   * Start listening for notifications
   */
  const startListening = useCallback(async (server: BluetoothRemoteGATTServer) => {
    if (isListeningRef.current) return;
    isListeningRef.current = true;

    console.log('[AutoBLE] Starting to listen for measurements...');

    // Try Weight Scale Service
    try {
      const wsService = await server.getPrimaryService(
        uuidFromNumber(SERVICE_UUIDS.WEIGHT_SCALE)
      );
      const wsChar = await wsService.getCharacteristic(
        uuidFromNumber(CHARACTERISTIC_UUIDS.WEIGHT_MEASUREMENT)
      );

      let lastWeight = 0;
      let stableCount = 0;

      wsChar.addEventListener('characteristicvaluechanged', (event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        const value = char.value;
        if (!value) return;

        const parsed = parseWeightMeasurement(value);
        if (parsed) {
          setLiveWeight(parsed.weightKg);

          // Check for stable reading
          if (Math.abs(parsed.weightKg - lastWeight) < 0.1) {
            stableCount++;
          } else {
            stableCount = 0;
          }
          lastWeight = parsed.weightKg;

          // Capture measurement when stable
          if (parsed.isStable || stableCount >= 3) {
            handleMeasurement({
              weightKg: Math.round(parsed.weightKg * 100) / 100,
            });
            stableCount = 0;
          }
        }
      });

      await wsChar.startNotifications();
      characteristicsRef.current.push(wsChar);
      console.log('[AutoBLE] ✓ Subscribed to Weight Scale notifications');
    } catch (err) {
      console.log('[AutoBLE] Weight Scale service not available:', err);
    }

    // Try Body Composition Service
    try {
      const bcService = await server.getPrimaryService(
        uuidFromNumber(SERVICE_UUIDS.BODY_COMPOSITION)
      );
      const bcChar = await bcService.getCharacteristic(
        uuidFromNumber(CHARACTERISTIC_UUIDS.BODY_COMPOSITION_MEASUREMENT)
      );

      bcChar.addEventListener('characteristicvaluechanged', (event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        const value = char.value;
        if (!value) return;

        const parsed = parseBodyComposition(value);
        if (parsed?.weightKg) {
          const flags = value.getUint16(0, true);
          const isStable = (flags & 0x2000) !== 0 || parsed.impedanceOhm !== undefined;

          setLiveWeight(parsed.weightKg);

          if (isStable) {
            handleMeasurement({
              weightKg: Math.round(parsed.weightKg * 100) / 100,
              impedanceOhm: parsed.impedanceOhm,
            });
          }
        }
      });

      await bcChar.startNotifications();
      characteristicsRef.current.push(bcChar);
      console.log('[AutoBLE] ✓ Subscribed to Body Composition notifications');
    } catch (err) {
      console.log('[AutoBLE] Body Composition service not available:', err);
    }
  }, [handleMeasurement, setLiveWeight]);

  /**
   * Cleanup connection
   */
  const cleanup = useCallback(() => {
    isListeningRef.current = false;

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop notifications
    characteristicsRef.current.forEach(async (char) => {
      try {
        await char.stopNotifications();
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    characteristicsRef.current = [];

    // Disconnect
    if (serverRef.current?.connected) {
      serverRef.current.disconnect();
    }
    serverRef.current = null;
    deviceRef.current = null;
  }, []);

  /**
   * Handle disconnection - attempt reconnect
   */
  const handleDisconnect = useCallback(() => {
    console.log('[AutoBLE] Device disconnected');
    setConnectionState('disconnected');
    isListeningRef.current = false;

    // Attempt reconnect if auto-connect is enabled
    if (autoConnect && reconnectAttemptsRef.current < fullConfig.maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
      console.log(`[AutoBLE] Attempting reconnect (${reconnectAttemptsRef.current}/${fullConfig.maxReconnectAttempts})...`);

      reconnectTimeoutRef.current = setTimeout(async () => {
        if (deviceRef.current?.gatt) {
          try {
            setConnectionState('connecting');
            const server = await deviceRef.current.gatt.connect();
            serverRef.current = server;
            setConnectionState('connected');
            reconnectAttemptsRef.current = 0;
            await startListening(server);
          } catch (err) {
            console.error('[AutoBLE] Reconnect failed:', err);
            handleDisconnect();
          }
        }
      }, fullConfig.reconnectDelay);
    } else if (reconnectAttemptsRef.current >= fullConfig.maxReconnectAttempts) {
      console.log('[AutoBLE] Max reconnect attempts reached');
      maxAttemptsCallbackCalledRef.current = true;
      addNotification({
        type: 'warning',
        title: t('notifications.connectionLost.title'),
        message: t('notifications.connectionLost.message'),
        duration: 15000,
        action: {
          label: t('notifications.connectionLost.retryButton'),
          onClick: () => {
            // Reset and retry
            reconnectAttemptsRef.current = 0;
            maxAttemptsCallbackCalledRef.current = false;
            startAutoConnect();
          },
        },
      });
    }
  }, [autoConnect, fullConfig, setConnectionState, startListening, addNotification]);

  /**
   * Scan and connect to device
   */
  const scanAndConnect = useCallback(async (): Promise<boolean> => {
    // Use native BLE if available (Electron/macOS)
    if (isNativeBLEAvailable()) {
      console.log('[AutoBLE] Using native BLE for scan and connect');
      const nativeBLE = (window as any).electronAPI.nativeBLE;

      cleanup();
      setConnectionState('scanning');
      setIsAutoConnecting(true);

      try {
        await nativeBLE.startScanning();
        return true;
      } catch (err) {
        console.error('[AutoBLE/Native] Scan error:', err);
        setConnectionState('idle');
        setIsAutoConnecting(false);
        return false;
      }
    }

    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      console.error('[AutoBLE] Web Bluetooth not available');
      return false;
    }

    cleanup();
    setConnectionState('scanning');
    setIsAutoConnecting(true);

    try {
      console.log('[AutoBLE] Scanning for devices...');
      console.log('[AutoBLE] TIP: Step on the scale to wake it up!');

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          uuidFromNumber(SERVICE_UUIDS.BODY_COMPOSITION),
          uuidFromNumber(SERVICE_UUIDS.WEIGHT_SCALE),
          uuidFromNumber(SERVICE_UUIDS.XIAOMI),
          '00001800-0000-1000-8000-00805f9b34fb',
        ],
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'Unknown Scale');
      console.log('[AutoBLE] Device selected:', device.name, device.id);

      // Save device for auto-connect
      setDeviceConfig({ deviceMac: device.id });
      setAutoConnect(true);

      // Handle disconnection
      device.addEventListener('gattserverdisconnected', handleDisconnect);

      // Connect
      setConnectionState('connecting');
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }
      serverRef.current = server;
      reconnectAttemptsRef.current = 0;

      setConnectionState('connected');
      console.log('[AutoBLE] ✓ Connected!');

      // Start listening for measurements
      await startListening(server);

      addNotification({
        type: 'success',
        title: 'Połączono z wagą',
        message: `${device.name || 'Mi Scale'} - nasłuchiwanie aktywne`,
        duration: 5000,
      });

      return true;
    } catch (err) {
      console.error('[AutoBLE] Connection error:', err);
      setConnectionState('disconnected');
      setIsAutoConnecting(false);

      // Check for specific error types
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorMessage.includes('User cancelled') || errorMessage.includes('cancelled')) {
        // User closed the dialog - show helpful hint
        addNotification({
          type: 'info',
          title: 'Anulowano wybór urządzenia',
          message: 'Wskazówka: Wstań na wagę aby ją obudzić, potem spróbuj ponownie. Waga powinna pojawić się na liście.',
          duration: 8000,
        });
      } else if (errorMessage.includes('Bluetooth') || errorMessage.includes('bluetooth')) {
        addNotification({
          type: 'error',
          title: t('notifications.bluetoothError.title'),
          message: t('notifications.bluetoothError.message'),
          duration: 8000,
        });
      } else {
        addNotification({
          type: 'error',
          title: t('notifications.connectionError.title'),
          message: errorMessage,
          duration: 5000,
        });
      }

      return false;
    }
  }, [cleanup, handleDisconnect, startListening, setConnectionState, setDeviceConfig, setAutoConnect, addNotification]);

  /**
   * Start auto-connect using getDevices() + watchAdvertisements()
   * This allows TRUE automatic reconnection without user gesture!
   */
  // Track if auto-connect was already started
  const autoConnectStartedRef = useRef(false);
  const watchingDeviceRef = useRef<BluetoothDevice | null>(null);

  const startAutoConnect = useCallback(async () => {
    // Skip Web Bluetooth if native BLE is available (Electron/macOS)
    if (isNativeBLEAvailable()) {
      console.log('[AutoBLE] Using native BLE - skipping Web Bluetooth auto-connect');
      return;
    }

    if (!autoConnect || !deviceMac) {
      console.log('[AutoBLE] Auto-connect disabled or no saved device');
      return;
    }

    // Prevent duplicate auto-connect attempts
    if (autoConnectStartedRef.current) {
      console.log('[AutoBLE] Auto-connect already started, skipping...');
      return;
    }

    autoConnectStartedRef.current = true;
    setIsAutoConnecting(true);

    console.log('[AutoBLE] Starting TRUE auto-connect to saved device:', deviceMac);

    // Check if getDevices() is supported (Chrome 85+, Electron)
    if (!navigator.bluetooth?.getDevices) {
      console.log('[AutoBLE] getDevices() not supported, falling back to manual connect');
      addNotification({
        type: 'info',
        title: t('notifications.scaleConfigured.title'),
        message: t('notifications.scaleConfigured.message'),
        duration: 10000,
      });
      return;
    }

    try {
      // Get previously paired devices
      console.log('[AutoBLE] Checking for previously paired devices...');
      const devices = await navigator.bluetooth.getDevices();
      console.log('[AutoBLE] Found', devices.length, 'previously paired device(s)');

      if (devices.length === 0) {
        // Web Bluetooth doesn't persist device access across sessions (security feature)
        // User needs to re-pair once per app launch, then auto-listening works
        console.log('[AutoBLE] No previously paired devices - re-pairing required (Web Bluetooth limitation)');
        setIsAutoConnecting(false);
        // Don't show notification - the SavedDeviceReconnectPrompt UI will guide the user
        return;
      }

      // Find our saved device
      const savedDevice = devices.find(d => d.id === deviceMac);
      if (!savedDevice) {
        console.log('[AutoBLE] Saved device not in current session - re-pairing required');
        setIsAutoConnecting(false);
        // UI will show SavedDeviceReconnectPrompt
        return;
      }

      console.log('[AutoBLE] Found saved device:', savedDevice.name, savedDevice.id);
      deviceRef.current = savedDevice;
      setDeviceName(savedDevice.name || 'Mi Scale');
      watchingDeviceRef.current = savedDevice;

      // Check if watchAdvertisements is supported
      if (!savedDevice.watchAdvertisements) {
        console.log('[AutoBLE] watchAdvertisements() not supported - fallback to manual');
        setIsAutoConnecting(false);
        // UI will show SavedDeviceReconnectPrompt for manual connection
        return;
      }

      // Set up advertisement listener
      const handleAdvertisement = async (event: Event) => {
        const advEvent = event as BluetoothAdvertisingEvent;
        console.log('[AutoBLE] 📡 Advertisement received from:', advEvent.device.name);
        console.log('[AutoBLE] RSSI:', advEvent.rssi, 'dBm');

        // Device is in range! Try to connect automatically
        if (advEvent.device.gatt && !serverRef.current?.connected) {
          try {
            console.log('[AutoBLE] 🔗 Auto-connecting to device...');
            setConnectionState('connecting');

            const server = await advEvent.device.gatt.connect();
            serverRef.current = server;

            // Set up disconnect handler
            advEvent.device.addEventListener('gattserverdisconnected', handleDisconnect);

            setConnectionState('connected');
            reconnectAttemptsRef.current = 0;

            // Start listening for measurements
            await startListening(server);

            addNotification({
              type: 'success',
              title: 'Automatycznie połączono!',
              message: `${advEvent.device.name || 'Mi Scale'} - nasłuchiwanie aktywne`,
              duration: 5000,
            });

            // Stop watching advertisements after successful connection
            try {
              await savedDevice.watchAdvertisements({ signal: AbortSignal.timeout(1) });
            } catch {
              // Expected - we're stopping the watch
            }
          } catch (err) {
            console.error('[AutoBLE] Auto-connect failed:', err);
          }
        }
      };

      // Listen for advertisements
      savedDevice.addEventListener('advertisementreceived', handleAdvertisement);

      // Start watching for advertisements (no user gesture needed!)
      console.log('[AutoBLE] 👀 Starting to watch for advertisements...');
      await savedDevice.watchAdvertisements();

      addNotification({
        type: 'success',
        title: 'Automatyczne nasłuchiwanie aktywne',
        message: 'Wstań na wagę - połączenie nastąpi automatycznie',
        duration: 8000,
      });

      console.log('[AutoBLE] ✓ Watching for device advertisements - will auto-connect when in range');

    } catch (err) {
      console.error('[AutoBLE] Auto-connect setup failed:', err);

      // Fallback to manual connect prompt
      addNotification({
        type: 'info',
        title: t('notifications.scaleConfigured.title'),
        message: t('notifications.scaleConfigured.message'),
        duration: 10000,
      });
    }
  }, [autoConnect, deviceMac, addNotification, handleDisconnect, startListening, setConnectionState]);

  /**
   * Stop auto-connect
   */
  const stopAutoConnect = useCallback(() => {
    console.log('[AutoBLE] Stopping auto-connect');
    setIsAutoConnecting(false);
    cleanup();
    setConnectionState('disconnected');
  }, [cleanup, setConnectionState]);

  /**
   * Save device for future auto-connect
   */
  const saveDevice = useCallback((deviceId: string, name: string) => {
    console.log('[AutoBLE] Saving device:', deviceId, name);
    setDeviceConfig({ deviceMac: deviceId });
    setAutoConnect(true);
    setDeviceName(name);
  }, [setDeviceConfig, setAutoConnect]);

  /**
   * Clear saved device
   */
  const clearSavedDevice = useCallback(() => {
    console.log('[AutoBLE] Clearing saved device');
    notificationShownRef.current = false; // Reset notification flag
    autoConnectStartedRef.current = false; // Reset auto-connect flag to allow reconnection
    clearDeviceConfig();
    setAutoConnect(false);
    cleanup();
  }, [clearDeviceConfig, setAutoConnect, cleanup]);

  /**
   * Auto-start on mount if enabled
   */
  useEffect(() => {
    if (fullConfig.enabled && autoConnect && deviceMac) {
      startAutoConnect();
    }

    return () => {
      cleanup();
    };
  }, []); // Only on mount

  return {
    isAutoConnecting,
    isConnected,
    deviceName,
    lastMeasurement,
    startAutoConnect,
    stopAutoConnect,
    scanAndConnect,
    saveDevice,
    clearSavedDevice,
  };
}

export default useBLEAutoConnect;
