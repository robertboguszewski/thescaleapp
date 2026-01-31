/**
 * Xiaomi Cloud Login Component
 *
 * Handles browser-based authentication with Xiaomi cloud
 * for extracting BLE encryption keys.
 *
 * Simplified flow:
 * 1. User selects region
 * 2. Opens login URL in browser
 * 3. Polls for confirmation
 * 4. Auto-extracts BLE key
 *
 * @module presentation/components/settings/XiaomiCloudLogin
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useXiaomiStore, useMiScaleDevices } from '../../stores/xiaomiStore';
import { useBLEStore } from '../../stores/bleStore';
import type { XiaomiRegion, XiaomiCloudDevice } from '../../../shared/types';

/**
 * Region values for Xiaomi cloud
 */
const REGION_VALUES: XiaomiRegion[] = ['cn', 'de', 'us', 'ru', 'tw', 'sg', 'in', 'i2'];

/**
 * Device list item component
 */
const DeviceListItem: React.FC<{
  device: XiaomiCloudDevice;
  isSelected: boolean;
  onSelect: () => void;
  onExtractKey: () => void;
  isExtracting: boolean;
  t: (key: string) => string;
}> = ({ device, isSelected, onSelect, onExtractKey, isExtracting, t }) => {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-600 hover:border-gray-500'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-white">{device.name}</div>
          <div className="text-sm text-gray-400">
            {device.model} - {device.mac}
          </div>
        </div>
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExtractKey();
            }}
            disabled={isExtracting}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            {isExtracting ? t('xiaomiCloud.extracting') : t('xiaomiCloud.extractKey')}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Main Xiaomi Cloud Login component
 */
export const XiaomiCloudLogin: React.FC = () => {
  const { t } = useTranslation('settings');
  const {
    isAuthenticated,
    isLoading,
    error,
    qrSession,
    loginStatus,
    isPolling,
    devices,
    selectedDevice,
    bleKey,
    selectedRegion,
    setLoading,
    setError,
    setAuthenticated,
    setQRSession,
    setLoginStatus,
    setIsPolling,
    setDevices,
    setSelectedDevice,
    setBLEKey,
    setSelectedRegion,
    reset,
  } = useXiaomiStore();

  const { setDeviceConfig } = useBLEStore();
  const miScaleDevices = useMiScaleDevices();

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isExtractingKey, setIsExtractingKey] = useState(false);

  /**
   * Open login URL in browser and start polling
   */
  const handleOpenBrowserLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get login session
      const response = await window.electronAPI.startXiaomiQRLogin();

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t('xiaomiCloud.loginStartError'));
      }

      setQRSession(response.data);
      setLoginStatus('pending');
      setIsPolling(true);

      // Open login URL in external browser
      await window.electronAPI.openExternalUrl(response.data.loginUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errors.unknown'));
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setQRSession, setLoginStatus, setIsPolling, t]);

  /**
   * Poll for login status
   */
  const pollLoginStatus = useCallback(async () => {
    if (!qrSession) return;

    try {
      const response = await window.electronAPI.pollXiaomiLogin(qrSession.sessionId);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t('xiaomiCloud.statusCheckError'));
      }

      const { status, authToken, error: pollError } = response.data;
      setLoginStatus(status);

      if (status === 'confirmed' && authToken) {
        // Stop polling
        setIsPolling(false);

        // Complete login
        setLoading(true);
        const completeResponse = await window.electronAPI.completeXiaomiLogin(
          authToken,
          selectedRegion
        );

        if (!completeResponse.success) {
          throw new Error(completeResponse.error?.message || t('xiaomiCloud.loginCompleteError'));
        }

        setAuthenticated(true);
        setQRSession(null);

        // Fetch devices
        const devicesResponse = await window.electronAPI.getXiaomiDevices();
        if (devicesResponse.success && devicesResponse.data) {
          setDevices(devicesResponse.data);

          // Auto-extract key for Mi Scale devices
          const miScales = devicesResponse.data.filter(
            (d) =>
              d.model?.toLowerCase().includes('scale') ||
              d.model?.toLowerCase().includes('yunmai') ||
              d.name?.toLowerCase().includes('scale') ||
              d.name?.toLowerCase().includes('mi body')
          );

          if (miScales.length > 0) {
            // Auto-select first Mi Scale and extract key
            const firstMiScale = miScales[0];
            setSelectedDevice(firstMiScale);

            try {
              const keyResponse = await window.electronAPI.getXiaomiBLEKey(firstMiScale.did);

              if (keyResponse.success && keyResponse.data) {
                setBLEKey(keyResponse.data);

                // Format MAC address
                const formatMac = (mac: string | undefined): string => {
                  if (!mac) return '';
                  const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
                  return cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
                };

                const macAddress = keyResponse.data.mac || firstMiScale?.mac || '';
                const formattedMac = formatMac(macAddress);

                // Auto-configure BLE store with device name
                if (formattedMac && keyResponse.data.beaconKey) {
                  const bleConfig = {
                    deviceMac: formattedMac,
                    bleKey: keyResponse.data.beaconKey,
                    autoConnect: false,
                    scanTimeout: 30000,
                  };
                  setDeviceConfig({
                    ...bleConfig,
                    deviceName: firstMiScale.name || 'Mi Scale',
                  });
                  // Sync to electron-store for Python scanner
                  await window.electronAPI.setBLEConfig(bleConfig);
                  console.log('[XiaomiCloudLogin] BLE config saved to electron-store');
                }
              }
            } catch (keyErr) {
              console.error('[XiaomiCloudLogin] Auto-extract key failed:', keyErr);
              // Don't show error - user can retry manually
            }
          }
        }

        setLoading(false);
      } else if (status === 'expired') {
        setIsPolling(false);
        setError(t('xiaomiCloud.sessionExpired'));
      } else if (status === 'error') {
        setIsPolling(false);
        setError(pollError || t('xiaomiCloud.loginError'));
      }
    } catch (err) {
      setIsPolling(false);
      setError(err instanceof Error ? err.message : t('xiaomiCloud.unknownError'));
    }
  }, [
    qrSession,
    selectedRegion,
    setLoginStatus,
    setIsPolling,
    setLoading,
    setAuthenticated,
    setQRSession,
    setDevices,
    setError,
    t,
  ]);

  /**
   * Setup polling interval
   */
  useEffect(() => {
    if (isPolling && qrSession) {
      // Poll every 2 seconds
      pollIntervalRef.current = setInterval(pollLoginStatus, 2000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isPolling, qrSession, pollLoginStatus]);

  /**
   * Extract BLE key for selected device
   */
  const handleExtractKey = useCallback(async () => {
    if (!selectedDevice) return;

    setIsExtractingKey(true);
    setError(null);

    try {
      const response = await window.electronAPI.getXiaomiBLEKey(selectedDevice.did);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t('xiaomiCloud.bleKeyFetchError'));
      }

      setBLEKey(response.data);

      // Format MAC address to XX:XX:XX:XX:XX:XX format
      const formatMac = (mac: string | undefined): string => {
        if (!mac) return '';
        const cleaned = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        return cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
      };

      // Get MAC from response or from selected device as fallback
      const macAddress = response.data.mac || selectedDevice?.mac || '';
      const formattedMac = formatMac(macAddress);

      // Automatically configure BLE store with the key
      if (formattedMac && response.data.beaconKey) {
        const bleConfig = {
          deviceMac: formattedMac,
          bleKey: response.data.beaconKey,
          autoConnect: false,
          scanTimeout: 30000,
        };
        setDeviceConfig(bleConfig);
        // Sync to electron-store for Python scanner
        await window.electronAPI.setBLEConfig(bleConfig);
        console.log('[XiaomiCloudLogin] BLE config saved to electron-store');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errors.unknown'));
    } finally {
      setIsExtractingKey(false);
    }
  }, [selectedDevice, setError, setBLEKey, setDeviceConfig, t]);

  /**
   * Logout
   */
  const handleLogout = useCallback(async () => {
    await window.electronAPI.xiaomiLogout();
    reset();
  }, [reset]);

  /**
   * Cancel login
   */
  const handleCancelLogin = useCallback(() => {
    setIsPolling(false);
    setQRSession(null);
    setLoginStatus(null);
  }, [setIsPolling, setQRSession, setLoginStatus]);

  // Render authenticated view
  if (isAuthenticated) {
    // If key was successfully extracted, show simple success view
    if (bleKey) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white">Xiaomi Cloud</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-400">{t('xiaomiCloud.loggedIn')}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white"
              >
                {t('xiaomiCloud.logout')}
              </button>
            </div>
          </div>

          {/* Success message - key extracted */}
          <div className="p-4 bg-green-900/30 border border-green-600 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h4 className="text-lg font-medium text-green-400">
                {t('xiaomiCloud.configurationComplete')}
              </h4>
            </div>
            <p className="text-sm text-gray-300">
              {t('xiaomiCloud.scaleConfiguredSuccessfully')}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {t('xiaomiCloud.keyAutoConfigured')}
            </p>
          </div>
        </div>
      );
    }

    // Show device list only if key extraction failed or no Mi Scale found
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Xiaomi Cloud</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-400">{t('xiaomiCloud.loggedIn')}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white"
            >
              {t('xiaomiCloud.logout')}
            </button>
          </div>
        </div>

        {/* Device list - shown only when manual selection is needed */}
        {miScaleDevices.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">
              {t('xiaomiCloud.foundMiScales', { count: miScaleDevices.length })}
            </h4>
            {miScaleDevices.map((device) => (
              <DeviceListItem
                key={device.did}
                device={device}
                isSelected={selectedDevice?.did === device.did}
                onSelect={() => setSelectedDevice(device)}
                onExtractKey={handleExtractKey}
                isExtracting={isExtractingKey}
                t={t}
              />
            ))}
          </div>
        ) : devices.length > 0 ? (
          <div className="text-sm text-gray-400">
            {t('xiaomiCloud.noMiScaleOtherDevices', { count: devices.length })}
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            {t('xiaomiCloud.noDevices')}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Render waiting for login view
  if (qrSession && isPolling) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">{t('xiaomiCloud.loginToCloud')}</h3>

        <div className="text-center space-y-6 py-4">
          {/* Status indicator */}
          <div className="flex flex-col items-center gap-4">
            {loginStatus === 'scanned' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-blue-400 font-medium">{t('xiaomiCloud.scanned')}</span>
                <p className="text-sm text-gray-400">{t('xiaomiCloud.confirmInApp')}</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <svg className="animate-spin w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <span className="text-orange-400 font-medium">{t('xiaomiCloud.waitingForLogin')}</span>
                <p className="text-sm text-gray-400">{t('xiaomiCloud.completeInBrowser')}</p>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-300 mb-2">{t('xiaomiCloud.browserInstructions')}</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
              <li>{t('xiaomiCloud.browserStep1')}</li>
              <li>{t('xiaomiCloud.browserStep2')}</li>
              <li>{t('xiaomiCloud.browserStep3')}</li>
            </ol>
          </div>

          {/* Cancel button */}
          <button
            onClick={handleCancelLogin}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t('xiaomiCloud.cancel')}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Render initial login view
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">{t('xiaomiCloud.title')}</h3>

      <p className="text-sm text-gray-400">
        {t('xiaomiCloud.cloudDescription')}
      </p>

      {/* Region selector */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300">{t('xiaomiCloud.serverRegion')}</label>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value as XiaomiRegion)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          {REGION_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`xiaomiCloud.regions.${value}`)}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          {t('xiaomiCloud.regionHint')}
        </p>
      </div>

      {/* Login button */}
      <button
        onClick={handleOpenBrowserLogin}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('xiaomiCloud.loading')}
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {t('xiaomiCloud.openInBrowser')}
          </>
        )}
      </button>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>{t('xiaomiCloud.howItWorks')}</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t('xiaomiCloud.simpleStep1')}</li>
          <li>{t('xiaomiCloud.simpleStep2')}</li>
          <li>{t('xiaomiCloud.simpleStep3')}</li>
        </ol>
      </div>
    </div>
  );
};
