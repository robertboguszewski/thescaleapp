/**
 * useSmartRecommendations Hook
 *
 * Generates context-aware recommendations based on user's
 * profile, measurements, device status, and usage patterns.
 *
 * @module presentation/hooks/useSmartRecommendations
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileStore, useCurrentProfile } from '../stores/profileStore';
import { useIsDeviceConfigured } from '../stores/bleStore';
import { useMeasurementStore, useLatestMeasurement } from '../stores/measurementStore';
import { useAppStore, type Tab } from '../stores/appStore';

/**
 * Recommendation type
 */
export type RecommendationType = 'action' | 'insight' | 'warning' | 'success';

/**
 * Recommendation priority (lower = higher priority)
 */
export type RecommendationPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Smart recommendation
 */
export interface SmartRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  action?: {
    label: string;
    tab: Tab;
    subTab?: string;
  };
  icon: 'scale' | 'profile' | 'device' | 'trend' | 'check' | 'alert' | 'calendar';
}

/**
 * Calculate days since date
 */
const daysSince = (date: Date): number => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Hook for generating smart recommendations
 */
export function useSmartRecommendations(): SmartRecommendation[] {
  const { t } = useTranslation('recommendations');
  const { profiles } = useProfileStore();
  const currentProfile = useCurrentProfile();
  const isDeviceConfigured = useIsDeviceConfigured();
  const latestMeasurement = useLatestMeasurement();
  const { measurements } = useMeasurementStore();

  return useMemo(() => {
    const recommendations: SmartRecommendation[] = [];

    // Priority 1: No profile
    if (profiles.length === 0) {
      recommendations.push({
        id: 'no-profile',
        type: 'action',
        priority: 1,
        title: t('smart.createProfile.title'),
        description: t('smart.createProfile.description'),
        action: {
          label: t('smart.createProfile.title'),
          tab: 'settings',
          subTab: 'profiles',
        },
        icon: 'profile',
      });
    }

    // Priority 1: No device configured
    if (!isDeviceConfigured) {
      recommendations.push({
        id: 'no-device',
        type: 'action',
        priority: 1,
        title: t('smart.connectScale.title'),
        description: t('smart.connectScale.description'),
        action: {
          label: t('smart.connectScale.title'),
          tab: 'settings',
          subTab: 'device',
        },
        icon: 'device',
      });
    }

    // Priority 2: No measurements
    if (!latestMeasurement && profiles.length > 0 && isDeviceConfigured) {
      recommendations.push({
        id: 'first-measurement',
        type: 'action',
        priority: 2,
        title: t('smart.firstMeasurement.title'),
        description: t('smart.firstMeasurement.description'),
        action: {
          label: t('smart.firstMeasurement.action'),
          tab: 'measure',
        },
        icon: 'scale',
      });
    }

    // Priority 3: Long time since last measurement
    if (latestMeasurement) {
      const days = daysSince(new Date(latestMeasurement.timestamp));

      if (days >= 7) {
        recommendations.push({
          id: 'measurement-reminder',
          type: 'warning',
          priority: 3,
          title: t('smart.timeForMeasurement.title'),
          description: t('smart.timeForMeasurement.description', { days }),
          action: {
            label: t('smart.timeForMeasurement.action'),
            tab: 'measure',
          },
          icon: 'calendar',
        });
      } else if (days >= 3) {
        recommendations.push({
          id: 'measurement-suggestion',
          type: 'insight',
          priority: 4,
          title: t('smart.considerMeasurement.title'),
          description: t('smart.considerMeasurement.description', { days }),
          action: {
            label: t('smart.considerMeasurement.action'),
            tab: 'measure',
          },
          icon: 'scale',
        });
      }
    }

    // Priority 3: BMI insights
    if (latestMeasurement) {
      const bmi = latestMeasurement.calculated.bmi;

      if (bmi < 18.5) {
        recommendations.push({
          id: 'bmi-underweight',
          type: 'warning',
          priority: 3,
          title: t('smart.bmiUnderweight.title'),
          description: t('smart.bmiUnderweight.description'),
          icon: 'alert',
        });
      } else if (bmi >= 30) {
        recommendations.push({
          id: 'bmi-obese',
          type: 'warning',
          priority: 3,
          title: t('smart.bmiHighlyElevated.title'),
          description: t('smart.bmiHighlyElevated.description'),
          icon: 'alert',
        });
      } else if (bmi >= 25) {
        recommendations.push({
          id: 'bmi-overweight',
          type: 'insight',
          priority: 4,
          title: t('smart.bmiSlightlyElevated.title'),
          description: t('smart.bmiSlightlyElevated.description'),
          action: {
            label: t('smart.checkTrends.action'),
            tab: 'trends',
          },
          icon: 'trend',
        });
      }
    }

    // Priority 4: Visceral fat warning
    if (latestMeasurement && latestMeasurement.calculated.visceralFatLevel >= 10) {
      recommendations.push({
        id: 'visceral-fat',
        type: latestMeasurement.calculated.visceralFatLevel >= 15 ? 'warning' : 'insight',
        priority: latestMeasurement.calculated.visceralFatLevel >= 15 ? 3 : 4,
        title: t('smart.visceralFatElevated.title'),
        description: t('smart.visceralFatElevated.description'),
        icon: 'alert',
      });
    }

    // Priority 5: Positive feedback for regular measurements
    if (measurements.length >= 5) {
      const recentMeasurements = measurements.slice(0, 5);
      const avgDaysBetween =
        recentMeasurements.length > 1
          ? daysSince(new Date(recentMeasurements[recentMeasurements.length - 1].timestamp)) /
            (recentMeasurements.length - 1)
          : 0;

      if (avgDaysBetween <= 7 && avgDaysBetween > 0) {
        recommendations.push({
          id: 'regular-measurements',
          type: 'success',
          priority: 5,
          title: t('smart.greatRegularity.title'),
          description: t('smart.greatRegularity.description'),
          icon: 'check',
        });
      }
    }

    // Priority 5: Check trends suggestion
    if (measurements.length >= 3 && !recommendations.some((r) => r.action?.tab === 'trends')) {
      recommendations.push({
        id: 'check-trends',
        type: 'insight',
        priority: 5,
        title: t('smart.checkTrends.title'),
        description: t('smart.checkTrends.description', { count: measurements.length }),
        action: {
          label: t('smart.checkTrends.action'),
          tab: 'trends',
        },
        icon: 'trend',
      });
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [t, profiles, currentProfile, isDeviceConfigured, latestMeasurement, measurements]);
}

export default useSmartRecommendations;
