/**
 * SetupStatus Component
 *
 * Displays onboarding checklist on the dashboard to guide users
 * through initial app configuration (profile, device, first measurement).
 *
 * @module presentation/components/dashboard/SetupStatus
 */

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useSetupStatus, type SetupStep, type StepStatus } from '../../hooks/useSetupStatus';
import { useAppStore, type Tab, type SettingsSubTab } from '../../stores/appStore';

/**
 * Step icon component based on status
 */
const StepIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  if (status === 'completed') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-green-600 dark:text-green-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === 'current') {
    return (
      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-primary-600 dark:bg-primary-400 animate-pulse" />
      </div>
    );
  }

  // pending
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-500" />
    </div>
  );
};

/**
 * Get action button text based on step
 */
const getActionText = (stepId: SetupStep['id']): string => {
  switch (stepId) {
    case 'profile':
      return 'Rozpocznij';
    case 'device':
      return 'Konfiguruj';
    case 'measurement':
      return 'Wykonaj pomiar';
    default:
      return 'Przejdź';
  }
};

/**
 * Setup step item component
 */
const SetupStepItem: React.FC<{
  step: SetupStep;
  isLast: boolean;
  onNavigate: (tab: Tab, subTab?: string) => void;
}> = ({ step, isLast, onNavigate }) => {
  const handleClick = () => {
    onNavigate(step.navigateTo.tab, step.navigateTo.subTab);
  };

  const isActionable = step.status === 'current';

  return (
    <div
      data-testid={`step-${step.id}`}
      data-status={step.status}
      className={`
        relative flex items-start gap-4 py-3
        ${!isLast ? 'pb-6' : ''}
      `}
    >
      {/* Connector line */}
      {!isLast && (
        <div
          className={`
            absolute left-4 top-11 w-0.5 h-[calc(100%-2rem)]
            ${step.status === 'completed' ? 'bg-green-200 dark:bg-green-900/50' : 'bg-gray-200 dark:bg-gray-700'}
          `}
        />
      )}

      {/* Icon */}
      <div className="flex-shrink-0 z-10">
        <StepIcon status={step.status} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <p
              className={`
                font-medium
                ${step.status === 'completed' ? 'text-gray-500 dark:text-gray-400 line-through' : ''}
                ${step.status === 'current' ? 'text-gray-900 dark:text-white' : ''}
                ${step.status === 'pending' ? 'text-gray-400 dark:text-gray-500' : ''}
              `}
            >
              {step.label}
            </p>
            <p
              className={`
                text-sm mt-0.5
                ${step.status === 'pending' ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}
              `}
            >
              {step.description}
            </p>
          </div>

          {isActionable && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleClick}
              data-testid={`step-${step.id}-action`}
            >
              {getActionText(step.id)}
            </Button>
          )}

          {step.status === 'completed' && (
            <button
              onClick={handleClick}
              data-testid={`step-${step.id}-action`}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Edytuj
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Progress bar component
 */
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="mt-4">
    <div className="flex items-center justify-between text-sm mb-2">
      <span className="text-gray-500 dark:text-gray-400">Postęp konfiguracji</span>
      <span className="font-medium text-gray-900 dark:text-white">
        {Math.round(progress)}%
      </span>
    </div>
    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        data-testid="progress-bar"
        className="h-full bg-primary-600 dark:bg-primary-500 rounded-full transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

/**
 * SetupStatus component props
 */
export interface SetupStatusProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * SetupStatus component
 *
 * Displays an onboarding checklist to guide users through
 * initial app configuration. Automatically hides when setup is complete.
 */
export const SetupStatus: React.FC<SetupStatusProps> = ({ className = '' }) => {
  const {
    isSetupComplete,
    setupSteps,
    completionProgress,
  } = useSetupStatus();

  const { setActiveTab, setSettingsSubTab } = useAppStore();

  // Don't render when setup is complete
  if (isSetupComplete) {
    return null;
  }

  const handleNavigate = (tab: Tab, subTab?: string) => {
    setActiveTab(tab);
    if (subTab && tab === 'settings') {
      setSettingsSubTab(subTab as SettingsSubTab);
    }
  };

  return (
    <Card
      className={className}
      title="Konfiguracja aplikacji"
      subtitle="Wykonaj poniższe kroki aby rozpocząć korzystanie z aplikacji"
    >
      <div className="space-y-1">
        {setupSteps.map((step, index) => (
          <SetupStepItem
            key={step.id}
            step={step}
            isLast={index === setupSteps.length - 1}
            onNavigate={handleNavigate}
          />
        ))}
      </div>

      <ProgressBar progress={completionProgress} />
    </Card>
  );
};

export default SetupStatus;
