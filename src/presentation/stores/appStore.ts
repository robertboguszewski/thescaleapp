/**
 * App Store
 *
 * Zustand store for managing global application state.
 * Handles navigation, theme, and general UI state.
 *
 * @module presentation/stores/appStore
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Available navigation tabs
 */
export type Tab =
  | 'dashboard'
  | 'measure'
  | 'history'
  | 'trends'
  | 'analysis'
  | 'settings';

/**
 * Settings sub-tabs for navigation
 */
export type SettingsSubTab = 'profiles' | 'device' | 'appearance' | 'about';

/**
 * Notification types for user feedback
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification action for interactive notifications
 */
export interface NotificationAction {
  label: string;
  onClick: () => void;
}

/**
 * Notification structure
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  /** Optional action button for the notification */
  action?: NotificationAction;
}

/**
 * App state interface
 */
interface AppState {
  // State
  /** Currently active navigation tab */
  activeTab: Tab;
  /** Currently active settings sub-tab (for Settings page navigation) */
  settingsSubTab: SettingsSubTab;
  /** Whether dark mode is enabled */
  isDarkMode: boolean;
  /** Whether app is initialized and ready */
  isInitialized: boolean;
  /** Whether sidebar is collapsed (for desktop layouts) */
  isSidebarCollapsed: boolean;
  /** Active notifications */
  notifications: Notification[];
  /** Global loading state for app-wide operations */
  isGlobalLoading: boolean;
  /** Global loading message */
  globalLoadingMessage: string | null;

  // Actions
  /** Set active navigation tab */
  setActiveTab: (tab: Tab, settingsSubTab?: SettingsSubTab) => void;
  /** Set settings sub-tab directly */
  setSettingsSubTab: (subTab: SettingsSubTab) => void;
  /** Toggle dark mode */
  toggleDarkMode: () => void;
  /** Set dark mode explicitly */
  setDarkMode: (isDark: boolean) => void;
  /** Set initialization state */
  setInitialized: (initialized: boolean) => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state explicitly */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Add a notification */
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  /** Remove a notification by ID */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Set global loading state */
  setGlobalLoading: (loading: boolean, message?: string | null) => void;
  /** Reset store to initial state (except persisted) */
  reset: () => void;
}

/**
 * Initial state for the app store
 */
const initialState = {
  activeTab: 'dashboard' as Tab,
  settingsSubTab: 'profiles' as SettingsSubTab,
  isDarkMode: false,
  isInitialized: false,
  isSidebarCollapsed: false,
  notifications: [],
  isGlobalLoading: false,
  globalLoadingMessage: null,
};

/**
 * Generate unique notification ID
 */
const generateNotificationId = (): string =>
  `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Zustand store for application state management
 *
 * Persists theme and sidebar preferences to electron-store.
 *
 * @example
 * ```typescript
 * const { activeTab, setActiveTab, isDarkMode, toggleDarkMode } = useAppStore();
 *
 * // Navigate to a tab
 * setActiveTab('measure');
 *
 * // Toggle theme
 * toggleDarkMode();
 *
 * // Show notification
 * addNotification({
 *   type: 'success',
 *   title: 'Measurement saved',
 *   duration: 3000
 * });
 * ```
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      ...initialState,

      // Actions
      setActiveTab: (activeTab: Tab, settingsSubTab?: SettingsSubTab) => {
        if (settingsSubTab) {
          set({ activeTab, settingsSubTab });
        } else {
          set({ activeTab });
        }
      },

      setSettingsSubTab: (settingsSubTab: SettingsSubTab) => set({ settingsSubTab }),

      toggleDarkMode: () =>
        set((state) => ({ isDarkMode: !state.isDarkMode })),

      setDarkMode: (isDarkMode: boolean) => set({ isDarkMode }),

      setInitialized: (isInitialized: boolean) => set({ isInitialized }),

      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (isSidebarCollapsed: boolean) =>
        set({ isSidebarCollapsed }),

      addNotification: (notification: Omit<Notification, 'id'>) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id: generateNotificationId() },
          ],
        })),

      removeNotification: (id: string) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearNotifications: () => set({ notifications: [] }),

      setGlobalLoading: (isGlobalLoading: boolean, message?: string | null) =>
        set({
          isGlobalLoading,
          globalLoadingMessage: message ?? null,
        }),

      reset: () =>
        set((state) => ({
          ...initialState,
          // Keep persisted preferences
          isDarkMode: state.isDarkMode,
          isSidebarCollapsed: state.isSidebarCollapsed,
        })),
    }),
    {
      name: 'thescale-app-storage',
      // Only persist theme and sidebar preferences
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    }
  )
);

/**
 * Selector for checking if on dashboard
 */
export const selectIsDashboard = (state: AppState) =>
  state.activeTab === 'dashboard';

/**
 * Selector for checking if on measurement tab
 */
export const selectIsMeasuring = (state: AppState) =>
  state.activeTab === 'measure';

/**
 * Selector for getting active notifications count
 */
export const selectNotificationsCount = (state: AppState) =>
  state.notifications.length;

/**
 * Selector for getting error notifications
 */
export const selectErrorNotifications = (state: AppState) =>
  state.notifications.filter((n) => n.type === 'error');

/**
 * Helper to create typed notification actions
 */
export const createNotificationHelpers = (
  addNotification: AppState['addNotification']
) => ({
  showSuccess: (title: string, message?: string) =>
    addNotification({ type: 'success', title, message, duration: 3000 }),
  showError: (title: string, message?: string) =>
    addNotification({ type: 'error', title, message, duration: 5000 }),
  showWarning: (title: string, message?: string) =>
    addNotification({ type: 'warning', title, message, duration: 4000 }),
  showInfo: (title: string, message?: string) =>
    addNotification({ type: 'info', title, message, duration: 3000 }),
});
