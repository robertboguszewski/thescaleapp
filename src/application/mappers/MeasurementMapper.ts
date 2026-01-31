/**
 * MeasurementMapper
 *
 * Maps between domain MeasurementResult and IPC-safe DTOs.
 * Handles serialization of Date objects to ISO strings for IPC transmission.
 *
 * @module application/mappers/MeasurementMapper
 */

import type { MeasurementResult } from '../ports/MeasurementRepository';
import type { RawMeasurement, CalculatedMetrics } from '../../domain/calculations/types';

/**
 * DTO for MeasurementResult - safe for IPC transmission.
 * Date fields are serialized as ISO strings.
 */
export interface MeasurementResultDTO {
  id: string;
  timestamp: string; // ISO 8601 string
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  userProfileId: string;
}

/**
 * Mapper for converting between domain MeasurementResult and DTOs.
 */
export class MeasurementMapper {
  /**
   * Convert domain MeasurementResult to IPC-safe DTO.
   *
   * @param measurement - Domain measurement object
   * @returns DTO with serialized dates
   */
  static toDTO(measurement: MeasurementResult): MeasurementResultDTO {
    return {
      id: measurement.id,
      timestamp: measurement.timestamp.toISOString(),
      raw: { ...measurement.raw },
      calculated: { ...measurement.calculated },
      userProfileId: measurement.userProfileId,
    };
  }

  /**
   * Convert DTO back to domain MeasurementResult.
   *
   * @param dto - DTO from IPC
   * @returns Domain measurement object with Date instances
   */
  static toDomain(dto: MeasurementResultDTO): MeasurementResult {
    return {
      id: dto.id,
      timestamp: new Date(dto.timestamp),
      raw: { ...dto.raw },
      calculated: { ...dto.calculated },
      userProfileId: dto.userProfileId,
    };
  }

  /**
   * Convert array of domain measurements to DTOs.
   *
   * @param measurements - Array of domain measurements
   * @returns Array of DTOs
   */
  static toDTOList(measurements: MeasurementResult[]): MeasurementResultDTO[] {
    return measurements.map((m) => MeasurementMapper.toDTO(m));
  }

  /**
   * Convert array of DTOs to domain measurements.
   *
   * @param dtos - Array of DTOs
   * @returns Array of domain measurements
   */
  static toDomainList(dtos: MeasurementResultDTO[]): MeasurementResult[] {
    return dtos.map((dto) => MeasurementMapper.toDomain(dto));
  }
}
