/**
 * Xiaomi Cloud Login Component
 *
 * Handles QR code-based authentication with Xiaomi cloud
 * for extracting BLE encryption keys.
 *
 * @module presentation/components/settings/XiaomiCloudLogin
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  /**
   * Generate QR code locally when session is available
   */
  useEffect(() => {
    if (qrSession?.qrCodeUrl) {
      // Generate QR code from the URL (the qrCodeUrl contains the login ticket)
      QRCode.toDataURL(qrSession.qrCodeUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((dataUrl) => {
          setQrCodeDataUrl(dataUrl);
        })
        .catch((err) => {
          console.error('[XiaomiCloudLogin] Failed to generate QR code:', err);
          setError(t('xiaomiCloud.qrGenerateError'));
        });
    } else {
      setQrCodeDataUrl(null);
    }
  }, [qrSession?.qrCodeUrl, setError, t]);

  /**
   * Start QR code login
   */
  const handleStartLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.startXiaomiQRLogin();

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t('xiaomiCloud.loginStartError'));
      }

      setQRSession(response.data);
      setLoginStatus('pending');
      setIsPolling(true);
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
                  setDeviceConfig({
                    deviceMac: formattedMac,
                    bleKey: keyResponse.data.beaconKey,
                    deviceName: firstMiScale.name || 'Mi Scale',
                  });
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
        setDeviceConfig({
          deviceMac: formattedMac,
          bleKey: response.data.beaconKey,
        });
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
   * Cancel QR login
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

  // Render QR code view
  if (qrSession) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">{t('xiaomiCloud.loginToCloud')}</h3>

        <div className="text-center space-y-4">
          {/* QR Code */}
          <div className="inline-block p-4 bg-white rounded-lg">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                className="w-48 h-48"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-sm">
            {loginStatus === 'pending' && (
              <div className="space-y-2">
                <span className="text-yellow-400 block">
                  {t('xiaomiCloud.scanQrOrUseLink')}
                </span>
                <div className="text-left bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                  <p className="font-medium text-white">⚠️ {t('xiaomiCloud.important')}</p>
                  <div className="bg-blue-900/30 border border-blue-600 rounded p-2 mb-2">
                    <p className="text-blue-300 font-medium">{t('xiaomiCloud.option1Recommended')}</p>
                    <p className="text-gray-400">{t('xiaomiCloud.option1Desc')}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded p-2">
                    <p className="text-gray-300 font-medium">{t('xiaomiCloud.option2')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>{t('xiaomiCloud.option2Step1')}</li>
                      <li>{t('xiaomiCloud.option2Step2')}</li>
                      <li>{t('xiaomiCloud.option2Step3')}</li>
                      <li>{t('xiaomiCloud.option2Step4')}</li>
                    </ol>
                  </div>
                  <p className="text-red-400 mt-2 text-xs">
                    ❌ {t('xiaomiCloud.scannerWarning')}
                  </p>
                </div>
              </div>
            )}
            {loginStatus === 'scanned' && (
              <span className="text-blue-400">{t('xiaomiCloud.scanned')}</span>
            )}
          </div>

          {/* Loading indicator */}
          {isPolling && (
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{t('xiaomiCloud.waitingForLogin')}</span>
            </div>
          )}

          {/* Login link - primary option */}
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
            <p className="text-green-400 font-medium text-sm mb-2">🔗 {t('xiaomiCloud.loginLink')}</p>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrSession.loginUrl);
                  // Show temporary feedback
                  const btn = document.getElementById('copy-url-btn');
                  if (btn) {
                    btn.textContent = `✓ ${t('xiaomiCloud.copied')}`;
                    setTimeout(() => {
                      btn.textContent = `📋 ${t('xiaomiCloud.copyUrl')}`;
                    }, 2000);
                  }
                }}
                id="copy-url-btn"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
              >
                📋 {t('xiaomiCloud.copyUrl')}
              </button>
              <span className="text-gray-400 text-xs">{t('xiaomiCloud.copyAndPaste')}</span>
            </div>
            <a
              href={qrSession.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline break-all text-xs block"
            >
              {qrSession.loginUrl}
            </a>
            <p className="text-gray-400 text-xs mt-2">
              {t('xiaomiCloud.openLinkDesc')}
            </p>
          </div>

          {/* Cancel button */}
          <button
            onClick={handleCancelLogin}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
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
      <h3 className="text-lg font-medium text-white">Xiaomi Cloud</h3>

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
        onClick={handleStartLogin}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
      >
        {isLoading ? t('xiaomiCloud.loading') : t('xiaomiCloud.loginWithQr')}
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
          <li>{t('xiaomiCloud.step1')}</li>
          <li>{t('xiaomiCloud.step2')}</li>
          <li>{t('xiaomiCloud.step3')}</li>
          <li>{t('xiaomiCloud.step4')}</li>
        </ol>
        <p className="text-gray-600 mt-2">
          {t('xiaomiCloud.scannerWarning')}
        </p>
      </div>
    </div>
  );
};
