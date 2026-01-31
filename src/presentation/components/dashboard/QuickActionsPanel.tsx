/**
 * QuickActionsPanel Component
 *
 * Panel with quick navigation actions to main app modules.
 * Always visible on dashboard for one-click access.
 *
 * @module presentation/components/dashboard/QuickActionsPanel
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { useAppStore, type Tab } from '../../stores/appStore';

/**
 * Action item definition
 */
interface QuickAction {
  id: Tab;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * Scale icon for measurements
 */
const ScaleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M12 7v10M7 12h10" />
  </svg>
);

/**
 * History icon
 */
const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 8v4l3 3" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

/**
 * Trends icon
 */
const TrendsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" />
    <path d="M18 9l-5 5-4-4-6 6" />
  </svg>
);

/**
 * Settings icon
 */
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * Quick actions configuration with i18n support
 */
const getQuickActions = (t: (key: string) => string): QuickAction[] => [
  {
    id: 'measure',
    label: t('quickActions.newMeasurement'),
    description: t('quickActions.newMeasurementDesc'),
    icon: <ScaleIcon className="w-6 h-6" />,
    color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  },
  {
    id: 'history',
    label: t('quickActions.viewHistory'),
    description: t('quickActions.viewHistoryDesc'),
    icon: <HistoryIcon className="w-6 h-6" />,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'trends',
    label: t('quickActions.viewTrends'),
    description: t('quickActions.viewTrendsDesc'),
    icon: <TrendsIcon className="w-6 h-6" />,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
  {
    id: 'settings',
    label: t('quickActions.settings'),
    description: t('quickActions.settingsDesc'),
    icon: <SettingsIcon className="w-6 h-6" />,
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  },
];

/**
 * Quick action button component
 */
const QuickActionButton: React.FC<{
  action: QuickAction;
  onClick: () => void;
}> = ({ action, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all text-left w-full group"
    data-testid={`quick-action-${action.id}`}
  >
    <div className={`p-3 rounded-lg ${action.color} group-hover:scale-105 transition-transform`}>
      {action.icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 dark:text-white">
        {action.label}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
        {action.description}
      </p>
    </div>
    <svg
      className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:translate-x-1 transition-all"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </button>
);

/**
 * QuickActionsPanel component
 */
export const QuickActionsPanel: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const { setActiveTab } = useAppStore();
  const quickActions = getQuickActions(t);

  return (
    <Card title={t('quickActions.title')} className="h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            onClick={() => setActiveTab(action.id)}
          />
        ))}
      </div>
    </Card>
  );
};

export default QuickActionsPanel;
