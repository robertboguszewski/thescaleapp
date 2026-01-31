/**
 * BodyScoreGauge Component
 *
 * Circular gauge displaying the overall body composition score (0-100).
 * Uses SVG for rendering with animated transitions.
 *
 * @module presentation/components/dashboard/BodyScoreGauge
 */

import React from 'react';
import { Card } from '../common/Card';

export interface BodyScoreGaugeProps {
  /** Body score value (0-100) */
  score: number;
  /** Size of the gauge in pixels */
  size?: number;
  /** Stroke width */
  strokeWidth?: number;
  /** Show labels */
  showLabels?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Get score category and color
 */
const getScoreCategory = (score: number): {
  label: string;
  color: string;
  bgColor: string;
} => {
  if (score >= 80) {
    return {
      label: 'Doskonaly',
      color: '#22c55e', // green-500
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    };
  }
  if (score >= 60) {
    return {
      label: 'Dobry',
      color: '#3b82f6', // blue-500
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    };
  }
  if (score >= 40) {
    return {
      label: 'Przecietny',
      color: '#f59e0b', // amber-500
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    };
  }
  return {
    label: 'Do poprawy',
    color: '#ef4444', // red-500
    bgColor: 'bg-red-100 dark:bg-red-900/20',
  };
};

/**
 * BodyScoreGauge component
 */
export const BodyScoreGauge: React.FC<BodyScoreGaugeProps> = ({
  score,
  size = 200,
  strokeWidth = 12,
  showLabels = true,
  className = '',
}) => {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  // Calculate SVG parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Get category info
  const category = getScoreCategory(clampedScore);

  // Animation state
  const [animatedScore, setAnimatedScore] = React.useState(0);

  React.useEffect(() => {
    const duration = 1000; // 1 second animation
    const steps = 60;
    const increment = clampedScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= clampedScore) {
        setAnimatedScore(clampedScore);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [clampedScore]);

  return (
    <Card className={className} padding="lg">
      <div className="flex flex-col items-center">
        {/* Gauge SVG */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-200 dark:text-gray-700"
            />

            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={category.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {animatedScore}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              / 100
            </span>
          </div>
        </div>

        {/* Labels */}
        {showLabels && (
          <div className="mt-4 text-center">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${category.bgColor}`}
              style={{ color: category.color }}
            >
              {category.label}
            </span>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Wynik ogolny skladn ciala
            </p>
          </div>
        )}

        {/* Scale legend */}
        <div className="mt-4 w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
          <div className="mt-1 h-2 rounded-full overflow-hidden flex">
            <div className="flex-1 bg-red-400" />
            <div className="flex-1 bg-yellow-400" />
            <div className="flex-1 bg-blue-400" />
            <div className="flex-1 bg-green-400" />
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * Mini version of the body score gauge for compact display
 */
export const MiniBodyScoreGauge: React.FC<{
  score: number;
  size?: number;
}> = ({ score, size = 60 }) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const category = getScoreCategory(clampedScore);

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={category.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {clampedScore}
        </span>
      </div>
    </div>
  );
};

export default BodyScoreGauge;
