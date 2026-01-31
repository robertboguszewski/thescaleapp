/**
 * MeasurementRepository Port
 *
 * Defines the interface for measurement persistence operations.
 * This is a port in the Hexagonal Architecture - implementations
 * are provided in the infrastructure layer.
 */

import type { CalculatedMetrics, RawMeasurement } from '../../domain/calculations/types';

/**
 * Special ID for guest/unassigned measurements
 * Used when profile cannot be determined automatically
 */
export const GUEST_PROFILE_ID = '__guest__';

/**
 * Complete measurement result with all data
 */
export interface MeasurementResult {
  id: string;
  timestamp: Date;
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  userProfileId: string;
}

/**
 * Query parameters for filtering measurements
 */
export interface MeasurementQuery {
  /** Filter by user profile ID */
  userProfileId?: string;
  /** Filter measurements from this date (inclusive) */
  fromDate?: Date;
  /** Filter measurements until this date (inclusive) */
  toDate?: Date;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Repository interface for measurement persistence
 *
 * Implementations:
 * - JsonMeasurementRepository (file-based JSON storage)
 * - InMemoryMeasurementRepository (for testing)
 */
export interface MeasurementRepository {
  /**
   * Save a measurement result
   * If measurement with same ID exists, it will be overwritten
   */
  save(measurement: MeasurementResult): Promise<void>;

  /**
   * Retrieve a measurement by its ID
   * @returns The measurement or null if not found
   */
  getById(id: string): Promise<MeasurementResult | null>;

  /**
   * Retrieve all measurements matching the query
   * Results are sorted by timestamp descending (newest first)
   */
  getAll(query?: MeasurementQuery): Promise<MeasurementResult[]>;

  /**
   * Delete a measurement by its ID
   * No error if measurement doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all measurements for a user profile
   */
  deleteAll(userProfileId: string): Promise<void>;

  /**
   * Count measurements matching the query
   */
  count(query?: MeasurementQuery): Promise<number>;

  /**
   * Update a measurement's profile assignment
   * Used for reassigning guest measurements to a specific profile
   */
  updateProfileAssignment(measurementId: string, newProfileId: string): Promise<void>;
}
