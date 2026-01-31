/**
 * DeviceSettings Component
 *
 * Settings for configuring Xiaomi scale connection.
 * Manages MAC address, BLE key, and connection preferences.
 * Includes auto-scan feature for discovering nearby Mi Scale devices.
 *
 * @module presentation/components/settings/DeviceSettings
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { useBLEStore, useIsDeviceConfigured, useIsConnected } from '../../stores/bleStore';
import { useAppStore } from '../../stores/appStore';
import { XiaomiCloudLogin } from './XiaomiCloudLogin';
import type { BLEDeviceInfo } from '../../../application/ports/BLEPort';

/**
 * Text input component
 */
const SettingsInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  type?: 'text' | 'password';
  pattern?: string;
}> = ({ label, value, onChange, placeholder, helperText, type = 'text', pattern }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      pattern={pattern}
      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
    />
    {helperText && (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    )}
  </div>
);

/**
 * Toggle switch component
 */
const SettingsToggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}
      `}
    >
      <span
        className={`
          inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  </div>
);

/**
 * Number input for settings
 */
const SettingsNumber: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helperText?: string;
}> = ({ label, value, onChange, min, max, step = 1, unit, helperText }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}
    </label>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min || 0)}
        min={min}
        max={max}
        step={step}
        className="w-24 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
      {unit && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
      )}
    </div>
    {helperText && (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    )}
  </div>
);

/**
 * Device list item component
 */
const DeviceListItem: React.FC<{
  device: BLEDeviceInfo;
  isSelected: boolean;
  onSelect: (device: BLEDeviceInfo) => void;
}> = ({ device, isSelected, onSelect }) => {
  // Calculate signal strength indicator
  const signalBars = device.rssi > -50 ? 4 : device.rssi > -60 ? 3 : device.rssi > -70 ? 2 : 1;

  return (
    <button
      onClick={() => onSelect(device)}
      className={`
        w-full p-3 rounded-lg border-2 text-left transition-all
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Bluetooth icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isSelected ? 'bg-primary-100 dark:bg-primary-800' : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <svg
              className={`w-5 h-5 ${isSelected ? 'text-primary-600' : 'text-gray-500'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{device.mac}</p>
          </div>
        </div>
        {/* Signal strength */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((bar) => (
            <div
              key={bar}
              className={`w-1 rounded-full ${
                bar <= signalBars
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              style={{ height: `${bar * 4 + 4}px` }}
            />
          ))}
          <span className="ml-2 text-xs text-gray-500">{device.rssi}dBm</span>
        </div>
      </div>
    </button>
  );
};

/**
 * DeviceSettings component
 */
export const DeviceSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common', 'ble']);
  const {
    deviceMac,
    deviceName,
    bleKey,
    autoConnect,
    scanTimeout,
    discoveredDevices,
    isScanning,
    setDeviceConfig,
    setAutoConnect,
    setScanTimeout,
    clearDeviceConfig,
    setIsScanning,
    addDiscoveredDevice,
    clearDiscoveredDevices,
    connectionState,
  } = useBLEStore();
  const isDeviceConfigured = useIsDeviceConfigured();
  const isConnected = useIsConnected();
  const { addNotification } = useAppStore();

  // Local form state
  const [localMac, setLocalMac] = React.useState(deviceMac || '');
  const [localKey, setLocalKey] = React.useState(bleKey || '');
  const [localName, setLocalName] = React.useState(deviceName || '');
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track changes
  React.useEffect(() => {
    setHasChanges(
      localMac !== (deviceMac || '') ||
      localKey !== (bleKey || '') ||
      localName !== (deviceName || '')
    );
  }, [localMac, localKey, localName, deviceMac, bleKey, deviceName]);

  // Sync local state when store is updated externally (e.g., from XiaomiCloudLogin)
  React.useEffect(() => {
    if (deviceMac && deviceMac !== localMac) {
      setLocalMac(deviceMac);
    }
    if (bleKey && bleKey !== localKey) {
      setLocalKey(bleKey);
    }
    if (deviceName && deviceName !== localName) {
      setLocalName(deviceName);
    }
  }, [deviceMac, bleKey, deviceName]);

  // Setup device discovery listener
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onBLEDeviceDiscovered((device) => {
      addDiscoveredDevice(device);
    });

    return () => {
      unsubscribe();
    };
  }, [addDiscoveredDevice]);

  // Format MAC address
  const formatMacAddress = (value: string): string => {
    // Remove all non-hex characters
    const cleaned = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    // Insert colons every 2 characters
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    return formatted.slice(0, 17); // Max length: XX:XX:XX:XX:XX:XX
  };

  // Handle MAC address change
  const handleMacChange = (value: string) => {
    setLocalMac(formatMacAddress(value));
  };

  // Validate MAC address (accepts both upper and lowercase)
  const isValidMac = (mac: string): boolean => {
    return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/i.test(mac);
  };

  // Validate BLE key (24 or 32 hex characters - Mi Scale uses 32)
  const isValidKey = (key: string): boolean => {
    return /^[0-9A-Fa-f]{24}$/.test(key) || /^[0-9A-Fa-f]{32}$/.test(key);
  };

  // Handle save
  const handleSave = () => {
    if (!isValidMac(localMac)) {
      addNotification({
        type: 'error',
        title: t('device.invalidMac'),
        message: t('device.invalidMacFormat'),
        duration: 5000,
      });
      return;
    }

    if (!isValidKey(localKey)) {
      addNotification({
        type: 'error',
        title: t('device.invalidKey'),
        message: t('device.invalidKeyFormat'),
        duration: 5000,
      });
      return;
    }

    setDeviceConfig({
      deviceMac: localMac,
      bleKey: localKey,
      deviceName: localName || undefined,
    });
    addNotification({
      type: 'success',
      title: t('device.saved'),
      duration: 3000,
    });
  };

  // Handle clear
  const handleClear = () => {
    clearDeviceConfig();
    setLocalMac('');
    setLocalKey('');
    setLocalName('');
    addNotification({
      type: 'info',
      title: t('device.cleared'),
      duration: 3000,
    });
  };

  // Handle scan for devices using Native BLE (noble)
  const handleScanForDevices = async () => {
    clearDiscoveredDevices();
    setIsScanning(true);

    // Setup listener for discovered devices
    const unsubscribeDiscovered = window.electronAPI.nativeBLE.onDiscovered((device) => {
      console.log('[DeviceSettings] Device discovered:', device);
      const bleDevice: BLEDeviceInfo = {
        mac: device.id,
        name: device.name || 'Mi Scale',
        rssi: -50,
      };
      addDiscoveredDevice(bleDevice);

      // Auto-select first device found
      if (!localMac) {
        setLocalMac(device.id);
        setLocalName(device.name || 'Mi Scale');
      }
    });

    // Setup error listener
    const unsubscribeError = window.electronAPI.nativeBLE.onError((error) => {
      console.error('[DeviceSettings] BLE error:', error);
      addNotification({
        type: 'error',
        title: t('device.scanError'),
        message: error,
        duration: 5000,
      });
    });

    try {
      console.log('[DeviceSettings] Starting Native BLE scan...');

      // Start scanning via native BLE
      const result = await window.electronAPI.nativeBLE.startScanning();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to start scanning');
      }

      // Wait for scan duration (10 seconds)
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Stop scanning
      await window.electronAPI.nativeBLE.stopScanning();

      // Check if we found any devices
      if (discoveredDevices.length > 0) {
        addNotification({
          type: 'success',
          title: t('device.scanComplete'),
          message: t('device.foundDevices', { count: discoveredDevices.length }),
          duration: 8000,
        });
      } else {
        addNotification({
          type: 'error',
          title: t('device.scanError'),
          message: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      // Cleanup listeners
      unsubscribeDiscovered();
      unsubscribeError();
      setIsScanning(false);
    }
  };

  // Handle stop scan
  const handleStopScan = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.nativeBLE.stopScanning();
    setIsScanning(false);
  };

  // Handle device selection
  const handleSelectDevice = (device: BLEDeviceInfo) => {
    setLocalMac(device.mac);
    setLocalName(device.name || 'Mi Scale');
    addNotification({
      type: 'info',
      title: t('device.deviceSelected'),
      message: `${device.name || 'Mi Scale'} (${device.mac})`,
      duration: 3000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isConnected
                ? 'bg-green-100 dark:bg-green-900/30'
                : isDeviceConfigured
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              <svg
                className={`w-6 h-6 ${
                  isConnected
                    ? 'text-green-500'
                    : isDeviceConfigured
                      ? 'text-yellow-500'
                      : 'text-gray-400'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {isConnected
                  ? t('device.connected')
                  : isDeviceConfigured
                    ? t('ble:status.configured')
                    : t('ble:status.notConfigured')}
                {deviceName && isDeviceConfigured && (
                  <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                    ({deviceName})
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {deviceMac || t('device.noMacAddress')}
              </p>
            </div>
          </div>
          {isDeviceConfigured && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              {t('common:buttons.clear')}
            </Button>
          )}
        </div>
      </Card>

      {/* Auto-scan for devices */}
      <Card title={t('device.detectScale')} subtitle={t('device.detectScaleDesc')}>
        <div className="space-y-4">
          {/* Scan button */}
          <div className="flex items-center gap-3">
            {isScanning ? (
              <Button variant="outline" onClick={handleStopScan} className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                {t('ble:device.stopScanning')}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleScanForDevices} className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {t('device.searchDevices')}
              </Button>
            )}
            {isScanning && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t('ble:device.searchingDevices')}
              </span>
            )}
          </div>

          {/* Discovered devices list */}
          {discoveredDevices.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('ble:device.foundDevices', { count: discoveredDevices.length })}
              </p>
              <div className="space-y-2">
                {discoveredDevices.map((device) => (
                  <DeviceListItem
                    key={device.mac}
                    device={device}
                    isSelected={localMac === device.mac}
                    onSelect={handleSelectDevice}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No devices found message */}
          {!isScanning && discoveredDevices.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('device.searchHint')}
            </p>
          )}
        </div>
      </Card>

      {/* Xiaomi Cloud Login - automatic key extraction */}
      <Card title={t('device.autoKeyExtract')} subtitle={t('device.autoKeyExtractDesc')}>
        <XiaomiCloudLogin />
      </Card>

      {/* Device configuration */}
      <Card title={t('device.manualConfig')} subtitle={t('device.manualConfigDesc')}>
        <div className="space-y-4">
          <SettingsInput
            label={t('device.macAddress')}
            value={localMac}
            onChange={handleMacChange}
            placeholder={t('device.macAddressPlaceholder')}
            helperText={t('device.macAddressHelper')}
          />
          <SettingsInput
            label={t('device.bleKey')}
            value={localKey}
            onChange={setLocalKey}
            placeholder={t('device.bleKeyPlaceholder')}
            helperText={t('device.bleKeyHelper')}
            type="password"
          />

          {hasChanges && (
            <div className="flex justify-end pt-4">
              <Button variant="primary" onClick={handleSave}>
                {t('common:buttons.saveConfig')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Connection preferences */}
      <Card title={t('device.connectionPreferences')}>
        <div className="space-y-6">
          <SettingsToggle
            label={t('device.autoConnect')}
            description={t('device.autoConnectDesc')}
            checked={autoConnect}
            onChange={setAutoConnect}
          />

          <SettingsNumber
            label={t('device.scanTimeout')}
            value={scanTimeout / 1000}
            onChange={(value) => setScanTimeout(value * 1000)}
            min={5}
            max={60}
            unit={t('common:units.seconds')}
            helperText={t('device.scanTimeoutHelper')}
          />
        </div>
      </Card>

      {/* Help section */}
      <Card title={t('device.help')}>
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="font-medium text-green-800 dark:text-green-200 mb-2">
              {t('help.recommendedMethod')}
            </p>
            <p className="text-green-700 dark:text-green-300">
              {t('help.recommendedMethodDesc')}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              {t('help.macVsBleKey')}
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              {t('help.macVsBleKeyDesc')}
            </p>
          </div>

          <p>
            <strong>{t('help.alternativeMethod')}</strong>
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>{t('help.step1')}</li>
            <li>{t('help.step2')}</li>
            <li>{t('help.step3')}</li>
          </ol>

          <div className="mt-3 space-y-2">
            <a
              href="https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
              Xiaomi Cloud Tokens Extractor
            </a>
            <a
              href="https://xiaomi-token-web.asd.workers.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Web Token Extractor (online)
            </a>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200 text-xs">
              <strong>{t('help.important')}</strong> {t('help.importantNote')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DeviceSettings;
