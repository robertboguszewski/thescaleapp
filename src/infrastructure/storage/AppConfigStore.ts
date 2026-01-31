/**
 * AppConfigStore
 *
 * Centralized configuration storage using electron-store.
 * Replaces localStorage-based Zustand persist for more reliable
 * and feature-rich configuration management.
 *
 * Features:
 * - Schema validation
 * - Data versioning for migrations
 * - Export/import functionality
 * - Type-safe access to BLE and app settings
 *
 * @module infrastructure/storage/AppConfigStore
 */

import Store from 'electron-store';

/**
 * BLE device configuration
 */
export interface BLEConfig {
  deviceMac: string | null;
  bleKey: string | null;
  autoConnect: boolean;
  scanTimeout: number;
}

/**
 * Application settings
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  dataVersion: string;
}

/**
 * Complete store schema
 */
interface StoreSchema {
  ble: BLEConfig;
  settings: AppSettings;
}

/**
 * Export data format
 */
export interface ConfigExport {
  version: string;
  exportedAt: string;
  ble: BLEConfig;
  settings: AppSettings;
}

/**
 * Default BLE configuration
 */
const DEFAULT_BLE_CONFIG: BLEConfig = {
  deviceMac: null,
  bleKey: null,
  autoConnect: false,
  scanTimeout: 30000,
};

/**
 * Default app settings
 */
const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'pl',
  dataVersion: '1.0.0',
};

/**
 * Current app version for compatibility checks
 */
const CURRENT_VERSION = '1.0.0';

/**
 * MAC address validation regex
 */
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;

/**
 * Validate MAC address format
 */
function isValidMacAddress(mac: string | null): boolean {
  if (mac === null) return true;
  return MAC_ADDRESS_REGEX.test(mac);
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * AppConfigStore - electron-store based configuration manager
 */
export class AppConfigStore {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'thescale-config',
      defaults: {
        ble: DEFAULT_BLE_CONFIG,
        settings: DEFAULT_APP_SETTINGS,
      },
      // Migrations run automatically when version changes
      migrations: {
        '1.0.0': (store) => {
          // Initial version - ensure defaults exist
          if (!store.has('ble')) {
            store.set('ble', DEFAULT_BLE_CONFIG);
          }
          if (!store.has('settings')) {
            store.set('settings', DEFAULT_APP_SETTINGS);
          }
        },
      },
    });
  }

  // ==================== BLE Configuration ====================

  /**
   * Get current BLE configuration
   */
  getBLEConfig(): BLEConfig {
    return this.store.get('ble', DEFAULT_BLE_CONFIG);
  }

  /**
   * Set complete BLE configuration
   */
  setBLEConfig(config: BLEConfig): void {
    // Validate MAC address
    if (!isValidMacAddress(config.deviceMac)) {
      throw new Error(`Invalid MAC address format: ${config.deviceMac}`);
    }

    this.store.set('ble', config);
  }

  /**
   * Update partial BLE configuration
   */
  updateBLEConfig(partial: Partial<BLEConfig>): void {
    const current = this.getBLEConfig();
    const updated = { ...current, ...partial };

    // Validate MAC if provided
    if (partial.deviceMac !== undefined && !isValidMacAddress(partial.deviceMac)) {
      throw new Error(`Invalid MAC address format: ${partial.deviceMac}`);
    }

    this.store.set('ble', updated);
  }

  /**
   * Clear BLE configuration (reset to defaults)
   */
  clearBLEConfig(): void {
    this.store.set('ble', DEFAULT_BLE_CONFIG);
  }

  // ==================== App Settings ====================

  /**
   * Get current app settings
   */
  getAppSettings(): AppSettings {
    return this.store.get('settings', DEFAULT_APP_SETTINGS);
  }

  /**
   * Set complete app settings
   */
  setAppSettings(settings: AppSettings): void {
    this.store.set('settings', settings);
  }

  /**
   * Update partial app settings
   */
  updateAppSettings(partial: Partial<AppSettings>): void {
    const current = this.getAppSettings();
    this.store.set('settings', { ...current, ...partial });
  }

  // ==================== Data Version & Migrations ====================

  /**
   * Get current data version
   */
  getDataVersion(): string {
    return this.getAppSettings().dataVersion;
  }

  /**
   * Set data version (after migration)
   */
  setDataVersion(version: string): void {
    this.updateAppSettings({ dataVersion: version });
  }

  /**
   * Check if migration is needed to target version
   */
  needsMigration(targetVersion: string): boolean {
    const currentVersion = this.getDataVersion();
    return compareVersions(currentVersion, targetVersion) < 0;
  }

  // ==================== Export/Import ====================

  /**
   * Export all configuration data
   */
  exportConfig(): ConfigExport {
    return {
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      ble: this.getBLEConfig(),
      settings: this.getAppSettings(),
    };
  }

  /**
   * Import configuration data
   */
  importConfig(data: ConfigExport): void {
    // Check version compatibility
    if (compareVersions(data.version, CURRENT_VERSION) > 0) {
      throw new Error(
        `Incompatible version: ${data.version}. Current version is ${CURRENT_VERSION}`
      );
    }

    // Validate and import BLE config
    if (data.ble.deviceMac && !isValidMacAddress(data.ble.deviceMac)) {
      throw new Error(`Invalid MAC address in import: ${data.ble.deviceMac}`);
    }

    this.store.set('ble', data.ble);
    this.store.set('settings', data.settings);
  }

  // ==================== Reset ====================

  /**
   * Reset all configuration to defaults
   */
  reset(): void {
    this.store.set('ble', DEFAULT_BLE_CONFIG);
    this.store.set('settings', DEFAULT_APP_SETTINGS);
  }
}

/**
 * Singleton instance for use in main process
 */
let instance: AppConfigStore | null = null;

/**
 * Get or create AppConfigStore singleton
 */
export function getAppConfigStore(): AppConfigStore {
  if (!instance) {
    instance = new AppConfigStore();
  }
  return instance;
}
