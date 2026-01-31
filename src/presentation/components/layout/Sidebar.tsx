/**
 * Sidebar Component
 *
 * Navigation sidebar with tab selection.
 * macOS-inspired design with icons and labels.
 * Includes guest measurements indicator.
 *
 * @module presentation/components/layout/Sidebar
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, Tab } from '../../stores/appStore';
import { useHasGuestMeasurements, useGuestMeasurementsCount } from '../../stores/measurementStore';

/**
 * Navigation item configuration
 */
interface NavItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

/**
 * Icon components for navigation
 */
const DashboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const MeasureIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const HistoryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 8v4l3 3" />
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12a9 9 0 1 0 9-9" />
    <path d="M3 3v6h6" />
  </svg>
);

const TrendsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" />
    <path d="M7 16l4-4 4 4 5-6" />
  </svg>
);

const AnalysisIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const GuestIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/**
 * Navigation item IDs for generating items with translations
 */
const navItemIds: Tab[] = ['dashboard', 'measure', 'history', 'trends', 'analysis', 'settings'];

/**
 * Icon mapping for navigation items
 */
const navItemIcons: Record<Tab, React.ReactNode> = {
  dashboard: <DashboardIcon className="w-5 h-5" />,
  measure: <MeasureIcon className="w-5 h-5" />,
  history: <HistoryIcon className="w-5 h-5" />,
  trends: <TrendsIcon className="w-5 h-5" />,
  analysis: <AnalysisIcon className="w-5 h-5" />,
  settings: <SettingsIcon className="w-5 h-5" />,
};

/**
 * Sidebar navigation item
 */
const NavButton: React.FC<{
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}> = ({ item, isActive, isCollapsed, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative
      ${isActive
        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }
      ${isCollapsed ? 'justify-center' : ''}
    `}
    title={isCollapsed ? item.label : undefined}
  >
    <span className={isActive ? 'text-primary-600 dark:text-primary-400' : ''}>
      {item.icon}
    </span>
    {!isCollapsed && (
      <>
        <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
        {item.badge !== undefined && item.badge > 0 && (
          <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-medium flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </>
    )}
    {isCollapsed && item.badge !== undefined && item.badge > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-500 text-white text-[10px] font-medium flex items-center justify-center">
        {item.badge > 99 ? '99+' : item.badge}
      </span>
    )}
  </button>
);

/**
 * Guest measurements navigation item
 */
const GuestMeasurementsNavItem: React.FC<{
  count: number;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  label: string;
}> = ({ count, isActive, isCollapsed, onClick, label }) => {
  const item: NavItem = {
    id: 'history', // Uses history tab but shows guest measurements
    label,
    icon: <GuestIcon className="w-5 h-5" />,
    badge: count,
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 relative
        ${isActive
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
          : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
        }
        ${isCollapsed ? 'justify-center' : ''}
        border border-dashed border-yellow-300 dark:border-yellow-700
      `}
      title={isCollapsed ? `${item.label} (${count})` : undefined}
    >
      <span className={isActive ? 'text-yellow-600 dark:text-yellow-400' : ''}>
        {item.icon}
      </span>
      {!isCollapsed && (
        <>
          <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
          <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-medium flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        </>
      )}
      {isCollapsed && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-500 text-white text-[10px] font-medium flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};

/**
 * Sidebar component
 */
export const Sidebar: React.FC = () => {
  const { t } = useTranslation('navigation');
  const { activeTab, setActiveTab, isSidebarCollapsed, toggleSidebar } = useAppStore();
  const hasGuestMeasurements = useHasGuestMeasurements();
  const guestMeasurementsCount = useGuestMeasurementsCount();

  // State for showing guest measurements view
  const [showingGuestMeasurements, setShowingGuestMeasurements] = React.useState(false);

  // Handle guest measurements click
  const handleGuestMeasurementsClick = () => {
    setActiveTab('history');
    setShowingGuestMeasurements(true);
    // Dispatch custom event to notify history view
    window.dispatchEvent(new CustomEvent('showGuestMeasurements'));
  };

  // Reset guest measurements view when navigating away
  React.useEffect(() => {
    if (activeTab !== 'history') {
      setShowingGuestMeasurements(false);
    }
  }, [activeTab]);

  // Generate navigation items with translated labels
  const baseNavItems: NavItem[] = navItemIds.map((id) => ({
    id,
    label: t(`sidebar.${id}`),
    icon: navItemIcons[id],
  }));

  // Main navigation items (excluding history if guest measurements are shown)
  const mainNavItems = baseNavItems.filter((item) => {
    if (item.id === 'history' && showingGuestMeasurements) {
      return true; // Keep history in nav but it won't be active
    }
    return true;
  });

  return (
    <aside
      className={`
        flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        transition-all duration-200 ease-in-out
        ${isSidebarCollapsed ? 'w-16' : 'w-56'}
      `}
    >
      {/* Spacer for macOS traffic lights */}
      <div
        className="h-8 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Logo / App name - aligned with main header */}
      <div
        className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {!isSidebarCollapsed && (
          <span className="font-semibold text-gray-900 dark:text-white">
            TheScale
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          title={isSidebarCollapsed ? t('actions.expand') : t('actions.collapse')}
        >
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeTab === item.id && !showingGuestMeasurements}
            isCollapsed={isSidebarCollapsed}
            onClick={() => {
              setActiveTab(item.id);
              setShowingGuestMeasurements(false);
            }}
          />
        ))}

        {/* Guest measurements item - shown only when there are guest measurements */}
        {hasGuestMeasurements && (
          <>
            {!isSidebarCollapsed && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="px-3 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t('sections.unassigned')}
                </p>
              </div>
            )}
            <GuestMeasurementsNavItem
              count={guestMeasurementsCount}
              isActive={showingGuestMeasurements}
              isCollapsed={isSidebarCollapsed}
              onClick={handleGuestMeasurementsClick}
              label={t('sections.guestMeasurements')}
            />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        {!isSidebarCollapsed && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            v1.0.0
          </p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
