/**
 * Recommendations Panel Component
 *
 * Displays personalized health recommendations based on analysis.
 *
 * @module presentation/components/analysis/RecommendationsPanel
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import type { HealthRecommendation } from '../../../shared/types';

interface RecommendationsPanelProps {
  recommendations: HealthRecommendation[];
  className?: string;
}

/**
 * Priority icon based on recommendation type
 */
const PriorityIcon: React.FC<{ type: 'info' | 'warning' | 'critical' }> = ({ type }) => {
  const config = {
    critical: {
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
    },
    warning: {
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
  };

  const { color, bg, icon } = config[type];

  return (
    <div className={`p-2 rounded-lg ${bg}`}>
      <span className={color}>{icon}</span>
    </div>
  );
};

/**
 * Category icon
 */
const CategoryIcon: React.FC<{
  category: HealthRecommendation['category'];
}> = ({ category }) => {
  const icons: Record<HealthRecommendation['category'], React.ReactNode> = {
    body_fat: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    muscle: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6.5 6.5L17.5 17.5M4.5 12.5l5-5 2 2M12.5 19.5l5-5-2-2" />
      </svg>
    ),
    visceral: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
    bmi: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    hydration: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
    general: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return <span className="text-gray-400">{icons[category]}</span>;
};

/**
 * Single recommendation item
 */
/**
 * Helper to translate a value that may be a translation key or already translated
 */
const translateIfKey = (value: string, t: (key: string) => string): string => {
  // If it looks like a translation key (contains ':' namespace separator), translate it
  if (value.includes(':')) {
    const translated = t(value);
    // If translation returns the key itself (not found), return original
    return translated === value || translated.startsWith('⚠️') ? value : translated;
  }
  return value;
};

const RecommendationItem: React.FC<{
  recommendation: HealthRecommendation;
}> = ({ recommendation }) => {
  const { t } = useTranslation(['analysis', 'recommendations']);
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Translate title and message if they are translation keys
  const title = translateIfKey(recommendation.title, t);
  const message = translateIfKey(recommendation.message, t);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-start gap-3">
          <PriorityIcon type={recommendation.type} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CategoryIcon category={recommendation.category} />
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {t(`recommendations.categories.${recommendation.category}`)}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {message}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800">
          <div className="ml-12">
            {/* Actions list */}
            {recommendation.actions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {t('recommendations.suggestedActions')}
                </p>
                <ul className="space-y-2">
                  {recommendation.actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <svg
                        className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      {translateIfKey(action, t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources */}
            {recommendation.sources && recommendation.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">
                  {t('recommendations.source')}: {recommendation.sources.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Empty state when no recommendations
 */
const EmptyState: React.FC = () => {
  const { t } = useTranslation('analysis');

  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h4 className="font-medium text-gray-900 dark:text-white">
        {t('recommendations.allGood')}
      </h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {t('recommendations.allGoodMessage')}
      </p>
    </div>
  );
};

/**
 * Recommendations Panel
 */
export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  className = '',
}) => {
  const { t } = useTranslation('analysis');

  // Sort recommendations by priority: critical > warning > info
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priority = { critical: 0, warning: 1, info: 2 };
    return priority[a.type] - priority[b.type];
  });

  return (
    <Card className={className} padding="lg">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('recommendations.title')}
      </h3>

      {sortedRecommendations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {sortedRecommendations.map((recommendation, index) => (
            <RecommendationItem key={index} recommendation={recommendation} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default RecommendationsPanel;
