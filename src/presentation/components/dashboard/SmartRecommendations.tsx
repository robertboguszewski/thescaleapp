/**
 * SmartRecommendations Component
 *
 * Displays context-aware recommendations based on user data.
 * Shows actionable suggestions and insights.
 *
 * @module presentation/components/dashboard/SmartRecommendations
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useSmartRecommendations, type SmartRecommendation, type RecommendationType } from '../../hooks/useSmartRecommendations';
import { useAppStore, type SettingsSubTab } from '../../stores/appStore';

/**
 * Icon components for recommendations
 */
const RecommendationIcon: React.FC<{
  icon: SmartRecommendation['icon'];
  type: RecommendationType;
}> = ({ icon, type }) => {
  const typeColors = {
    action: 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30',
    insight: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    success: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  };

  const iconSvgs: Record<SmartRecommendation['icon'], React.ReactNode> = {
    scale: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    ),
    profile: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    device: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
      </svg>
    ),
    trend: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M18 9l-5 5-4-4-6 6" />
      </svg>
    ),
    check: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
    alert: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  };

  return (
    <div className={`p-2 rounded-lg ${typeColors[type]}`}>
      {iconSvgs[icon]}
    </div>
  );
};

/**
 * Recommendation card component
 */
const RecommendationItem: React.FC<{
  recommendation: SmartRecommendation;
  onAction: () => void;
}> = ({ recommendation, onAction }) => (
  <div
    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    data-testid={`recommendation-${recommendation.id}`}
  >
    <RecommendationIcon icon={recommendation.icon} type={recommendation.type} />
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 dark:text-white text-sm">
        {recommendation.title}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
        {recommendation.description}
      </p>
    </div>
    {recommendation.action && (
      <Button
        variant="secondary"
        size="sm"
        onClick={onAction}
        className="flex-shrink-0"
      >
        {recommendation.action.label}
      </Button>
    )}
  </div>
);

/**
 * Empty state when no recommendations
 */
const EmptyRecommendations: React.FC<{ t: (key: string) => string }> = ({ t }) => (
  <div className="text-center py-8">
    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
      <svg className="w-6 h-6 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4L12 14.01l-3-3" />
      </svg>
    </div>
    <p className="text-sm font-medium text-gray-900 dark:text-white">
      {t('recommendations.allGood')}
    </p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
      {t('recommendations.allGoodMessage')}
    </p>
  </div>
);

/**
 * SmartRecommendations component
 */
export const SmartRecommendations: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const recommendations = useSmartRecommendations();
  const { setActiveTab, setSettingsSubTab } = useAppStore();

  const handleAction = (recommendation: SmartRecommendation) => {
    if (recommendation.action) {
      setActiveTab(recommendation.action.tab);
      if (recommendation.action.subTab) {
        setSettingsSubTab(recommendation.action.subTab as SettingsSubTab);
      }
    }
  };

  return (
    <Card title={t('recommendations.title')} subtitle={t('recommendations.subtitle')}>
      {recommendations.length === 0 ? (
        <EmptyRecommendations t={t} />
      ) : (
        <div className="space-y-1 -m-1">
          {recommendations.map((rec) => (
            <RecommendationItem
              key={rec.id}
              recommendation={rec}
              onAction={() => handleAction(rec)}
            />
          ))}
        </div>
      )}
    </Card>
  );
};

export default SmartRecommendations;
