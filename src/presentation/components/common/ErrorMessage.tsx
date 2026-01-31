/**
 * ErrorMessage Component
 *
 * Displays error messages with optional retry action.
 * Supports different severity levels.
 *
 * @module presentation/components/common/ErrorMessage
 */

import React from 'react';
import { Button } from './Button';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorMessageProps {
  /** Error message to display */
  message: string;
  /** Optional title */
  title?: string;
  /** Severity level */
  severity?: ErrorSeverity;
  /** Retry callback */
  onRetry?: () => void;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode without borders */
  compact?: boolean;
}

/**
 * Get severity-specific classes and icon
 */
const getSeverityConfig = (severity: ErrorSeverity) => {
  const configs = {
    error: {
      container:
        'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'text-red-500 dark:text-red-400',
      title: 'text-red-800 dark:text-red-200',
      message: 'text-red-700 dark:text-red-300',
    },
    warning: {
      container:
        'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-500 dark:text-yellow-400',
      title: 'text-yellow-800 dark:text-yellow-200',
      message: 'text-yellow-700 dark:text-yellow-300',
    },
    info: {
      container:
        'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500 dark:text-blue-400',
      title: 'text-blue-800 dark:text-blue-200',
      message: 'text-blue-700 dark:text-blue-300',
    },
  };
  return configs[severity];
};

/**
 * Error Icon Component
 */
const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
  >
    <path
      fillRule="evenodd"
      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Warning Icon Component
 */
const WarningIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
  >
    <path
      fillRule="evenodd"
      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Info Icon Component
 */
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    width="24"
    height="24"
  >
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Get icon component for severity
 */
const getIcon = (severity: ErrorSeverity) => {
  const icons = {
    error: ErrorIcon,
    warning: WarningIcon,
    info: InfoIcon,
  };
  return icons[severity];
};

/**
 * ErrorMessage component
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title,
  severity = 'error',
  onRetry,
  onDismiss,
  className = '',
  compact = false,
}) => {
  const config = getSeverityConfig(severity);
  const Icon = getIcon(severity);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Icon className={`w-5 h-5 flex-shrink-0 ${config.icon}`} />
        <p className={`text-sm ${config.message}`}>{message}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 ${config.container} ${className}`}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`w-6 h-6 ${config.icon}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.title}`}>{title}</h3>
          )}
          <p className={`text-sm ${title ? 'mt-1' : ''} ${config.message}`}>
            {message}
          </p>
          {(onRetry || onDismiss) && (
            <div className="mt-4 flex gap-3">
              {onRetry && (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Sprobuj ponownie
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" variant="ghost" onClick={onDismiss}>
                  Odrzuc
                </Button>
              )}
            </div>
          )}
        </div>
        {onDismiss && !onRetry && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              className={`inline-flex rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.icon}`}
              onClick={onDismiss}
            >
              <span className="sr-only">Zamknij</span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Inline error text for form fields
 */
export const InlineError: React.FC<{
  message: string;
  className?: string;
}> = ({ message, className = '' }) => (
  <p className={`text-sm text-red-600 dark:text-red-400 mt-1 ${className}`}>
    {message}
  </p>
);

export default ErrorMessage;
