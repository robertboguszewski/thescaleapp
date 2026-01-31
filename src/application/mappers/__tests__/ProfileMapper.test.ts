/**
 * ProfileMapper Tests
 *
 * TDD tests for mapping between domain StoredUserProfile and IPC DTOs.
 * Tests written BEFORE implementation.
 *
 * @module application/mappers/__tests__/ProfileMapper.test
 */

import { describe, it, expect } from 'vitest';
import { ProfileMapper } from '../ProfileMapper';
import type { StoredUserProfile } from '../../ports/ProfileRepository';

describe('ProfileMapper', () => {
  const createMockProfile = (overrides?: Partial<StoredUserProfile>): StoredUserProfile => ({
    id: 'profile-123',
    name: 'John Doe',
    gender: 'male',
    birthYear: 1990,
    birthMonth: 6,
    heightCm: 180,
    ethnicity: 'non-asian',
    isDefault: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  });

  describe('toDTO', () => {
    it('should convert StoredUserProfile to DTO', () => {
      const profile = createMockProfile();

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.id).toBe('profile-123');
      expect(dto.name).toBe('John Doe');
      expect(dto.gender).toBe('male');
    });

    it('should serialize createdAt to ISO string', () => {
      const profile = createMockProfile({
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(typeof dto.createdAt).toBe('string');
    });

    it('should serialize updatedAt to ISO string', () => {
      const profile = createMockProfile({
        updatedAt: new Date('2026-01-15T10:00:00Z'),
      });

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.updatedAt).toBe('2026-01-15T10:00:00.000Z');
    });

    it('should preserve all profile data', () => {
      const profile = createMockProfile();

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.birthYear).toBe(1990);
      expect(dto.birthMonth).toBe(6);
      expect(dto.heightCm).toBe(180);
      expect(dto.ethnicity).toBe('non-asian');
      expect(dto.isDefault).toBe(true);
    });

    it('should handle optional ethnicity', () => {
      const profile = createMockProfile({ ethnicity: undefined });

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.ethnicity).toBeUndefined();
    });

    it('should handle optional birthMonth', () => {
      const profile = createMockProfile({ birthMonth: undefined });

      const dto = ProfileMapper.toDTO(profile);

      expect(dto.birthMonth).toBeUndefined();
    });
  });

  describe('toDomain', () => {
    it('should convert DTO back to domain object', () => {
      const dto = {
        id: 'profile-123',
        name: 'John Doe',
        gender: 'male' as const,
        birthYear: 1990,
        heightCm: 180,
        isDefault: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const domain = ProfileMapper.toDomain(dto);

      expect(domain.id).toBe('profile-123');
      expect(domain.name).toBe('John Doe');
    });

    it('should parse createdAt ISO string to Date', () => {
      const dto = {
        id: 'profile-123',
        name: 'John Doe',
        gender: 'male' as const,
        birthYear: 1990,
        heightCm: 180,
        isDefault: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const domain = ProfileMapper.toDomain(dto);

      expect(domain.createdAt).toBeInstanceOf(Date);
      expect(domain.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should parse updatedAt ISO string to Date', () => {
      const dto = {
        id: 'profile-123',
        name: 'John Doe',
        gender: 'male' as const,
        birthYear: 1990,
        heightCm: 180,
        isDefault: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      const domain = ProfileMapper.toDomain(dto);

      expect(domain.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('toDTOList', () => {
    it('should convert array of profiles to DTOs', () => {
      const profiles = [
        createMockProfile({ id: 'profile-1', name: 'User 1' }),
        createMockProfile({ id: 'profile-2', name: 'User 2' }),
      ];

      const dtos = ProfileMapper.toDTOList(profiles);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe('profile-1');
      expect(dtos[1].id).toBe('profile-2');
    });

    it('should handle empty array', () => {
      const dtos = ProfileMapper.toDTOList([]);

      expect(dtos).toEqual([]);
    });
  });

  describe('roundtrip', () => {
    it('should preserve data after toDTO -> toDomain', () => {
      const original = createMockProfile();

      const dto = ProfileMapper.toDTO(original);
      const restored = ProfileMapper.toDomain(dto);

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.gender).toBe(original.gender);
      expect(restored.birthYear).toBe(original.birthYear);
      expect(restored.heightCm).toBe(original.heightCm);
      expect(restored.isDefault).toBe(original.isDefault);
      expect(restored.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(restored.updatedAt.getTime()).toBe(original.updatedAt.getTime());
    });
  });
});
