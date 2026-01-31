/**
 * Card Component
 *
 * Container component with macOS-inspired styling.
 * Provides consistent elevation and padding.
 *
 * @module presentation/components/common/Card
 */

import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'bordered' | 'flat';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  /** Visual variant of the card */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Optional title for the card header */
  title?: string;
  /** Optional subtitle for the card header */
  subtitle?: string;
  /** Optional action elements in header */
  headerAction?: React.ReactNode;
  /** Whether the card is interactive (hoverable) */
  interactive?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card content */
  children: React.ReactNode;
  /** Click handler for interactive cards */
  onClick?: () => void;
}

/**
 * Get variant-specific CSS classes
 */
const getVariantClasses = (variant: CardVariant): string => {
  const variants: Record<CardVariant, string> = {
    default:
      'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700',
    elevated:
      'bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700',
    bordered:
      'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600',
    flat:
      'bg-gray-50 dark:bg-gray-800/50',
  };
  return variants[variant];
};

/**
 * Get padding-specific CSS classes
 */
const getPaddingClasses = (padding: CardPadding): string => {
  const paddings: Record<CardPadding, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };
  return paddings[padding];
};

/**
 * Card Header Component
 */
const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="flex-shrink-0 ml-4">{action}</div>}
  </div>
);

/**
 * Card component with macOS-inspired styling
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  title,
  subtitle,
  headerAction,
  interactive = false,
  className = '',
  children,
  onClick,
}) => {
  const baseClasses = 'rounded-xl';
  const variantClasses = getVariantClasses(variant);
  const paddingClasses = getPaddingClasses(padding);
  const interactiveClasses = interactive
    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
    : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${paddingClasses} ${interactiveClasses} ${className}`}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onClick?.();
              }
            }
          : undefined
      }
    >
      {title && (
        <CardHeader title={title} subtitle={subtitle} action={headerAction} />
      )}
      {children}
    </div>
  );
};

/**
 * CardContent wrapper for consistent inner padding when Card has no padding
 */
export const CardContent: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className = '', children }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

/**
 * CardFooter for actions at the bottom
 */
export const CardFooter: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className = '', children }) => (
  <div
    className={`border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 ${className}`}
  >
    {children}
  </div>
);

export default Card;
