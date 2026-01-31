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
import { useXiaomiStore, useMiScaleDevices } from '../../stores/xiaomiStore';
import { useBLEStore } from '../../stores/bleStore';
import type { XiaomiRegion, XiaomiCloudDevice } from '../../../shared/types';

/**
 * Region options for Xiaomi cloud
 */
const REGIONS: { value: XiaomiRegion; label: string }[] = [
  { value: 'cn', label: 'Chiny' },
  { value: 'de', label: 'Europa (DE)' },
  { value: 'us', label: 'USA' },
  { value: 'ru', label: 'Rosja' },
  { value: 'tw', label: 'Tajwan' },
  { value: 'sg', label: 'Singapur' },
  { value: 'in', label: 'Indie' },
  { value: 'i2', label: 'Inne' },
];

/**
 * Device list item component
 */
const DeviceListItem: React.FC<{
  device: XiaomiCloudDevice;
  isSelected: boolean;
  onSelect: () => void;
  onExtractKey: () => void;
  isExtracting: boolean;
}> = ({ device, isSelected, onSelect, onExtractKey, isExtracting }) => {
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
            {isExtracting ? 'Pobieranie...' : 'Pobierz klucz'}
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
          setError('Nie udało się wygenerować kodu QR');
        });
    } else {
      setQrCodeDataUrl(null);
    }
  }, [qrSession?.qrCodeUrl, setError]);

  /**
   * Start QR code login
   */
  const handleStartLogin = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.startXiaomiQRLogin();

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Nie udało się rozpocząć logowania');
      }

      setQRSession(response.data);
      setLoginStatus('pending');
      setIsPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setQRSession, setLoginStatus, setIsPolling]);

  /**
   * Poll for login status
   */
  const pollLoginStatus = useCallback(async () => {
    if (!qrSession) return;

    try {
      const response = await window.electronAPI.pollXiaomiLogin(qrSession.sessionId);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Błąd sprawdzania statusu');
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
          throw new Error(completeResponse.error?.message || 'Nie udało się zakończyć logowania');
        }

        setAuthenticated(true);
        setQRSession(null);

        // Fetch devices
        const devicesResponse = await window.electronAPI.getXiaomiDevices();
        if (devicesResponse.success && devicesResponse.data) {
          setDevices(devicesResponse.data);
        }

        setLoading(false);
      } else if (status === 'expired') {
        setIsPolling(false);
        setError('Sesja QR wygasła. Spróbuj ponownie.');
      } else if (status === 'error') {
        setIsPolling(false);
        setError(pollError || 'Błąd logowania');
      }
    } catch (err) {
      setIsPolling(false);
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
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
        throw new Error(response.error?.message || 'Nie udalo sie pobrac klucza BLE');
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
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setIsExtractingKey(false);
    }
  }, [selectedDevice, setError, setBLEKey, setDeviceConfig]);

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
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Xiaomi Cloud</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-400">Zalogowano</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white"
            >
              Wyloguj
            </button>
          </div>
        </div>

        {/* Device list */}
        {miScaleDevices.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">
              Znalezione wagi Mi Scale ({miScaleDevices.length})
            </h4>
            {miScaleDevices.map((device) => (
              <DeviceListItem
                key={device.did}
                device={device}
                isSelected={selectedDevice?.did === device.did}
                onSelect={() => setSelectedDevice(device)}
                onExtractKey={handleExtractKey}
                isExtracting={isExtractingKey}
              />
            ))}
          </div>
        ) : devices.length > 0 ? (
          <div className="text-sm text-gray-400">
            Nie znaleziono wagi Mi Scale. Znaleziono {devices.length} innych urzadzen.
          </div>
        ) : (
          <div className="text-sm text-gray-400">
            Brak urzadzen. Upewnij sie, ze waga jest dodana w aplikacji Mi Home.
          </div>
        )}

        {/* Extracted key display */}
        {bleKey && (
          <div className="p-3 bg-green-900/30 border border-green-600 rounded-lg">
            <h4 className="text-sm font-medium text-green-400 mb-2">
              Klucz BLE zostal pobrany!
            </h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-400">MAC: </span>
                <span className="text-white font-mono">{bleKey.mac}</span>
              </div>
              <div>
                <span className="text-gray-400">Klucz: </span>
                <span className="text-white font-mono text-xs break-all">
                  {bleKey.beaconKey}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Klucz został automatycznie skonfigurowany. Możesz teraz połączyć się z wagą.
            </p>
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
        <h3 className="text-lg font-medium text-white">Zaloguj sie do Xiaomi Cloud</h3>

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
                  Zeskanuj kod QR lub użyj linku poniżej
                </span>
                <div className="text-left bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-2">
                  <p className="font-medium text-white">⚠️ Ważne - jak prawidłowo zeskanować:</p>
                  <div className="bg-blue-900/30 border border-blue-600 rounded p-2 mb-2">
                    <p className="text-blue-300 font-medium">Opcja 1 (Zalecana): Użyj linku</p>
                    <p className="text-gray-400">Kliknij link poniżej i zaloguj się w przeglądarce telefonu.</p>
                  </div>
                  <div className="bg-gray-700/50 rounded p-2">
                    <p className="text-gray-300 font-medium">Opcja 2: Zeskanuj kod QR</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>Użyj <strong>aparatu telefonu</strong> lub dowolnej aplikacji do skanowania QR</li>
                      <li>Zeskanuj kod QR powyżej</li>
                      <li>Otworzy się strona logowania Xiaomi w przeglądarce</li>
                      <li>Zaloguj się do swojego konta Xiaomi</li>
                    </ol>
                  </div>
                  <p className="text-red-400 mt-2 text-xs">
                    ❌ NIE używaj skanera "Dodaj urządzenie" w Mi Home - ten skaner służy do parowania urządzeń, nie do logowania.
                  </p>
                </div>
              </div>
            )}
            {loginStatus === 'scanned' && (
              <span className="text-blue-400">Zeskanowano! Potwierdź logowanie na telefonie...</span>
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
              <span>Oczekiwanie na logowanie...</span>
            </div>
          )}

          {/* Login link - primary option */}
          <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
            <p className="text-green-400 font-medium text-sm mb-2">🔗 Link do logowania:</p>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(qrSession.loginUrl);
                  // Show temporary feedback
                  const btn = document.getElementById('copy-url-btn');
                  if (btn) {
                    btn.textContent = '✓ Skopiowano!';
                    setTimeout(() => {
                      btn.textContent = '📋 Kopiuj URL';
                    }, 2000);
                  }
                }}
                id="copy-url-btn"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
              >
                📋 Kopiuj URL
              </button>
              <span className="text-gray-400 text-xs">← Skopiuj i wklej na telefonie</span>
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
              Otwórz ten link na telefonie w przeglądarce i zaloguj się do konta Xiaomi.
            </p>
          </div>

          {/* Cancel button */}
          <button
            onClick={handleCancelLogin}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            Anuluj
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
        Zaloguj sie do Xiaomi Cloud, aby automatycznie pobrac klucz BLE dla Twojej wagi.
        Twoje dane logowania nie sa przechowywane.
      </p>

      {/* Region selector */}
      <div className="space-y-2">
        <label className="text-sm text-gray-300">Region serwera:</label>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value as XiaomiRegion)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
        >
          {REGIONS.map((region) => (
            <option key={region.value} value={region.value}>
              {region.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Wybierz region, w ktorym zarejestrowales swoje konto Mi Home.
        </p>
      </div>

      {/* Login button */}
      <button
        onClick={handleStartLogin}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
      >
        {isLoading ? 'Ladowanie...' : 'Zaloguj przez QR kod'}
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
          <strong>Jak to działa?</strong>
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Kliknij "Zaloguj przez QR kod"</li>
          <li>Otwórz wyświetlony link w przeglądarce na telefonie (lub zeskanuj QR aparatem)</li>
          <li>Zaloguj się do swojego konta Xiaomi</li>
          <li>Wybierz wagę z listy i pobierz klucz BLE</li>
        </ol>
        <p className="text-gray-600 mt-2">
          Uwaga: Nie używaj skanera "dodaj urządzenie" w aplikacji Mi Home.
        </p>
      </div>
    </div>
  );
};
