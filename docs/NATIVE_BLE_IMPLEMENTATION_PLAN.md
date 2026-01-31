# Plan Wdrożenia Native Node.js Bluetooth dla Electron

## Cel

Zastąpienie Web Bluetooth API natywną biblioteką Node.js (`@abandonware/noble`) aby umożliwić:
- **TRUE background scanning** bez ograniczeń sesji
- **Automatyczne wykrywanie wagi** bez gestu użytkownika
- **Persystentne połączenie** między restartami aplikacji

---

## 1. Analiza Obecnej Architektury

### Obecny Stack (Web Bluetooth)
```
┌─────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │ useBLEAutoConnect│───▶│ navigator.bluetooth          │   │
│  │     (Hook)       │    │ (Web Bluetooth API)          │   │
│  └─────────────────┘    └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Ograniczenia Web Bluetooth:
1. ❌ `getDevices()` nie persystuje między sesjami
2. ❌ `requestDevice()` wymaga gestu użytkownika
3. ❌ `watchAdvertisements()` działa tylko dla już sparowanych urządzeń
4. ❌ Brak background scanning

---

## 2. Proponowana Architektura (Native BLE)

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS                              │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  NobleBLEAdapter │───▶│  @abandonware/noble          │   │
│  │  (Service Class) │    │  (Native Node.js BLE)        │   │
│  └────────┬────────┘    └──────────────────────────────┘   │
│           │                                                  │
│           │ Events: 'measurement', 'connected', 'error'      │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │   IPC Bridge    │                                        │
│  │ (ipcMain)       │                                        │
│  └────────┬────────┘                                        │
└───────────┼─────────────────────────────────────────────────┘
            │ IPC Channels: 'ble:*'
            ▼
┌───────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                            │
│  ┌─────────────────┐    ┌──────────────────────────────┐     │
│  │ useBLEAutoConnect│───▶│   window.electronBLE         │     │
│  │     (Hook)       │    │   (Preload API)              │     │
│  └─────────────────┘    └──────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Plan Implementacji

### Faza 1: Instalacja i Konfiguracja Noble (1-2 dni)

#### 3.1.1 Instalacja zależności
```bash
npm install @abandonware/noble
npm install --save-dev @electron/rebuild electron-rebuild
```

#### 3.1.2 Konfiguracja native module rebuild
```json
// package.json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "rebuild": "electron-rebuild -f -w @abandonware/noble"
  }
}
```

#### 3.1.3 macOS - Uprawnienia Bluetooth
```xml
<!-- entitlements.plist -->
<key>com.apple.security.device.bluetooth</key>
<true/>
```

### Faza 2: Implementacja NobleBLEAdapter (2-3 dni)

#### 3.2.1 Struktura plików
```
src/
├── main/
│   ├── ble/
│   │   ├── NobleBLEAdapter.ts       # Główna klasa adaptera
│   │   ├── MiScaleParser.ts         # Parser danych wagi
│   │   ├── BLETypes.ts              # Typy TypeScript
│   │   └── index.ts                 # Exports
│   ├── main.ts                      # Integracja z main process
│   └── ipc-handlers.ts              # IPC handlers dla BLE
```

#### 3.2.2 Kod NobleBLEAdapter
```typescript
// src/main/ble/NobleBLEAdapter.ts
import noble from '@abandonware/noble';
import { EventEmitter } from 'events';
import type { RawMeasurement } from '../../domain/calculations/types';

// Mi Scale Service UUIDs
const MI_SCALE_SERVICE_UUID = '181b'; // Body Composition
const MI_SCALE_CHAR_UUID = '2a9c';    // Body Composition Measurement
const WEIGHT_SERVICE_UUID = '181d';   // Weight Scale
const WEIGHT_CHAR_UUID = '2a9d';      // Weight Measurement

// Mi Scale device name patterns
const MI_SCALE_PATTERNS = [
  /^MIBFS/i,
  /^MIBCS/i,
  /^XMTZC/i,
  /^MI_?SCALE/i,
];

interface BLEConfig {
  deviceMac: string | null;
  autoConnect: boolean;
  scanInterval: number;
}

export class NobleBLEAdapter extends EventEmitter {
  private config: BLEConfig;
  private isScanning = false;
  private connectedPeripheral: noble.Peripheral | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BLEConfig> = {}) {
    super();
    this.config = {
      deviceMac: null,
      autoConnect: true,
      scanInterval: 5000,
      ...config,
    };

    this.setupNobleEvents();
  }

  private setupNobleEvents(): void {
    noble.on('stateChange', (state) => {
      console.log('[Noble] State changed:', state);
      if (state === 'poweredOn') {
        this.emit('ready');
        if (this.config.autoConnect) {
          this.startScanning();
        }
      } else {
        this.emit('unavailable', state);
      }
    });

    noble.on('discover', this.handleDiscoveredDevice.bind(this));
  }

  private handleDiscoveredDevice(peripheral: noble.Peripheral): void {
    const { localName, manufacturerData } = peripheral.advertisement;

    // Check if this is a Mi Scale
    const isMiScale = MI_SCALE_PATTERNS.some(p =>
      localName && p.test(localName)
    );

    if (!isMiScale) return;

    console.log('[Noble] Mi Scale found:', localName, peripheral.id);

    // If we have a saved device, only connect to that one
    if (this.config.deviceMac && peripheral.id !== this.config.deviceMac) {
      return;
    }

    // Check advertisement data for weight measurement
    if (manufacturerData) {
      const measurement = this.parseAdvertisementData(manufacturerData);
      if (measurement) {
        this.emit('measurement', measurement);
      }
    }

    // Connect if not already connected
    if (!this.connectedPeripheral) {
      this.connectToPeripheral(peripheral);
    }
  }

  private parseAdvertisementData(data: Buffer): RawMeasurement | null {
    // Mi Scale broadcasts weight in advertisement data
    // Format varies by model - this is for Mi Scale 2
    if (data.length < 13) return null;

    // Check for stabilized weight flag (byte 0, bit 5)
    const isStable = (data[0] & 0x20) !== 0;
    if (!isStable) return null;

    // Weight is at bytes 11-12, little-endian, in units of 50g
    const weightRaw = data.readUInt16LE(11);
    const weightKg = weightRaw / 200; // Convert to kg

    // Impedance if available (bytes 9-10)
    let impedanceOhm: number | undefined;
    if (data.length >= 11 && data[9] !== 0) {
      impedanceOhm = data.readUInt16LE(9);
    }

    return {
      weightKg: Math.round(weightKg * 100) / 100,
      impedanceOhm,
    };
  }

  private async connectToPeripheral(peripheral: noble.Peripheral): Promise<void> {
    try {
      // Stop scanning before connecting (required by some adapters)
      await this.stopScanning();

      console.log('[Noble] Connecting to:', peripheral.id);
      this.emit('connecting', peripheral.id);

      await peripheral.connectAsync();
      this.connectedPeripheral = peripheral;
      this.config.deviceMac = peripheral.id;

      console.log('[Noble] Connected!');
      this.emit('connected', {
        id: peripheral.id,
        name: peripheral.advertisement.localName,
      });

      // Setup disconnect handler
      peripheral.once('disconnect', () => {
        console.log('[Noble] Disconnected');
        this.connectedPeripheral = null;
        this.emit('disconnected');

        // Auto-reconnect
        if (this.config.autoConnect) {
          this.scheduleReconnect();
        }
      });

      // Subscribe to notifications
      await this.subscribeToNotifications(peripheral);

    } catch (error) {
      console.error('[Noble] Connection error:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  private async subscribeToNotifications(peripheral: noble.Peripheral): Promise<void> {
    const services = await peripheral.discoverServicesAsync([
      MI_SCALE_SERVICE_UUID,
      WEIGHT_SERVICE_UUID,
    ]);

    for (const service of services) {
      const characteristics = await service.discoverCharacteristicsAsync([
        MI_SCALE_CHAR_UUID,
        WEIGHT_CHAR_UUID,
      ]);

      for (const char of characteristics) {
        if (char.properties.includes('notify')) {
          char.on('data', (data) => {
            const measurement = this.parseCharacteristicData(char.uuid, data);
            if (measurement) {
              this.emit('measurement', measurement);
            }
          });

          await char.subscribeAsync();
          console.log('[Noble] Subscribed to:', char.uuid);
        }
      }
    }
  }

  private parseCharacteristicData(uuid: string, data: Buffer): RawMeasurement | null {
    if (uuid === MI_SCALE_CHAR_UUID || uuid === WEIGHT_CHAR_UUID) {
      // Standard BLE Weight Measurement format
      const flags = data.readUInt8(0);
      const isStable = (flags & 0x20) !== 0;

      if (!isStable) return null;

      const weightRaw = data.readUInt16LE(1);
      const isImperial = (flags & 0x01) !== 0;

      let weightKg = isImperial
        ? (weightRaw * 0.01) * 0.453592
        : weightRaw * 0.005;

      return {
        weightKg: Math.round(weightKg * 100) / 100,
      };
    }

    return null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[Noble] Attempting reconnect...');
      this.startScanning();
    }, this.config.scanInterval);
  }

  async startScanning(): Promise<void> {
    if (this.isScanning) return;

    if (noble.state !== 'poweredOn') {
      console.log('[Noble] Bluetooth not ready, waiting...');
      return;
    }

    console.log('[Noble] Starting scan...');
    this.isScanning = true;
    this.emit('scanning');

    // Scan for Body Composition and Weight Scale services
    await noble.startScanningAsync(
      [MI_SCALE_SERVICE_UUID, WEIGHT_SERVICE_UUID],
      true // Allow duplicates for continuous advertisement data
    );
  }

  async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    console.log('[Noble] Stopping scan...');
    this.isScanning = false;
    await noble.stopScanningAsync();
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectedPeripheral) {
      await this.connectedPeripheral.disconnectAsync();
      this.connectedPeripheral = null;
    }

    await this.stopScanning();
  }

  setDeviceMac(mac: string | null): void {
    this.config.deviceMac = mac;
  }

  getConnectedDevice(): { id: string; name: string } | null {
    if (!this.connectedPeripheral) return null;
    return {
      id: this.connectedPeripheral.id,
      name: this.connectedPeripheral.advertisement.localName || 'Unknown',
    };
  }

  isConnected(): boolean {
    return this.connectedPeripheral !== null;
  }
}
```

### Faza 3: Integracja z Main Process (1 dzień)

#### 3.3.1 IPC Handlers
```typescript
// src/main/ipc-handlers.ts - dodać:

import { NobleBLEAdapter } from './ble/NobleBLEAdapter';

let bleAdapter: NobleBLEAdapter | null = null;

export function setupNobleBLE(mainWindow: BrowserWindow): () => void {
  bleAdapter = new NobleBLEAdapter({
    autoConnect: true,
  });

  // Forward events to renderer
  bleAdapter.on('measurement', (measurement) => {
    mainWindow.webContents.send('ble:measurement', measurement);
  });

  bleAdapter.on('connected', (device) => {
    mainWindow.webContents.send('ble:connected', device);
  });

  bleAdapter.on('disconnected', () => {
    mainWindow.webContents.send('ble:disconnected');
  });

  bleAdapter.on('scanning', () => {
    mainWindow.webContents.send('ble:scanning');
  });

  bleAdapter.on('error', (error) => {
    mainWindow.webContents.send('ble:error', error.message);
  });

  // IPC handlers
  ipcMain.handle('ble:start-scanning', async () => {
    await bleAdapter?.startScanning();
    return true;
  });

  ipcMain.handle('ble:stop-scanning', async () => {
    await bleAdapter?.stopScanning();
    return true;
  });

  ipcMain.handle('ble:disconnect', async () => {
    await bleAdapter?.disconnect();
    return true;
  });

  ipcMain.handle('ble:set-device', async (_event, mac: string) => {
    bleAdapter?.setDeviceMac(mac);
    return true;
  });

  ipcMain.handle('ble:get-status', () => {
    return {
      isConnected: bleAdapter?.isConnected() ?? false,
      device: bleAdapter?.getConnectedDevice(),
    };
  });

  // Cleanup function
  return () => {
    bleAdapter?.disconnect();
    bleAdapter?.removeAllListeners();
    bleAdapter = null;
  };
}
```

### Faza 4: Preload Bridge (0.5 dnia)

```typescript
// src/main/preload.ts - dodać:

const electronBLE = {
  // Commands
  startScanning: () => ipcRenderer.invoke('ble:start-scanning'),
  stopScanning: () => ipcRenderer.invoke('ble:stop-scanning'),
  disconnect: () => ipcRenderer.invoke('ble:disconnect'),
  setDevice: (mac: string) => ipcRenderer.invoke('ble:set-device', mac),
  getStatus: () => ipcRenderer.invoke('ble:get-status'),

  // Event subscriptions
  onMeasurement: (callback: (measurement: any) => void) => {
    const handler = (_event: any, measurement: any) => callback(measurement);
    ipcRenderer.on('ble:measurement', handler);
    return () => ipcRenderer.removeListener('ble:measurement', handler);
  },

  onConnected: (callback: (device: any) => void) => {
    const handler = (_event: any, device: any) => callback(device);
    ipcRenderer.on('ble:connected', handler);
    return () => ipcRenderer.removeListener('ble:connected', handler);
  },

  onDisconnected: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('ble:disconnected', handler);
    return () => ipcRenderer.removeListener('ble:disconnected', handler);
  },

  onScanning: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('ble:scanning', handler);
    return () => ipcRenderer.removeListener('ble:scanning', handler);
  },

  onError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error);
    ipcRenderer.on('ble:error', handler);
    return () => ipcRenderer.removeListener('ble:error', handler);
  },
};

contextBridge.exposeInMainWorld('electronBLE', electronBLE);
```

### Faza 5: Aktualizacja Hook'a w Renderer (1 dzień)

```typescript
// src/presentation/hooks/useNativeBLE.ts

export function useNativeBLE() {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<RawMeasurement | null>(null);

  useEffect(() => {
    // Subscribe to events
    const unsubMeasurement = window.electronBLE.onMeasurement((measurement) => {
      setLastMeasurement(measurement);
      // Auto-save logic here...
    });

    const unsubConnected = window.electronBLE.onConnected((device) => {
      setIsConnected(true);
      setDeviceName(device.name);
    });

    const unsubDisconnected = window.electronBLE.onDisconnected(() => {
      setIsConnected(false);
    });

    const unsubScanning = window.electronBLE.onScanning(() => {
      setIsScanning(true);
    });

    // Start scanning on mount
    window.electronBLE.startScanning();

    return () => {
      unsubMeasurement();
      unsubConnected();
      unsubDisconnected();
      unsubScanning();
    };
  }, []);

  return {
    isConnected,
    isScanning,
    deviceName,
    lastMeasurement,
    startScanning: () => window.electronBLE.startScanning(),
    stopScanning: () => window.electronBLE.stopScanning(),
    disconnect: () => window.electronBLE.disconnect(),
  };
}
```

---

## 4. Wymagania Systemowe

### macOS
- **Bluetooth permissions**: `System Preferences → Security & Privacy → Bluetooth`
- **Code signing**: Wymaga podpisania dla dostępu do Bluetooth
- **Entitlements**: `com.apple.security.device.bluetooth`

### Buildowanie Native Modules

```bash
# Dla macOS arm64 (Apple Silicon)
npm run rebuild -- --arch=arm64

# Dla macOS x64 (Intel)
npm run rebuild -- --arch=x64

# Universal binary
npm run rebuild -- --arch=universal
```

---

## 5. Porównanie Rozwiązań

| Aspekt | Web Bluetooth | Native Noble |
|--------|--------------|--------------|
| **Background scanning** | ❌ Ograniczone | ✅ Pełne |
| **Gest użytkownika** | ❌ Wymagany | ✅ Nie wymagany |
| **Persystencja sesji** | ❌ Brak | ✅ Pełna |
| **Złożoność** | ✅ Prosta | ⚠️ Średnia |
| **Native modules** | ✅ Nie wymaga | ⚠️ Wymaga rebuild |
| **Cross-platform** | ✅ Tak | ⚠️ Wymaga konfiguracji |

---

## 6. Harmonogram

| Faza | Czas | Priorytet |
|------|------|-----------|
| 1. Instalacja Noble | 1-2 dni | Wysoki |
| 2. NobleBLEAdapter | 2-3 dni | Wysoki |
| 3. IPC Integration | 1 dzień | Wysoki |
| 4. Preload Bridge | 0.5 dnia | Wysoki |
| 5. Hook Update | 1 dzień | Wysoki |
| 6. Testing | 1-2 dni | Wysoki |
| **TOTAL** | **7-10 dni** | |

---

## 7. Ryzyka i Mitygacja

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|--------|-------------------|-----------|
| Native module rebuild issues | Średnie | Użycie electron-rebuild, testowanie na CI |
| macOS permission issues | Niskie | Dokumentacja, entitlements |
| Mi Scale protocol changes | Niskie | Parser z fallback'ami |
| Performance (ciągłe skanowanie) | Niskie | Throttling, batching events |

---

## 8. Źródła

- [@abandonware/noble - npm](https://www.npmjs.com/package/@abandonware/noble)
- [GitHub - abandonware/noble](https://github.com/abandonware/noble)
- [Scanning BLE Advertisements with TypeScript](https://www.timsanteford.com/posts/scanning-ble-advertisements-with-typescript-and-abandonware-noble/)
- [Xiaomi Bluetooth Mi Scale - openScale wiki](https://github.com/oliexdev/openScale/wiki/Xiaomi-Bluetooth-Mi-Scale)
- [Reading Xiaomi Mi Scale data - DEV Community](https://dev.to/henrylim96/reading-xiaomi-mi-scale-data-with-web-bluetooth-scanning-api-1mb9)
- [Electron IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Apple Silicon Support](https://www.electronjs.org/blog/apple-silicon)
