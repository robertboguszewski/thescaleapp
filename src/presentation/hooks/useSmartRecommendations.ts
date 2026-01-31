/**
 * useSmartRecommendations Hook
 *
 * Generates context-aware recommendations based on user's
 * profile, measurements, device status, and usage patterns.
 *
 * @module presentation/hooks/useSmartRecommendations
 */

import { useMemo } from 'react';
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
        title: 'Utworz profil',
        description: 'Profil jest wymagany do zapisywania i analizowania pomiarow',
        action: {
          label: 'Utworz profil',
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
        title: 'Połącz wagę',
        description: 'Skonfiguruj połączenie z wagą Xiaomi aby automatyzować pomiary',
        action: {
          label: 'Konfiguruj urządzenie',
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
        title: 'Wykonaj pierwszy pomiar',
        description: 'Rozpocznij śledzenie parametrów ciała wykonując pierwszy pomiar',
        action: {
          label: 'Wykonaj pomiar',
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
          title: 'Czas na pomiar',
          description: `Ostatni pomiar byl ${days} dni temu. Regularne pomiary pomagaja sledzic postepy`,
          action: {
            label: 'Wykonaj pomiar',
            tab: 'measure',
          },
          icon: 'calendar',
        });
      } else if (days >= 3) {
        recommendations.push({
          id: 'measurement-suggestion',
          type: 'insight',
          priority: 4,
          title: 'Rozważ pomiar',
          description: `Minęły ${days} dni od ostatniego pomiaru`,
          action: {
            label: 'Wykonaj pomiar',
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
          title: 'BMI ponizej normy',
          description: 'Twoje BMI wskazuje na niedowage. Rozważ konsultacje ze specjalista',
          icon: 'alert',
        });
      } else if (bmi >= 30) {
        recommendations.push({
          id: 'bmi-obese',
          type: 'warning',
          priority: 3,
          title: 'BMI znacznie podwyzszone',
          description: 'Twoje BMI wskazuje na otylosc. Zalecana jest konsultacja lekarska',
          icon: 'alert',
        });
      } else if (bmi >= 25) {
        recommendations.push({
          id: 'bmi-overweight',
          type: 'insight',
          priority: 4,
          title: 'BMI lekko podwyzszone',
          description: 'Twoje BMI wskazuje na nadwage. Sledz trendy aby monitorowac zmiany',
          action: {
            label: 'Zobacz trendy',
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
        title: 'Podwyzszony tluszcz trzewny',
        description: 'Wysoki poziom tluszczu trzewnego moze zwiekszyc ryzyko chorob metabolicznych',
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
          title: 'Swietna regularnosc!',
          description: 'Utrzymujesz regularne pomiary. To klucz do sledzenia postepow',
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
        title: 'Sprawdz swoje trendy',
        description: `Masz ${measurements.length} pomiarow. Zobacz jak zmieniaja sie Twoje parametry`,
        action: {
          label: 'Zobacz trendy',
          tab: 'trends',
        },
        icon: 'trend',
      });
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [profiles, currentProfile, isDeviceConfigured, latestMeasurement, measurements]);
}

export default useSmartRecommendations;
