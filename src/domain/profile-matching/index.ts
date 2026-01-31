/**
 * Profile Matching Module
 * Exports all profile matching functionality
 *
 * @module domain/profile-matching
 */

export {
  WEIGHT_THRESHOLD_KG,
  MIN_MEASUREMENTS_FOR_MATCHING,
  detectProfile,
  calculateWeightDeviation,
  isWithinThreshold,
} from './ProfileMatcher';

export type {
  DetectionResultType,
  DetectionResult,
  ProfileWeightData,
} from './ProfileMatcher';
