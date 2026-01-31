/**
 * AppConfigStore Tests (TDD)
 *
 * Tests for electron-store based configuration persistence.
 * Written BEFORE implementation following TDD approach.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock electron-store for testing
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const store = new Map<string, unknown>();
      return {
        get: vi.fn((key: string, defaultValue?: unknown) => {
          return store.has(key) ? store.get(key) : defaultValue;
        }),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
        }),
        delete: vi.fn((key: string) => {
          store.delete(key);
        }),
        has: vi.fn((key: string) => store.has(key)),
        clear: vi.fn(() => store.clear()),
        store: store,
      };
    }),
  };
});

// Import after mocking
import {
  AppConfigStore,
  type BLEConfig,
  type AppSettings,
} from '../AppConfigStore';

describe('AppConfigStore', () => {
  let configStore: AppConfigStore;

  beforeEach(() => {
    configStore = new AppConfigStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('BLE Configuration', () => {
    it('should return default BLE config when not set', () => {
      const config = configStore.getBLEConfig();

      expect(config).toEqual({
        deviceMac: null,
        bleKey: null,
        autoConnect: false,
        scanTimeout: 30000,
      });
    });

    it('should save and retrieve BLE config', () => {
      const bleConfig: BLEConfig = {
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        bleKey: 'test-key-123',
        autoConnect: true,
        scanTimeout: 60000,
      };

      configStore.setBLEConfig(bleConfig);
      const retrieved = configStore.getBLEConfig();

      expect(retrieved).toEqual(bleConfig);
    });

    it('should update partial BLE config', () => {
      configStore.setBLEConfig({
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        bleKey: 'initial-key',
        autoConnect: false,
        scanTimeout: 30000,
      });

      configStore.updateBLEConfig({ bleKey: 'updated-key', autoConnect: true });
      const config = configStore.getBLEConfig();

      expect(config.deviceMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(config.bleKey).toBe('updated-key');
      expect(config.autoConnect).toBe(true);
    });

    it('should clear BLE config', () => {
      configStore.setBLEConfig({
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        bleKey: 'test-key',
        autoConnect: true,
        scanTimeout: 30000,
      });

      configStore.clearBLEConfig();
      const config = configStore.getBLEConfig();

      expect(config.deviceMac).toBeNull();
      expect(config.bleKey).toBeNull();
    });

    it('should validate MAC address format', () => {
      expect(() =>
        configStore.setBLEConfig({
          deviceMac: 'invalid-mac',
          bleKey: 'key',
          autoConnect: false,
          scanTimeout: 30000,
        })
      ).toThrow(/invalid.*mac/i);
    });

    it('should accept valid MAC address formats', () => {
      const validMacs = [
        'AA:BB:CC:DD:EE:FF',
        'aa:bb:cc:dd:ee:ff',
        '1C:EA:AC:5D:A7:B0',
      ];

      for (const mac of validMacs) {
        expect(() =>
          configStore.setBLEConfig({
            deviceMac: mac,
            bleKey: 'key',
            autoConnect: false,
            scanTimeout: 30000,
          })
        ).not.toThrow();
      }
    });
  });

  describe('App Settings', () => {
    it('should return default app settings when not set', () => {
      const settings = configStore.getAppSettings();

      expect(settings).toEqual({
        theme: 'system',
        language: 'pl',
        dataVersion: '1.0.0',
      });
    });

    it('should save and retrieve app settings', () => {
      const settings: AppSettings = {
        theme: 'dark',
        language: 'en',
        dataVersion: '1.0.0',
      };

      configStore.setAppSettings(settings);
      const retrieved = configStore.getAppSettings();

      expect(retrieved).toEqual(settings);
    });

    it('should update partial app settings', () => {
      configStore.updateAppSettings({ theme: 'dark' });
      const settings = configStore.getAppSettings();

      expect(settings.theme).toBe('dark');
      expect(settings.language).toBe('pl'); // default unchanged
    });
  });

  describe('Data Version & Migrations', () => {
    it('should return current data version', () => {
      const version = configStore.getDataVersion();
      expect(version).toBe('1.0.0');
    });

    it('should update data version after migration', () => {
      configStore.setDataVersion('1.1.0');
      expect(configStore.getDataVersion()).toBe('1.1.0');
    });

    it('should detect if migration is needed', () => {
      // Default version is 1.0.0, so no migration needed for same version
      expect(configStore.needsMigration('1.0.0')).toBe(false);

      // Migration needed for newer versions
      expect(configStore.needsMigration('1.1.0')).toBe(true);
      expect(configStore.needsMigration('2.0.0')).toBe(true);
    });
  });

  describe('Export/Import', () => {
    it('should export all config data', () => {
      configStore.setBLEConfig({
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        bleKey: 'test-key',
        autoConnect: true,
        scanTimeout: 30000,
      });

      const exported = configStore.exportConfig();

      expect(exported).toHaveProperty('ble');
      expect(exported).toHaveProperty('settings');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported).toHaveProperty('version');
    });

    it('should import config data', () => {
      const importData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        ble: {
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'imported-key',
          autoConnect: true,
          scanTimeout: 45000,
        },
        settings: {
          theme: 'dark' as const,
          language: 'en',
          dataVersion: '1.0.0',
        },
      };

      configStore.importConfig(importData);

      expect(configStore.getBLEConfig().bleKey).toBe('imported-key');
      expect(configStore.getAppSettings().theme).toBe('dark');
    });

    it('should reject import with incompatible version', () => {
      const incompatibleData = {
        version: '99.0.0', // Future incompatible version
        exportedAt: new Date().toISOString(),
        ble: {
          deviceMac: 'AA:BB:CC:DD:EE:FF',
          bleKey: 'key',
          autoConnect: false,
          scanTimeout: 30000,
        },
        settings: {
          theme: 'light' as const,
          language: 'pl',
          dataVersion: '99.0.0',
        },
      };

      expect(() => configStore.importConfig(incompatibleData)).toThrow(
        /incompatible.*version/i
      );
    });
  });

  describe('Reset', () => {
    it('should reset all config to defaults', () => {
      configStore.setBLEConfig({
        deviceMac: 'AA:BB:CC:DD:EE:FF',
        bleKey: 'test-key',
        autoConnect: true,
        scanTimeout: 60000,
      });
      configStore.updateAppSettings({ theme: 'dark' });

      configStore.reset();

      expect(configStore.getBLEConfig().deviceMac).toBeNull();
      expect(configStore.getAppSettings().theme).toBe('system');
    });
  });
});
