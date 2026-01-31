/**
 * RecentActivityFeed Component
 *
 * Displays a feed of recent activities across the app.
 * Shows measurements, profile changes, and other events.
 *
 * @module presentation/components/dashboard/RecentActivityFeed
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { useMeasurementStore, type Measurement } from '../../stores/measurementStore';
import { useProfileStore } from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';

/**
 * Activity types
 */
type ActivityType = 'measurement' | 'profile' | 'goal' | 'system';

/**
 * Activity item interface
 */
interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  icon: ActivityType;
  data?: {
    measurementId?: string;
    profileId?: string;
  };
}

/**
 * Format relative time in Polish
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'przed chwila';
  if (diffMinutes < 60) return `${diffMinutes} min temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  return date.toLocaleDateString('pl-PL');
};

/**
 * Activity icon component
 */
const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  const icons: Record<ActivityType, React.ReactNode> = {
    measurement: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    ),
    profile: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    goal: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    system: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };

  const colors: Record<ActivityType, string> = {
    measurement: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    profile: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    goal: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    system: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className={`p-1.5 rounded-lg ${colors[type]}`}>
      {icons[type]}
    </div>
  );
};

/**
 * Activity item component
 */
const ActivityItemRow: React.FC<{
  activity: ActivityItem;
  onClick?: () => void;
}> = ({ activity, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left w-full"
    data-testid={`activity-${activity.id}`}
  >
    <ActivityIcon type={activity.type} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {activity.title}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {activity.description}
      </p>
    </div>
    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
      {formatRelativeTime(activity.timestamp)}
    </span>
  </button>
);

/**
 * Empty state when no activities
 */
const EmptyActivity: React.FC = () => {
  const { t } = useTranslation('dashboard');
  return (
    <div className="text-center py-6">
      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v4l3 3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('activity.noActivities')}
      </p>
    </div>
  );
};

/**
 * RecentActivityFeed component
 */
export const RecentActivityFeed: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { measurements } = useMeasurementStore();
  const { profiles } = useProfileStore();
  const { setActiveTab } = useAppStore();

  // Generate activity items from measurements and other sources
  const activities = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = [];

    // Add measurement activities (last 10)
    const recentMeasurements = [...measurements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    recentMeasurements.forEach((measurement: Measurement) => {
      const profile = profiles.find(p => p.id === measurement.profileId);
      items.push({
        id: `measurement-${measurement.id}`,
        type: 'measurement',
        title: `${t('activity.measurement')}: ${measurement.raw.weightKg.toFixed(1)} kg`,
        description: profile ? `${t('activity.profile')}: ${profile.name}` : `${t('activity.measurement')} ${t('activity.noProfile')}`,
        timestamp: new Date(measurement.timestamp),
        icon: 'measurement',
        data: {
          measurementId: measurement.id,
          profileId: measurement.profileId,
        },
      });
    });

    // Sort all activities by timestamp (newest first)
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Return only the 5 most recent
    return items.slice(0, 5);
  }, [measurements, profiles]);

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.type === 'measurement') {
      setActiveTab('history');
    } else if (activity.type === 'profile') {
      setActiveTab('settings');
    }
  };

  return (
    <Card title={t('activity.title')} className="h-full">
      {activities.length === 0 ? (
        <EmptyActivity />
      ) : (
        <div className="space-y-1">
          {activities.map((activity) => (
            <ActivityItemRow
              key={activity.id}
              activity={activity}
              onClick={() => handleActivityClick(activity)}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default RecentActivityFeed;
