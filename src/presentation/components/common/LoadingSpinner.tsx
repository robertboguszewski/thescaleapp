/**
 * LoadingSpinner Component
 *
 * Full-featured loading spinner with optional message.
 *
 * @module presentation/components/common/LoadingSpinner
 */

import React from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'white' | 'gray';

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Optional loading message */
  message?: string;
  /** Center in parent container */
  centered?: boolean;
  /** Full screen overlay */
  fullScreen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get size-specific CSS classes
 */
const getSizeClasses = (size: SpinnerSize): { spinner: string; text: string } => {
  const sizes: Record<SpinnerSize, { spinner: string; text: string }> = {
    xs: { spinner: 'w-4 h-4', text: 'text-xs' },
    sm: { spinner: 'w-5 h-5', text: 'text-sm' },
    md: { spinner: 'w-8 h-8', text: 'text-base' },
    lg: { spinner: 'w-12 h-12', text: 'text-lg' },
    xl: { spinner: 'w-16 h-16', text: 'text-xl' },
  };
  return sizes[size];
};

/**
 * Get variant-specific CSS classes
 */
const getVariantClasses = (variant: SpinnerVariant): { circle: string; path: string } => {
  const variants: Record<SpinnerVariant, { circle: string; path: string }> = {
    primary: {
      circle: 'text-primary-200 dark:text-primary-900',
      path: 'text-primary-600 dark:text-primary-400',
    },
    white: {
      circle: 'text-white/30',
      path: 'text-white',
    },
    gray: {
      circle: 'text-gray-200 dark:text-gray-700',
      path: 'text-gray-600 dark:text-gray-400',
    },
  };
  return variants[variant];
};

/**
 * LoadingSpinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  message,
  centered = false,
  fullScreen = false,
  className = '',
}) => {
  const sizeClasses = getSizeClasses(size);
  const variantClasses = getVariantClasses(variant);

  const spinner = (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses.spinner}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className={`opacity-25 ${variantClasses.circle}`}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className={variantClasses.path}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && (
        <p
          className={`mt-3 text-gray-600 dark:text-gray-400 ${sizeClasses.text}`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px]">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * Skeleton loader for content placeholders
 */
export const Skeleton: React.FC<{
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}> = ({ className = '', variant = 'text', width, height }) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';

  const variantClasses: Record<string, string> = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'circular' ? width : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export default LoadingSpinner;
