/**
 * AppLayout Component
 *
 * Main application layout with sidebar navigation and content area.
 * Manages dark mode and notification display.
 *
 * @module presentation/components/layout/AppLayout
 */

import React from 'react';
import { useAppStore, Tab } from '../../stores/appStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Dashboard } from '../dashboard/Dashboard';
import { MeasurementPanel } from '../measurement/MeasurementPanel';
import { HistoryList } from '../history/HistoryList';
import { TrendsChart } from '../trends/TrendsChart';
import { Settings } from '../settings/Settings';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';

/**
 * Notification toast component
 */
const NotificationToast: React.FC<{
  notification: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  React.useEffect(() => {
    if (notification.duration) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onDismiss]);

  const typeStyles = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  };

  const iconColors = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${typeStyles[notification.type]} animate-slide-in`}
    >
      <span className={`${iconColors[notification.type]} mt-0.5`}>
        {notification.type === 'success' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        )}
        {notification.type === 'error' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        )}
        {notification.type === 'warning' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        )}
        {notification.type === 'info' && (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        )}
      </span>
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white text-sm">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {notification.message}
          </p>
        )}
        {notification.action && (
          <button
            onClick={() => {
              notification.action!.onClick();
              onDismiss(notification.id);
            }}
            className="mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

/**
 * Notifications container
 */
const NotificationsContainer: React.FC = () => {
  const { notifications, removeNotification } = useAppStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={removeNotification}
        />
      ))}
    </div>
  );
};

/**
 * Analysis placeholder component
 */
const AnalysisPage: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <svg
        className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </svg>
      <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
        Analiza zdrowotna
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Szczegolowa analiza skladu ciala bedzie tutaj dostepna.
      </p>
    </div>
  </div>
);

/**
 * Render the appropriate content based on active tab
 */
const TabContent: React.FC<{ tab: Tab }> = ({ tab }) => {
  switch (tab) {
    case 'dashboard':
      return <Dashboard />;
    case 'measure':
      return <MeasurementPanel />;
    case 'history':
      return <HistoryList />;
    case 'trends':
      return <TrendsChart />;
    case 'analysis':
      return <AnalysisPage />;
    case 'settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
};

/**
 * Global loading overlay
 */
const GlobalLoadingOverlay: React.FC = () => {
  const { isGlobalLoading, globalLoadingMessage } = useAppStore();

  if (!isGlobalLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <LoadingSpinner size="lg" message={globalLoadingMessage || 'Ladowanie...'} />
    </div>
  );
};

/**
 * Main application layout component
 */
export const AppLayout: React.FC = () => {
  const { activeTab, isDarkMode } = useAppStore();

  // Apply dark mode class to document
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Spacer for macOS traffic lights - matches sidebar */}
        <div
          className="h-8 flex-shrink-0 bg-white dark:bg-gray-900"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

        {/* Top header */}
        <Header />

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <TabContent tab={activeTab} />
        </main>
      </div>

      {/* Global loading overlay */}
      <GlobalLoadingOverlay />

      {/* Notifications */}
      <NotificationsContainer />
    </div>
  );
};

export default AppLayout;
