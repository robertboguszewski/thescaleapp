/**
 * StatusOverviewPanel Component
 *
 * Shows current app status: profile, device, last measurement.
 * Provides at-a-glance view of app state.
 *
 * @module presentation/components/dashboard/StatusOverviewPanel
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { useCurrentProfile, useProfileStore } from '../../stores/profileStore';
import { useIsDeviceConfigured, useBLEStore } from '../../stores/bleStore';
import { useLatestMeasurement } from '../../stores/measurementStore';
import { useAppStore } from '../../stores/appStore';

/**
 * Format relative time using i18n
 */
const formatRelativeTime = (date: Date, t: (key: string, options?: Record<string, unknown>) => string, language: string): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return t('statusOverview.time.justNow');
  if (diffMinutes < 60) return t('statusOverview.time.minutesAgo', { count: diffMinutes });
  if (diffHours < 24) return t('statusOverview.time.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('common:time.yesterday');
  if (diffDays < 7) return t('common:time.daysAgo', { count: diffDays });
  if (diffDays < 30) return t('statusOverview.time.weeksAgo', { count: Math.floor(diffDays / 7) });
  return date.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US');
};

/**
 * Status item component
 */
const StatusItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  status?: 'good' | 'warning' | 'neutral';
  onClick?: () => void;
}> = ({ icon, label, value, status = 'neutral', onClick }) => {
  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  };

  const content = (
    <div className="flex items-center gap-3 py-3">
      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`font-medium truncate ${statusColors[status]}`}>{value}</p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg px-2 -mx-2 transition-colors"
      >
        {content}
      </button>
    );
  }

  return content;
};

/**
 * StatusOverviewPanel component
 */
export const StatusOverviewPanel: React.FC = () => {
  const { t, i18n } = useTranslation(['dashboard', 'common', 'ble']);
  const currentProfile = useCurrentProfile();
  const { profiles } = useProfileStore();
  const isDeviceConfigured = useIsDeviceConfigured();
  const { connectionState } = useBLEStore();
  const latestMeasurement = useLatestMeasurement();
  const { setActiveTab, setSettingsSubTab } = useAppStore();

  // Calculate weight display
  const weightDisplay = latestMeasurement
    ? `${latestMeasurement.raw.weightKg.toFixed(1)} kg`
    : t('statusOverview.noData');

  // Calculate last measurement time
  const lastMeasurementTime = latestMeasurement
    ? formatRelativeTime(new Date(latestMeasurement.timestamp), t, i18n.language)
    : t('statusOverview.noData');

  // Profile status
  const profileValue = currentProfile
    ? currentProfile.name
    : profiles.length > 0
    ? t('statusOverview.profile')
    : t('statusOverview.noData');
  const profileStatus: 'good' | 'warning' | 'neutral' = currentProfile ? 'good' : 'warning';

  // Device status
  const getDeviceStatus = (): { value: string; status: 'good' | 'warning' | 'neutral' } => {
    if (!isDeviceConfigured) {
      return { value: t('statusOverview.notConfigured'), status: 'warning' };
    }
    switch (connectionState) {
      case 'connected':
      case 'reading':
        return { value: t('ble:status.connected'), status: 'good' };
      case 'connecting':
      case 'scanning':
        return { value: t('ble:status.connecting'), status: 'neutral' };
      case 'error':
        return { value: t('ble:status.error'), status: 'warning' };
      default:
        return { value: t('ble:status.disconnected'), status: 'neutral' };
    }
  };

  const deviceStatus = getDeviceStatus();

  return (
    <Card title={t('statusOverview.title')} className="h-full">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {/* Weight */}
        <StatusItem
          icon={
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 7v10M7 12h10" />
            </svg>
          }
          label={t('statusOverview.currentWeight')}
          value={weightDisplay}
          status={latestMeasurement ? 'good' : 'neutral'}
          onClick={() => setActiveTab('measure')}
        />

        {/* Profile */}
        <StatusItem
          icon={
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
          label={t('statusOverview.profile')}
          value={profileValue}
          status={profileStatus}
          onClick={() => {
            setActiveTab('settings');
            setSettingsSubTab('profiles');
          }}
        />

        {/* Device */}
        <StatusItem
          icon={
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
            </svg>
          }
          label={t('statusOverview.device')}
          value={deviceStatus.value}
          status={deviceStatus.status}
          onClick={() => {
            setActiveTab('settings');
            setSettingsSubTab('device');
          }}
        />

        {/* Last measurement */}
        <StatusItem
          icon={
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          }
          label={t('statusOverview.lastMeasurement')}
          value={lastMeasurementTime}
          status={latestMeasurement ? 'neutral' : 'warning'}
          onClick={() => setActiveTab('history')}
        />
      </div>
    </Card>
  );
};

export default StatusOverviewPanel;
