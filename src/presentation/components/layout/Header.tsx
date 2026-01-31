/**
 * Header Component
 *
 * Top header with profile selector and theme toggle.
 * macOS-inspired design.
 *
 * @module presentation/components/layout/Header
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';
import { useProfileStore, useCurrentProfile } from '../../stores/profileStore';
import { useBLEStore, useIsDeviceConfigured, getStatusMessage, getStatusColor } from '../../stores/bleStore';

/**
 * Sun icon for light mode
 */
const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

/**
 * Moon icon for dark mode
 */
const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * Bluetooth icon
 */
const BluetoothIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
  </svg>
);

/**
 * User icon
 */
const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * BLE Status indicator
 */
const BLEStatusIndicator: React.FC = () => {
  const { t } = useTranslation(['ble', 'common']);
  const { connectionState } = useBLEStore();
  const isDeviceConfigured = useIsDeviceConfigured();
  const { setActiveTab, setSettingsSubTab } = useAppStore();

  const statusKey = getStatusMessage(connectionState);
  const statusColor = getStatusColor(connectionState);

  const isConnected = connectionState === 'connected' || connectionState === 'reading';
  const isBusy = connectionState === 'scanning' || connectionState === 'connecting';

  // Navigate to device settings
  const handleConfigureDevice = () => {
    setActiveTab('settings');
    setSettingsSubTab('device');
  };

  // Show "Configure" when device is not configured
  if (!isDeviceConfigured) {
    return (
      <button
        onClick={handleConfigureDevice}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-amber-200 dark:border-amber-800"
      >
        <BluetoothIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {t('common:buttons.configure')}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
      <div className="relative">
        <BluetoothIcon className={`w-4 h-4 ${statusColor}`} />
        {isBusy && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
        {isConnected && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full" />
        )}
      </div>
      <span className={`text-xs font-medium ${statusColor}`}>
        {t(statusKey)}
      </span>
    </div>
  );
};

/**
 * Plus icon for create profile button
 */
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Profile selector dropdown
 */
const ProfileSelector: React.FC = () => {
  const { t } = useTranslation(['common', 'settings']);
  const { profiles, setProfiles, setCurrentProfileId, setIsEditing, setEditingProfileId } = useProfileStore();
  const currentProfile = useCurrentProfile();
  const { setActiveTab, setSettingsSubTab } = useAppStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Refresh profiles from disk when dropdown opens
  const refreshProfiles = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getAllProfiles();
      if (result.success && result.data) {
        const storedProfiles = result.data.map((p) => ({
          ...p,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : p.createdAt.toISOString(),
          updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : p.updatedAt.toISOString(),
        }));
        setProfiles(storedProfiles);
        console.log('[ProfileSelector] Refreshed profiles from disk:', storedProfiles.length);
      }
    } catch (err) {
      console.error('[ProfileSelector] Error refreshing profiles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setProfiles]);

  // Handle dropdown toggle - refresh on open
  const handleToggle = React.useCallback(() => {
    if (!isOpen) {
      refreshProfiles();
    }
    setIsOpen(!isOpen);
  }, [isOpen, refreshProfiles]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle create new profile - navigate to settings/profiles
  const handleCreateProfile = () => {
    setEditingProfileId(null);
    setIsEditing(true);
    setActiveTab('settings');
    setSettingsSubTab('profiles');
    setIsOpen(false);
  };

  // Show "Create profile" button when no profiles exist
  if (profiles.length === 0) {
    return (
      <button
        onClick={handleCreateProfile}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-800"
      >
        <PlusIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
          {t('common:profile.create')}
        </span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        disabled={isLoading}
      >
        <UserIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isLoading ? '...' : (currentProfile?.name || t('common:profile.select'))}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                setCurrentProfileId(profile.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                ${profile.id === currentProfile?.id
                  ? 'text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
                }
              `}
            >
              {profile.name}
              {profile.isDefault && (
                <span className="ml-2 text-xs text-gray-400">({t('common:profile.default')})</span>
              )}
            </button>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          <button
            onClick={handleCreateProfile}
            className="w-full text-left px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            {t('common:profile.new')}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Theme toggle button
 */
const ThemeToggle: React.FC = () => {
  const { t } = useTranslation('common');
  const { isDarkMode, toggleDarkMode } = useAppStore();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={isDarkMode ? t('theme.light') : t('theme.dark')}
    >
      {isDarkMode ? (
        <SunIcon className="w-5 h-5 text-yellow-500" />
      ) : (
        <MoonIcon className="w-5 h-5 text-gray-500" />
      )}
    </button>
  );
};

/**
 * Header component
 */
export const Header: React.FC = () => {
  const { t } = useTranslation('navigation');
  const { activeTab } = useAppStore();

  // Get page title based on active tab (uses navigation namespace)
  const getPageTitle = (tab: string): string => {
    return t(`tabs.${tab}`);
  };

  return (
    <header
      className="flex items-center justify-between h-14 px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Page title */}
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        {getPageTitle(activeTab)}
      </h1>

      {/* Right side actions - no-drag for interactive elements */}
      <div
        className="flex items-center gap-4"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <BLEStatusIndicator />
        <ProfileSelector />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
