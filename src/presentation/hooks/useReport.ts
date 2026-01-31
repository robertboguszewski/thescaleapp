/**
 * useReport Hook
 *
 * Custom React hook for health report generation.
 * Wraps IPC calls for generating reports and summaries.
 *
 * @module presentation/hooks/useReport
 */

import { useCallback, useState } from 'react';
import { useCurrentProfile } from '../stores/profileStore';
import type {
  HealthReport,
  MetricTrends,
  HealthRecommendation,
} from '../../shared/types';

/**
 * Report state
 */
interface ReportState {
  report: HealthReport | null;
  trends: MetricTrends | null;
  recommendations: HealthRecommendation[];
  quickSummary: { bodyScore: number; status: string } | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
interface UseReportReturn extends ReportState {
  // Actions
  generateReport: (profileId?: string) => Promise<HealthReport | null>;
  generateReportForCurrentProfile: () => Promise<HealthReport | null>;
  getQuickSummary: (profileId?: string) => Promise<{ bodyScore: number; status: string } | null>;
  clearReport: () => void;
  clearError: () => void;
}

/**
 * Initial state
 */
const initialState: ReportState = {
  report: null,
  trends: null,
  recommendations: [],
  quickSummary: null,
  isLoading: false,
  error: null,
};

/**
 * Custom hook for health report operations
 *
 * Provides a clean interface for:
 * - Generating comprehensive health reports
 * - Getting quick summaries
 * - Managing loading/error states
 *
 * @example
 * ```typescript
 * const {
 *   report,
 *   recommendations,
 *   isLoading,
 *   generateReportForCurrentProfile,
 * } = useReport();
 *
 * // Generate report
 * const reportData = await generateReportForCurrentProfile();
 *
 * if (reportData) {
 *   console.log('Body Score:', reportData.summary.bodyScore);
 *   console.log('Status:', reportData.summary.overallStatus);
 * }
 * ```
 */
export function useReport(): UseReportReturn {
  const [state, setState] = useState<ReportState>(initialState);
  const currentProfile = useCurrentProfile();

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<ReportState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Generate a comprehensive health report
   */
  const generateReport = useCallback(
    async (profileId?: string): Promise<HealthReport | null> => {
      const id = profileId || currentProfile?.id;

      if (!id) {
        updateState({
          error: 'Nie wybrano profilu',
          isLoading: false,
        });
        return null;
      }

      updateState({ isLoading: true, error: null });

      try {
        const result = await window.electronAPI.generateReport(id);

        if (result.success && result.data) {
          updateState({
            report: result.data,
            trends: result.data.trends,
            recommendations: result.data.recommendations,
            isLoading: false,
          });
          return result.data;
        } else {
          updateState({
            error: result.error?.message || 'Nie udalo sie wygenerowac raportu',
            isLoading: false,
          });
          return null;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nieznany błąd podczas generowania raportu';
        updateState({
          error: message,
          isLoading: false,
        });
        return null;
      }
    },
    [currentProfile, updateState]
  );

  /**
   * Generate report for current profile
   */
  const generateReportForCurrentProfile = useCallback(async (): Promise<HealthReport | null> => {
    return generateReport();
  }, [generateReport]);

  /**
   * Get quick summary
   */
  const getQuickSummary = useCallback(
    async (profileId?: string): Promise<{ bodyScore: number; status: string } | null> => {
      const id = profileId || currentProfile?.id;

      if (!id) {
        updateState({ error: 'Nie wybrano profilu' });
        return null;
      }

      updateState({ isLoading: true, error: null });

      try {
        const result = await window.electronAPI.getQuickSummary(id);

        if (result.success && result.data) {
          updateState({
            quickSummary: result.data,
            isLoading: false,
          });
          return result.data;
        } else {
          updateState({
            error: result.error?.message || 'Nie udalo sie pobrac podsumowania',
            isLoading: false,
          });
          return null;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nieznany błąd podczas pobierania podsumowania';
        updateState({
          error: message,
          isLoading: false,
        });
        return null;
      }
    },
    [currentProfile, updateState]
  );

  /**
   * Clear report data
   */
  const clearReport = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  return {
    // State
    report: state.report,
    trends: state.trends,
    recommendations: state.recommendations,
    quickSummary: state.quickSummary,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    generateReport,
    generateReportForCurrentProfile,
    getQuickSummary,
    clearReport,
    clearError,
  };
}
