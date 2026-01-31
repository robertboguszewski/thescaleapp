/**
 * ViewHistoryUseCase
 *
 * CQRS Query: Retrieves measurement history with pagination and filtering.
 *
 * Features:
 * - Pagination support (page, pageSize)
 * - Date range filtering (fromDate, toDate)
 * - Total count and hasMore indicator for infinite scroll support
 *
 * @module application/use-cases/ViewHistoryUseCase
 */

import type {
  MeasurementRepository,
  MeasurementResult,
  MeasurementQuery,
} from '../ports/MeasurementRepository';

/**
 * Input for viewing measurement history
 */
export interface ViewHistoryInput {
  /** The profile ID to retrieve history for */
  profileId: string;
  /** Page number (1-based, defaults to 1) */
  page?: number;
  /** Number of items per page (defaults to 20) */
  pageSize?: number;
  /** Filter measurements from this date (inclusive) */
  fromDate?: Date;
  /** Filter measurements until this date (inclusive) */
  toDate?: Date;
}

/**
 * Output from viewing measurement history
 */
export interface ViewHistoryOutput {
  /** Array of measurement results (sorted by timestamp descending) */
  measurements: MeasurementResult[];
  /** Total number of measurements matching the filter */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Whether there are more pages available */
  hasMore: boolean;
}

/**
 * Use case for viewing measurement history
 *
 * This is a CQRS query that provides paginated access to measurement history
 * with optional date filtering. Results are always sorted by timestamp
 * descending (newest first).
 */
export class ViewHistoryUseCase {
  constructor(private readonly measurementRepository: MeasurementRepository) {}

  /**
   * Execute the use case
   *
   * @param input - The input containing profile ID and optional pagination/filter params
   * @returns Paginated measurement history with metadata
   */
  async execute(input: ViewHistoryInput): Promise<ViewHistoryOutput> {
    // Apply defaults for pagination
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;

    // Validate pagination parameters
    if (page < 1) {
      throw new Error('Page number must be at least 1');
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new Error('Page size must be between 1 and 100');
    }

    // Calculate offset for repository query
    const offset = (page - 1) * pageSize;

    // Build query parameters
    const query: MeasurementQuery = {
      userProfileId: input.profileId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      limit: pageSize,
      offset,
    };

    const countQuery: MeasurementQuery = {
      userProfileId: input.profileId,
      fromDate: input.fromDate,
      toDate: input.toDate,
    };

    // Fetch measurements and total count in parallel
    const [measurements, total] = await Promise.all([
      this.measurementRepository.getAll(query),
      this.measurementRepository.count(countQuery),
    ]);

    // Calculate if there are more pages
    const hasMore = offset + measurements.length < total;

    return {
      measurements,
      total,
      page,
      pageSize,
      hasMore,
    };
  }
}
