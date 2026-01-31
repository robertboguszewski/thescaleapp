/**
 * JsonMeasurementRepository
 *
 * File-based JSON implementation of MeasurementRepository.
 * Stores each measurement as a separate JSON file.
 *
 * File naming convention: {timestamp}_{id}.json
 * This allows for efficient sorting by filename.
 *
 * @module infrastructure/storage/JsonMeasurementRepository
 */

import * as path from 'path';
import type {
  MeasurementRepository,
  MeasurementResult,
  MeasurementQuery,
} from '../../application/ports/MeasurementRepository';
import {
  ensureDir,
  readJSON,
  atomicWriteJSON,
  deleteFile,
  listFiles,
} from './file-utils';
import {
  StoredMeasurementSchema,
  toStoredMeasurement,
  fromStoredMeasurement,
  type StoredMeasurement,
} from './schemas';

/**
 * Format a date for use in filename (ISO format with dashes instead of colons)
 */
function formatTimestampForFilename(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}

/**
 * Extract ID from filename
 */
function extractIdFromFilename(filename: string): string {
  // Filename format: {timestamp}_{id}.json
  const match = filename.match(/_([^_]+)\.json$/);
  return match ? match[1] : '';
}

/**
 * JSON file-based implementation of MeasurementRepository
 */
export class JsonMeasurementRepository implements MeasurementRepository {
  private readonly dataDir: string;

  /**
   * @param dataDir - Directory path where measurement files will be stored
   */
  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /**
   * Generate the file path for a measurement
   */
  private getFilePath(measurement: MeasurementResult): string {
    const timestamp = formatTimestampForFilename(measurement.timestamp);
    const filename = `${timestamp}_${measurement.id}.json`;
    return path.join(this.dataDir, filename);
  }

  /**
   * Find the file path for a measurement by ID
   * Returns null if not found
   */
  private async findFilePathById(id: string): Promise<string | null> {
    const files = await listFiles(this.dataDir, /\.json$/);

    for (const filePath of files) {
      const filename = path.basename(filePath);
      if (extractIdFromFilename(filename) === id) {
        return filePath;
      }
    }

    return null;
  }

  async save(measurement: MeasurementResult): Promise<void> {
    // Validate the measurement data
    const storedData = toStoredMeasurement(measurement);
    const validation = StoredMeasurementSchema.safeParse(storedData);

    if (!validation.success) {
      throw new Error(`Invalid measurement data: ${validation.error.message}`);
    }

    // Ensure directory exists
    await ensureDir(this.dataDir);

    // Check if measurement with this ID already exists (for update)
    const existingPath = await this.findFilePathById(measurement.id);
    if (existingPath) {
      // Delete old file (timestamp might have changed)
      await deleteFile(existingPath);
    }

    // Write the measurement to file
    const filePath = this.getFilePath(measurement);
    await atomicWriteJSON(filePath, storedData);
  }

  async getById(id: string): Promise<MeasurementResult | null> {
    const filePath = await this.findFilePathById(id);

    if (!filePath) {
      return null;
    }

    try {
      const storedData = await readJSON<StoredMeasurement>(filePath);

      // Validate the loaded data
      const validation = StoredMeasurementSchema.safeParse(storedData);
      if (!validation.success) {
        // Invalid data - treat as not found
        console.warn(`Invalid measurement data in file ${filePath}: ${validation.error.message}`);
        return null;
      }

      return fromStoredMeasurement(validation.data);
    } catch (error) {
      // File read error - treat as not found
      return null;
    }
  }

  async getAll(query?: MeasurementQuery): Promise<MeasurementResult[]> {
    const files = await listFiles(this.dataDir, /\.json$/);

    // Load all measurements
    const measurements: MeasurementResult[] = [];

    for (const filePath of files) {
      try {
        const storedData = await readJSON<StoredMeasurement>(filePath);

        // Validate the loaded data
        const validation = StoredMeasurementSchema.safeParse(storedData);
        if (!validation.success) {
          console.warn(`Skipping invalid measurement in file ${filePath}`);
          continue;
        }

        const measurement = fromStoredMeasurement(validation.data);

        // Apply filters
        if (query?.userProfileId && measurement.userProfileId !== query.userProfileId) {
          continue;
        }

        if (query?.fromDate && measurement.timestamp < query.fromDate) {
          continue;
        }

        if (query?.toDate && measurement.timestamp > query.toDate) {
          continue;
        }

        measurements.push(measurement);
      } catch (error) {
        console.warn(`Error reading measurement file ${filePath}:`, error);
        continue;
      }
    }

    // Sort by timestamp descending (newest first)
    measurements.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    let result = measurements;

    if (query?.offset !== undefined) {
      result = result.slice(query.offset);
    }

    if (query?.limit !== undefined) {
      result = result.slice(0, query.limit);
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    const filePath = await this.findFilePathById(id);

    if (filePath) {
      await deleteFile(filePath);
    }
  }

  async deleteAll(userProfileId: string): Promise<void> {
    const measurements = await this.getAll({ userProfileId });

    for (const measurement of measurements) {
      await this.delete(measurement.id);
    }
  }

  async count(query?: MeasurementQuery): Promise<number> {
    // For count, we don't need pagination
    const { limit: _, offset: __, ...filterQuery } = query ?? {};
    const measurements = await this.getAll(filterQuery);
    return measurements.length;
  }

  async updateProfileAssignment(measurementId: string, newProfileId: string): Promise<void> {
    const measurement = await this.getById(measurementId);

    if (!measurement) {
      throw new Error(`Measurement not found: ${measurementId}`);
    }

    // Create updated measurement with new profile ID
    const updatedMeasurement: MeasurementResult = {
      ...measurement,
      userProfileId: newProfileId,
    };

    // Save will update the existing file
    await this.save(updatedMeasurement);
  }
}
