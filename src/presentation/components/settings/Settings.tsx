/**
 * Settings Component
 *
 * Main settings page with tabs for profiles, device, and app preferences.
 *
 * @module presentation/components/settings/Settings
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ProfileEditor } from './ProfileEditor';
import { DeviceSettings } from './DeviceSettings';
import { useProfileStore, useCurrentProfile } from '../../stores/profileStore';
import { useAppStore, type SettingsSubTab } from '../../stores/appStore';
import type { StoredProfile } from '../../../infrastructure/storage/schemas';

/**
 * Calculate age from birth year and optional month
 */
const calculateAgeFromBirthYear = (birthYear: number, birthMonth?: number): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;
  if (birthMonth !== undefined && today.getMonth() + 1 < birthMonth) {
    age--;
  }
  return age;
};

/**
 * Tab button component
 */
const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-3 w-full px-4 py-3 rounded-lg text-left transition-colors
      ${isActive
        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }
    `}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

/**
 * Profile list item
 */
const ProfileListItem: React.FC<{
  profile: StoredProfile;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ profile, isSelected, onSelect, onEdit, onDelete }) => {
  const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);

  return (
    <div
      className={`
        flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          profile.gender === 'male'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
            : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600'
        }`}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-white">{profile.name}</p>
            {profile.isDefault && (
              <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                Domyslny
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {age} lat, {profile.gender === 'male' ? 'M' : 'K'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        {!profile.isDefault && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Profiles section
 */
const ProfilesSection: React.FC = () => {
  const { t } = useTranslation('settings');
  const { profiles, setEditingProfileId, setIsEditing, removeProfile, setCurrentProfileId, isEditing } = useProfileStore();
  const currentProfile = useCurrentProfile();
  const { addNotification } = useAppStore();

  const handleNewProfile = () => {
    setEditingProfileId(null);
    setIsEditing(true);
  };

  const handleEditProfile = (id: string) => {
    setEditingProfileId(id);
    setIsEditing(true);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      addNotification({
        type: 'warning',
        title: t('profiles.cannotDelete'),
        message: t('profiles.mustHaveOneProfile'),
        duration: 4000,
      });
      return;
    }
    removeProfile(id);
    addNotification({
      type: 'success',
      title: t('profiles.deleted'),
      duration: 3000,
    });
  };

  if (isEditing) {
    return <ProfileEditor onComplete={() => setIsEditing(false)} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('profiles.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('profiles.description')}
          </p>
        </div>
        <Button variant="primary" onClick={handleNewProfile}>
          {t('profileEditor.newProfile')}
        </Button>
      </div>

      <div className="space-y-3">
        {profiles.map((profile) => (
          <ProfileListItem
            key={profile.id}
            profile={profile}
            isSelected={currentProfile?.id === profile.id}
            onSelect={() => setCurrentProfileId(profile.id)}
            onEdit={() => handleEditProfile(profile.id)}
            onDelete={() => handleDeleteProfile(profile.id)}
          />
        ))}
      </div>

      {profiles.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Brak profili. Utworz pierwszy profil.</p>
          <Button variant="primary" className="mt-4" onClick={handleNewProfile}>
            Utworz profil
          </Button>
        </Card>
      )}
    </div>
  );
};

/**
 * Appearance section
 */
const AppearanceSection: React.FC = () => {
  const { isDarkMode, setDarkMode, isSidebarCollapsed, setSidebarCollapsed } = useAppStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Wyglad</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Dostosuj wyglad aplikacji
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          {/* Theme selection */}
          <div>
            <p className="font-medium text-gray-900 dark:text-white mb-3">Motyw</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDarkMode(false)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  !isDarkMode
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="w-full h-16 bg-white border border-gray-200 rounded mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Jasny</p>
              </button>
              <button
                onClick={() => setDarkMode(true)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isDarkMode
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="w-full h-16 bg-gray-800 border border-gray-700 rounded mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Ciemny</p>
              </button>
              <button
                disabled
                className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
              >
                <div className="w-full h-16 bg-gradient-to-b from-white to-gray-800 border border-gray-200 rounded mb-2" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Auto</p>
              </button>
            </div>
          </div>

          {/* Sidebar toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Zwiniety pasek boczny</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pokaz tylko ikony w nawigacji</p>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
              className={`
                relative inline-flex h-6 w-11 rounded-full transition-colors
                ${isSidebarCollapsed ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}
              `}
            >
              <span
                className={`
                  inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform
                  ${isSidebarCollapsed ? 'translate-x-5' : 'translate-x-0.5'}
                `}
                style={{ marginTop: '2px' }}
              />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * About section
 */
const AboutSection: React.FC = () => {
  const { addNotification } = useAppStore();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  // Reset setup - clears all persisted data except theme preferences
  const handleResetSetup = () => {
    // Clear setup-related localStorage items
    localStorage.removeItem('thescale-ble-storage');
    localStorage.removeItem('thescale-profile-storage');
    localStorage.removeItem('thescale-measurement-storage');

    addNotification({
      type: 'success',
      title: t('about.resetSuccess'),
      message: t('about.resetSuccessMessage'),
      duration: 5000,
    });

    setShowResetConfirm(false);

    // Reload the app after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">O aplikacji</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Informacje o TheScale
        </p>
      </div>

      <Card>
        <div className="text-center py-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">TheScale</h2>
          <p className="text-gray-500 dark:text-gray-400">Wersja 1.0.0</p>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Electron</span>
            <span className="text-gray-900 dark:text-white">25.9.8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">React</span>
            <span className="text-gray-900 dark:text-white">18.3.1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">TypeScript</span>
            <span className="text-gray-900 dark:text-white">5.9.3</span>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Aplikacja do odczytu danych z wagi Xiaomi Mi Body Composition Scale S400.
          </p>
        </div>
      </Card>

      {/* Reset Setup Section */}
      <Card>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">Resetuj konfigurację</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Usuń wszystkie profile, ustawienia urządzenia i pomiary. Ta akcja jest nieodwracalna.
            </p>
          </div>

          {!showResetConfirm ? (
            <Button
              variant="secondary"
              onClick={() => setShowResetConfirm(true)}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
              data-testid="reset-setup-button"
            >
              Resetuj konfigurację
            </Button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Na pewno chcesz zresetować?
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Wszystkie dane zostaną usunięte.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Anuluj
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleResetSetup}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="confirm-reset-button"
                >
                  Resetuj
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

/**
 * Settings component
 */
export const Settings: React.FC = () => {
  const { t } = useTranslation('settings');
  const { settingsSubTab, setSettingsSubTab } = useAppStore();

  const tabs: Array<{ id: SettingsSubTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'profiles',
      label: t('tabs.profiles'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'device',
      label: t('tabs.device'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
        </svg>
      ),
    },
    {
      id: 'appearance',
      label: t('tabs.appearance'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      id: 'about',
      label: t('tabs.about'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={settingsSubTab === tab.id}
              onClick={() => setSettingsSubTab(tab.id)}
            />
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl">
        {settingsSubTab === 'profiles' && <ProfilesSection />}
        {settingsSubTab === 'device' && <DeviceSettings />}
        {settingsSubTab === 'appearance' && <AppearanceSection />}
        {settingsSubTab === 'about' && <AboutSection />}
      </div>
    </div>
  );
};

export default Settings;
