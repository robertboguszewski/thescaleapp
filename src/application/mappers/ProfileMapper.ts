/**
 * ProfileMapper
 *
 * Maps between domain StoredUserProfile and IPC-safe DTOs.
 * Handles serialization of Date objects to ISO strings for IPC transmission.
 *
 * @module application/mappers/ProfileMapper
 */

import type { StoredUserProfile } from '../ports/ProfileRepository';

/**
 * DTO for StoredUserProfile - safe for IPC transmission.
 * Date fields are serialized as ISO strings.
 */
export interface StoredUserProfileDTO {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birthYear: number;
  birthMonth?: number;
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
  isDefault: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

/**
 * Mapper for converting between domain StoredUserProfile and DTOs.
 */
export class ProfileMapper {
  /**
   * Convert domain StoredUserProfile to IPC-safe DTO.
   *
   * @param profile - Domain profile object
   * @returns DTO with serialized dates
   */
  static toDTO(profile: StoredUserProfile): StoredUserProfileDTO {
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
   * Convert DTO back to domain StoredUserProfile.
   *
   * @param dto - DTO from IPC
   * @returns Domain profile object with Date instances
   */
  static toDomain(dto: StoredUserProfileDTO): StoredUserProfile {
    return {
      id: dto.id,
      name: dto.name,
      gender: dto.gender,
      birthYear: dto.birthYear,
      birthMonth: dto.birthMonth,
      heightCm: dto.heightCm,
      ethnicity: dto.ethnicity,
      isDefault: dto.isDefault,
      createdAt: new Date(dto.createdAt),
      updatedAt: new Date(dto.updatedAt),
    };
  }

  /**
   * Convert array of domain profiles to DTOs.
   *
   * @param profiles - Array of domain profiles
   * @returns Array of DTOs
   */
  static toDTOList(profiles: StoredUserProfile[]): StoredUserProfileDTO[] {
    return profiles.map((p) => ProfileMapper.toDTO(p));
  }

  /**
   * Convert array of DTOs to domain profiles.
   *
   * @param dtos - Array of DTOs
   * @returns Array of domain profiles
   */
  static toDomainList(dtos: StoredUserProfileDTO[]): StoredUserProfile[] {
    return dtos.map((dto) => ProfileMapper.toDomain(dto));
  }
}
