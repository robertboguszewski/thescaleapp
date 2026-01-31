/**
 * ReportService
 *
 * Generates health reports with trends and recommendations.
 *
 * @module application/services/ReportService
 */

import type {
  MeasurementRepository,
  MeasurementResult,
} from '../ports/MeasurementRepository';
import type { ProfileRepository } from '../ports/ProfileRepository';
import { calculateAgeFromBirthYear } from '../ports/ProfileRepository';
import {
  generateRecommendations,
  getPriorityRecommendations,
} from '../../domain/calculations/health-assessment';
import type { HealthRecommendation } from '../../domain/calculations/health-assessment/recommendations';
import {
  ProfileNotFoundError,
  NoMeasurementsError,
} from '../../domain/errors';

/**
 * Trends in health metrics over time
 */
export interface MetricTrends {
  /** Weight change in kg (negative = loss) */
  weightChange: number;
  /** Body fat percentage change (percentage points) */
  bodyFatChange: number;
  /** Muscle mass change in kg */
  muscleChange: number;
  /** Number of measurements in the period */
  measurementCount: number;
  /** Period in days */
  period: number;
}

/**
 * Summary of the health report
 */
export interface ReportSummary {
  /** Overall health trajectory */
  overallStatus: 'improving' | 'stable' | 'declining';
  /** Current body score (0-100) */
  bodyScore: number;
  /** Key insight for the user */
  keyInsight: string;
}

/**
 * Complete health report
 */
export interface HealthReport {
  /** Profile ID this report belongs to */
  profileId: string;
  /** Profile display name */
  profileName: string;
  /** When the report was generated */
  generatedAt: Date;
  /** Most recent measurement */
  latestMeasurement: MeasurementResult;
  /** Trends over the analysis period */
  trends: MetricTrends;
  /** Health recommendations */
  recommendations: HealthRecommendation[];
  /** Report summary */
  summary: ReportSummary;
}

// Re-export errors for backward compatibility
export { ProfileNotFoundError, NoMeasurementsError };

/**
 * Calculate trends between two measurements
 */
function calculateTrends(
  latest: MeasurementResult,
  oldest: MeasurementResult | null,
  measurementCount: number
): MetricTrends {
  if (!oldest || measurementCount < 2) {
    return {
      weightChange: 0,
      bodyFatChange: 0,
      muscleChange: 0,
      measurementCount,
      period: 0,
    };
  }

  const periodMs = latest.timestamp.getTime() - oldest.timestamp.getTime();
  const periodDays = Math.round(periodMs / (1000 * 60 * 60 * 24));

  return {
    weightChange: Number(
      (latest.raw.weightKg - oldest.raw.weightKg).toFixed(1)
    ),
    bodyFatChange: Number(
      (
        latest.calculated.bodyFatPercent - oldest.calculated.bodyFatPercent
      ).toFixed(1)
    ),
    muscleChange: Number(
      (
        latest.calculated.muscleMassKg - oldest.calculated.muscleMassKg
      ).toFixed(1)
    ),
    measurementCount,
    period: periodDays,
  };
}

/**
 * Determine overall status based on trends
 */
function determineOverallStatus(
  trends: MetricTrends
): 'improving' | 'stable' | 'declining' {
  if (trends.measurementCount < 2) {
    return 'stable';
  }

  let score = 0;

  // Weight loss is generally positive (unless underweight)
  if (trends.weightChange < -0.5) score += 1;
  else if (trends.weightChange > 1) score -= 1;

  // Body fat loss is positive
  if (trends.bodyFatChange < -1) score += 1;
  else if (trends.bodyFatChange > 1) score -= 1;

  // Muscle gain is positive
  if (trends.muscleChange > 0.3) score += 1;
  else if (trends.muscleChange < -0.5) score -= 1;

  if (score >= 2) return 'improving';
  if (score <= -2) return 'declining';
  return 'stable';
}

/**
 * Generate key insight based on trends
 */
function generateKeyInsight(
  trends: MetricTrends,
  status: 'improving' | 'stable' | 'declining'
): string {
  if (trends.measurementCount < 2) {
    return 'recommendations:health.report.regularMeasurements';
  }

  if (status === 'improving') {
    if (trends.bodyFatChange < -1 && trends.muscleChange > 0) {
      return 'recommendations:health.report.excellent';
    }
    if (trends.weightChange < -1) {
      return 'recommendations:health.report.goodProgress';
    }
    return 'recommendations:health.report.improving';
  }

  if (status === 'declining') {
    if (trends.bodyFatChange > 2) {
      return 'recommendations:health.report.fatIncrease';
    }
    if (trends.muscleChange < -1) {
      return 'recommendations:health.report.muscleLoss';
    }
    return 'recommendations:health.report.needsAttention';
  }

  return 'recommendations:health.report.stable';
}

/**
 * Service for generating health reports
 */
export class ReportService {
  constructor(
    private readonly measurementRepository: MeasurementRepository,
    private readonly profileRepository: ProfileRepository
  ) {}

  /**
   * Generate a comprehensive health report for a profile
   *
   * @param profileId - The profile to generate report for
   * @returns Complete health report with trends and recommendations
   * @throws ProfileNotFoundError if profile doesn't exist
   * @throws NoMeasurementsError if no measurements exist
   */
  async generateReport(profileId: string): Promise<HealthReport> {
    // Get profile
    const profile = await this.profileRepository.getById(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }

    // Get measurements from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const measurements = await this.measurementRepository.getAll({
      userProfileId: profileId,
      fromDate: thirtyDaysAgo,
    });

    if (measurements.length === 0) {
      throw new NoMeasurementsError(profileId);
    }

    // Latest is first (sorted by timestamp desc)
    const latestMeasurement = measurements[0];
    const oldestMeasurement =
      measurements.length > 1 ? measurements[measurements.length - 1] : null;

    // Calculate trends
    const trends = calculateTrends(
      latestMeasurement,
      oldestMeasurement,
      measurements.length
    );

    // Determine overall status
    const overallStatus = determineOverallStatus(trends);

    // Calculate age from birth year (and month if available)
    const age = calculateAgeFromBirthYear(profile.birthYear, profile.birthMonth);

    // Generate recommendations
    const allRecommendations = generateRecommendations(
      latestMeasurement.calculated,
      {
        gender: profile.gender,
        age,
        heightCm: profile.heightCm,
        ethnicity: profile.ethnicity,
      }
    );
    const recommendations = getPriorityRecommendations(allRecommendations, 3);

    // Generate summary
    const summary: ReportSummary = {
      overallStatus,
      bodyScore: latestMeasurement.calculated.bodyScore,
      keyInsight: generateKeyInsight(trends, overallStatus),
    };

    return {
      profileId,
      profileName: profile.name,
      generatedAt: new Date(),
      latestMeasurement,
      trends,
      recommendations,
      summary,
    };
  }

  /**
   * Get a quick summary without full report generation
   */
  async getQuickSummary(
    profileId: string
  ): Promise<{ bodyScore: number; status: string } | null> {
    const measurements = await this.measurementRepository.getAll({
      userProfileId: profileId,
      limit: 1,
    });

    if (measurements.length === 0) {
      return null;
    }

    return {
      bodyScore: measurements[0].calculated.bodyScore,
      status: measurements[0].calculated.bodyScore >= 70 ? 'good' : 'needs-attention',
    };
  }
}
