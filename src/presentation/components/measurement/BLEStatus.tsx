/**
 * BLEStatus Component
 *
 * Displays the current Bluetooth connection status.
 * Shows animated indicators for different states.
 *
 * @module presentation/components/measurement/BLEStatus
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBLEStore, getStatusMessage } from '../../stores/bleStore';
import type { BLEConnectionState } from '../../../application/ports/BLEPort';
import { getBLEStateMessage } from '../../../domain/ble-states';

export interface BLEStatusProps {
  /** Compact display mode */
  compact?: boolean;
  /** Show action button */
  showAction?: boolean;
  /** Action button callback */
  onAction?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Status icon based on connection state
 */
const StatusIcon: React.FC<{
  state: BLEConnectionState;
  className?: string;
}> = ({ state, className }) => {
  const iconClasses = className || 'w-8 h-8';

  switch (state) {
    case 'disconnected':
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          <path d="M1 1l22 22" strokeLinecap="round" />
        </svg>
      );

    case 'scanning':
      return (
        <div className="relative">
          <svg className={`${iconClasses} animate-pulse`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-current opacity-30 animate-ping" />
          </div>
        </div>
      );

    case 'connecting':
      return (
        <svg className={`${iconClasses} animate-pulse`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          <circle cx="18" cy="18" r="3" className="animate-pulse" />
        </svg>
      );

    case 'connected':
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          <circle cx="18" cy="6" r="3" fill="currentColor" />
        </svg>
      );

    case 'reading':
      return (
        <div className="relative">
          <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" />
          </svg>
          <div className="absolute -right-1 -top-1">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
          </div>
        </div>
      );

    case 'error':
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );

    default:
      return null;
  }
};

/**
 * Get color classes for state
 */
const getStateColors = (state: BLEConnectionState) => {
  const colors: Record<BLEConnectionState, { icon: string; bg: string; text: string }> = {
    disconnected: {
      icon: 'text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
    },
    scanning: {
      icon: 'text-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
    },
    connecting: {
      icon: 'text-yellow-500',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
    },
    connected: {
      icon: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
    },
    reading: {
      icon: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
    },
    error: {
      icon: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
    },
  };
  return colors[state];
};

/**
 * BLEStatus component
 */
export const BLEStatus: React.FC<BLEStatusProps> = ({
  compact = false,
  showAction = true,
  onAction,
  className = '',
}) => {
  const { t } = useTranslation();
  const { connectionState, lastError } = useBLEStore();
  const colors = getStateColors(connectionState);
  const stateMessage = getBLEStateMessage(connectionState);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={colors.icon}>
          <StatusIcon state={connectionState} className="w-5 h-5" />
        </div>
        <span className={`text-sm font-medium ${colors.text}`}>
          {t(stateMessage.title)}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 ${colors.bg} ${className}`}>
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div className={`p-3 rounded-full ${colors.bg} ${colors.icon}`}>
          <StatusIcon state={connectionState} className="w-10 h-10" />
        </div>

        {/* Status info */}
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${colors.text}`}>
            {t(stateMessage.title)}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t(stateMessage.description)}
          </p>

          {/* Error message */}
          {connectionState === 'error' && lastError && (
            <div className="mt-3 p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
              <p className="text-sm text-red-700 dark:text-red-300">
                {lastError.message}
              </p>
              {lastError.suggestion && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {lastError.suggestion}
                </p>
              )}
            </div>
          )}

          {/* Action button */}
          {showAction && stateMessage.action && onAction && (
            <button
              onClick={onAction}
              className={`mt-4 px-4 py-2 rounded-lg font-medium text-sm transition-colors
                ${connectionState === 'error'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : connectionState === 'connected'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                }
              `}
            >
              {t(stateMessage.action)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Inline BLE status for header/toolbar
 */
export const InlineBLEStatus: React.FC<{
  onClick?: () => void;
}> = ({ onClick }) => {
  const { t } = useTranslation();
  const { connectionState } = useBLEStore();
  const colors = getStateColors(connectionState);
  const stateMessage = getBLEStateMessage(connectionState);

  const isBusy = connectionState === 'scanning' || connectionState === 'connecting' || connectionState === 'reading';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
        ${colors.bg} hover:opacity-80
      `}
    >
      <div className="relative">
        <div className={colors.icon}>
          <StatusIcon state={connectionState} className="w-4 h-4" />
        </div>
        {isBusy && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-current rounded-full animate-pulse" />
        )}
      </div>
      <span className={`text-xs font-medium ${colors.text}`}>
        {t(stateMessage.title)}
      </span>
    </button>
  );
};

export default BLEStatus;
