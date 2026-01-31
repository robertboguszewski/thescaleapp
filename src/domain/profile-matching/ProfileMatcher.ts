/**
 * Profile Matcher
 * Logic for detecting and matching user profiles based on weight measurements
 *
 * Design Decisions:
 * - Weight threshold: 4.5kg (industry standard for body composition scales)
 * - Ambiguous matches: Always ask user to confirm (never auto-select)
 * - New profiles: Require confirmation before assignment
 *
 * @module domain/profile-matching/ProfileMatcher
 */

/**
 * Weight threshold in kilograms for profile matching
 * Industry standard tolerance for body composition scales
 */
export const WEIGHT_THRESHOLD_KG = 4.5;

/**
 * Minimum number of measurements required for reliable matching
 */
export const MIN_MEASUREMENTS_FOR_MATCHING = 2;

/**
 * Types of detection results
 */
export type DetectionResultType = 'confident' | 'ambiguous' | 'no_match' | 'new_profile';

/**
 * Result of profile detection
 */
export interface DetectionResult {
  /** Type of detection result */
  type: DetectionResultType;
  /** Matched profile ID (for confident matches) */
  profileId?: string;
  /** Candidate profile IDs (for ambiguous or new_profile) */
  candidateIds?: string[];
  /** Confidence level (0-100) */
  confidence: number;
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Human-readable reason for the result */
  reason: string;
}

/**
 * Profile weight data for matching
 */
export interface ProfileWeightData {
  /** Unique profile identifier */
  profileId: string;
  /** Average weight from measurement history (null if no history) */
  averageWeight: number | null;
  /** Number of measurements in history */
  measurementCount: number;
}

/**
 * Detect which profile matches a new weight measurement
 *
 * Matching algorithm:
 * 1. Filter profiles with sufficient measurement history (>= 2 measurements)
 * 2. Find profiles within 4.5kg threshold of the new weight
 * 3. If single match with good confidence -> return confident match
 * 4. If multiple matches -> always ask user (ambiguous)
 * 5. If no match but new profiles exist -> suggest new_profile
 * 6. If no match at all -> return no_match
 *
 * @param newWeightKg - The new weight measurement in kilograms
 * @param profiles - Array of profiles with their weight data
 * @returns Detection result with match information
 */
export function detectProfile(
  newWeightKg: number,
  profiles: ProfileWeightData[]
): DetectionResult {
  // Validate input
  if (newWeightKg <= 0) {
    return {
      type: 'no_match',
      confidence: 0,
      requiresConfirmation: true,
      reason: 'recommendations:health.profileMatching.invalidWeight',
    };
  }

  // Filter profiles with sufficient weight history for reliable matching
  const profilesWithHistory = profiles.filter(
    (p) => p.averageWeight !== null && p.measurementCount >= MIN_MEASUREMENTS_FOR_MATCHING
  );

  // Find matching profiles (within threshold)
  const matches = profilesWithHistory.filter(
    (p) => Math.abs(newWeightKg - p.averageWeight!) <= WEIGHT_THRESHOLD_KG
  );

  if (matches.length === 0) {
    // Check for new profiles without sufficient history
    const newProfiles = profiles.filter(
      (p) => p.averageWeight === null || p.measurementCount < MIN_MEASUREMENTS_FOR_MATCHING
    );

    if (newProfiles.length > 0) {
      return {
        type: 'new_profile',
        candidateIds: newProfiles.map((p) => p.profileId),
        confidence: 50,
        requiresConfirmation: true,
        reason: 'recommendations:health.profileMatching.newProfileNoHistory',
      };
    }

    return {
      type: 'no_match',
      confidence: 0,
      requiresConfirmation: true,
      reason: 'recommendations:health.profileMatching.weightNoMatch',
    };
  }

  if (matches.length === 1) {
    const match = matches[0];
    const deviation = Math.abs(newWeightKg - match.averageWeight!);

    // Calculate confidence: 100% at exact match, decreasing linearly to 70% at threshold
    const confidence = Math.round(100 - (deviation / WEIGHT_THRESHOLD_KG) * 30);

    return {
      type: 'confident',
      profileId: match.profileId,
      confidence,
      requiresConfirmation: false,
      reason: 'recommendations:health.profileMatching.matchedByWeight',
    };
  }

  // Multiple matches - ALWAYS ask user (per design decision)
  return {
    type: 'ambiguous',
    candidateIds: matches.map((m) => m.profileId),
    confidence: 50,
    requiresConfirmation: true,
    reason: 'recommendations:health.profileMatching.ambiguous',
  };
}

/**
 * Calculate the weight deviation from profile average
 *
 * @param newWeightKg - The new weight measurement
 * @param profileAverageKg - The profile's average weight
 * @returns Absolute deviation in kilograms
 */
export function calculateWeightDeviation(
  newWeightKg: number,
  profileAverageKg: number
): number {
  return Math.abs(newWeightKg - profileAverageKg);
}

/**
 * Check if a weight measurement is within threshold of a profile
 *
 * @param newWeightKg - The new weight measurement
 * @param profileAverageKg - The profile's average weight
 * @param threshold - Optional custom threshold (default: WEIGHT_THRESHOLD_KG)
 * @returns true if within threshold, false otherwise
 */
export function isWithinThreshold(
  newWeightKg: number,
  profileAverageKg: number,
  threshold: number = WEIGHT_THRESHOLD_KG
): boolean {
  return calculateWeightDeviation(newWeightKg, profileAverageKg) <= threshold;
}
