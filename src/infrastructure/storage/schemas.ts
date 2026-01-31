/**
 * Zod Schemas for Storage Validation
 *
 * Validates data before reading/writing to ensure data integrity.
 *
 * @module infrastructure/storage/schemas
 */

import { z } from 'zod';

/**
 * Schema for RawMeasurement
 */
export const RawMeasurementSchema = z.object({
  weightKg: z.number().min(0.1).max(150),
  impedanceOhm: z.number().optional(),
  heartRateBpm: z.number().optional(),
});

/**
 * Schema for CalculatedMetrics
 */
export const CalculatedMetricsSchema = z.object({
  bmi: z.number(),
  bodyFatPercent: z.number(),
  muscleMassKg: z.number(),
  bodyWaterPercent: z.number(),
  boneMassKg: z.number(),
  visceralFatLevel: z.number(),
  bmrKcal: z.number(),
  leanBodyMassKg: z.number(),
  proteinPercent: z.number(),
  bodyScore: z.number(),
});

/**
 * Special profile ID for guest/unassigned measurements
 */
const GUEST_PROFILE_ID = '__guest__';

/**
 * Schema for MeasurementResult (stored format)
 * Dates are stored as ISO strings in JSON
 * userProfileId can be either a UUID or the special GUEST_PROFILE_ID
 */
export const StoredMeasurementSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  raw: RawMeasurementSchema,
  calculated: CalculatedMetricsSchema,
  userProfileId: z.string().refine(
    (val) => val === GUEST_PROFILE_ID || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
    { message: 'Must be a valid UUID or guest profile ID' }
  ),
});

/**
 * Schema for UserProfile base fields
 * Uses birthYear for more accurate age calculation over time
 * Optional birthMonth (1-12) for more precise age calculation
 */
export const UserProfileSchema = z.object({
  gender: z.enum(['male', 'female']),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 5),
  birthMonth: z.number().int().min(1).max(12).optional(),
  heightCm: z.number().min(50).max(250),
  ethnicity: z.enum(['asian', 'non-asian']).optional(),
});

/**
 * Schema for StoredUserProfile (stored format)
 * Dates are stored as ISO strings in JSON
 */
export const StoredUserProfileSchema = UserProfileSchema.extend({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Type for stored measurement (with string dates)
 */
export type StoredMeasurement = z.infer<typeof StoredMeasurementSchema>;

/**
 * Type for stored profile (with string dates)
 */
export type StoredProfile = z.infer<typeof StoredUserProfileSchema>;

/**
 * Convert MeasurementResult to storage format
 */
export function toStoredMeasurement(measurement: {
  id: string;
  timestamp: Date;
  raw: z.infer<typeof RawMeasurementSchema>;
  calculated: z.infer<typeof CalculatedMetricsSchema>;
  userProfileId: string;
}): StoredMeasurement {
  return {
    id: measurement.id,
    timestamp: measurement.timestamp.toISOString(),
    raw: measurement.raw,
    calculated: measurement.calculated,
    userProfileId: measurement.userProfileId,
  };
}

/**
 * Convert stored measurement to domain format
 */
export function fromStoredMeasurement(stored: StoredMeasurement): {
  id: string;
  timestamp: Date;
  raw: z.infer<typeof RawMeasurementSchema>;
  calculated: z.infer<typeof CalculatedMetricsSchema>;
  userProfileId: string;
} {
  return {
    id: stored.id,
    timestamp: new Date(stored.timestamp),
    raw: stored.raw,
    calculated: stored.calculated,
    userProfileId: stored.userProfileId,
  };
}

/**
 * Convert StoredUserProfile to storage format
 */
export function toStoredProfile(profile: {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StoredProfile {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    birthYear: profile.birthYear,
    birthMonth: profile.birthMonth,
    heightCm: profile.heightCm,
    ethnicity: profile.ethnicity,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Convert stored profile to domain format
 */
export function fromStoredProfile(stored: StoredProfile): {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: stored.id,
    name: stored.name,
    gender: stored.gender,
    birthYear: stored.birthYear,
    birthMonth: stored.birthMonth,
    heightCm: stored.heightCm,
    ethnicity: stored.ethnicity,
    isDefault: stored.isDefault,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}
