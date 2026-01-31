/**
 * ProfileService Unit Tests
 *
 * Comprehensive tests for the ProfileService application service.
 * Uses vitest for testing with mocked dependencies following TDD approach.
 *
 * @module application/services/__tests__/ProfileService.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProfileService,
  ValidationError,
  ProfileNotFoundError,
  type CreateProfileInput,
  type UpdateProfileInput,
} from '../ProfileService';
import type {
  ProfileRepository,
  StoredUserProfile,
} from '../../ports/ProfileRepository';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'generated-uuid-12345'),
});

describe('ProfileService', () => {
  // Mock dependencies
  let mockProfileRepository: ProfileRepository;
  let service: ProfileService;

  // Current year for birth year calculations
  const currentYear = new Date().getFullYear();
  const validBirthYear = 1990; // ~34 years old

  // Test data fixtures
  const existingProfile: StoredUserProfile = {
    id: 'profile-existing',
    name: 'Existing User',
    gender: 'male',
    birthYear: 1989,
    heightCm: 178,
    ethnicity: 'non-asian',
    isDefault: true,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  };

  const secondProfile: StoredUserProfile = {
    id: 'profile-second',
    name: 'Second User',
    gender: 'female',
    birthYear: 1996,
    heightCm: 165,
    ethnicity: 'asian',
    isDefault: false,
    createdAt: new Date('2024-01-02T10:00:00Z'),
    updatedAt: new Date('2024-01-02T10:00:00Z'),
  };

  const validCreateInput: CreateProfileInput = {
    name: 'New User',
    gender: 'male',
    birthYear: validBirthYear,
    heightCm: 175,
    ethnicity: 'non-asian',
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock ProfileRepository
    mockProfileRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn().mockResolvedValue(existingProfile),
      getAll: vi.fn().mockResolvedValue([existingProfile]),
      delete: vi.fn().mockResolvedValue(undefined),
      getDefault: vi.fn().mockResolvedValue(existingProfile),
      setDefault: vi.fn().mockResolvedValue(undefined),
    };

    // Create service instance with mocked dependency
    service = new ProfileService(mockProfileRepository);
  });

  describe('createProfile', () => {
    describe('success scenarios', () => {
      it('should create profile with generated UUID and timestamps', async () => {
        // Arrange
        const beforeTime = new Date();

        // Act
        const result = await service.createProfile(validCreateInput);

        // Assert
        const afterTime = new Date();

        expect(result.id).toBe('generated-uuid-12345');
        expect(result.name).toBe('New User');
        expect(result.gender).toBe('male');
        expect(result.birthYear).toBe(validBirthYear);
        expect(result.heightCm).toBe(175);
        expect(result.ethnicity).toBe('non-asian');

        expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
        expect(result.createdAt.getTime()).toBeLessThanOrEqual(
          afterTime.getTime()
        );
        expect(result.updatedAt.getTime()).toBe(result.createdAt.getTime());
      });

      it('should set isDefault=true for first profile', async () => {
        // Arrange
        mockProfileRepository.getAll = vi.fn().mockResolvedValue([]);

        // Act
        const result = await service.createProfile(validCreateInput);

        // Assert
        expect(result.isDefault).toBe(true);
      });

      it('should set isDefault=false when other profiles exist', async () => {
        // Arrange
        mockProfileRepository.getAll = vi
          .fn()
          .mockResolvedValue([existingProfile]);

        // Act
        const result = await service.createProfile(validCreateInput);

        // Assert
        expect(result.isDefault).toBe(false);
      });

      it('should save profile to repository', async () => {
        // Act
        const result = await service.createProfile(validCreateInput);

        // Assert
        expect(mockProfileRepository.save).toHaveBeenCalledWith(result);
        expect(mockProfileRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should trim whitespace from name', async () => {
        // Arrange
        const inputWithWhitespace = {
          ...validCreateInput,
          name: '  Spaced Name  ',
        };

        // Act
        const result = await service.createProfile(inputWithWhitespace);

        // Assert
        expect(result.name).toBe('Spaced Name');
      });

      it('should create profile without ethnicity (optional field)', async () => {
        // Arrange
        const inputWithoutEthnicity: CreateProfileInput = {
          name: 'No Ethnicity User',
          gender: 'female',
          birthYear: 1999,
          heightCm: 160,
        };

        // Act
        const result = await service.createProfile(inputWithoutEthnicity);

        // Assert
        expect(result.ethnicity).toBeUndefined();
      });

      it('should create female profile correctly', async () => {
        // Arrange
        const femaleInput: CreateProfileInput = {
          name: 'Female User',
          gender: 'female',
          birthYear: 1996,
          heightCm: 165,
          ethnicity: 'asian',
        };

        // Act
        const result = await service.createProfile(femaleInput);

        // Assert
        expect(result.gender).toBe('female');
        expect(result.ethnicity).toBe('asian');
      });
    });

    describe('validation errors', () => {
      it('should throw ValidationError for empty name', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, name: '' };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          'Name is required and cannot be empty'
        );
      });

      it('should throw ValidationError for whitespace-only name', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, name: '   ' };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
      });

      it('should throw ValidationError for birthYear < 1900', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, birthYear: 1899 };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          'Birth year must be between 1900'
        );
      });

      it('should throw ValidationError for birthYear too recent (less than 5 years ago)', async () => {
        // Arrange - birthYear must be at least currentYear - 5
        const invalidInput = { ...validCreateInput, birthYear: currentYear - 4 };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
      });

      it('should throw ValidationError for height < 50', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, heightCm: 49 };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          'Height must be between 50 and 250 cm'
        );
      });

      it('should throw ValidationError for height > 250', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, heightCm: 251 };

        // Act & Assert
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          ValidationError
        );
        await expect(service.createProfile(invalidInput)).rejects.toThrow(
          'Height must be between 50 and 250 cm'
        );
      });

      it('should accept minimum valid birthYear (1900)', async () => {
        // Arrange
        const validInput = { ...validCreateInput, birthYear: 1900 };

        // Act
        const result = await service.createProfile(validInput);

        // Assert
        expect(result.birthYear).toBe(1900);
      });

      it('should accept maximum valid birthYear (currentYear - 5)', async () => {
        // Arrange
        const maxBirthYear = currentYear - 5;
        const validInput = { ...validCreateInput, birthYear: maxBirthYear };

        // Act
        const result = await service.createProfile(validInput);

        // Assert
        expect(result.birthYear).toBe(maxBirthYear);
      });

      it('should accept minimum valid height (50)', async () => {
        // Arrange
        const validInput = { ...validCreateInput, heightCm: 50 };

        // Act
        const result = await service.createProfile(validInput);

        // Assert
        expect(result.heightCm).toBe(50);
      });

      it('should accept maximum valid height (250)', async () => {
        // Arrange
        const validInput = { ...validCreateInput, heightCm: 250 };

        // Act
        const result = await service.createProfile(validInput);

        // Assert
        expect(result.heightCm).toBe(250);
      });

      it('should include field name in ValidationError', async () => {
        // Arrange
        const invalidInput = { ...validCreateInput, birthYear: 1899 };

        // Act & Assert
        try {
          await service.createProfile(invalidInput);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).field).toBe('birthYear');
        }
      });
    });
  });

  describe('updateProfile', () => {
    describe('success scenarios', () => {
      it('should update profile with partial data', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = {
          name: 'Updated Name',
        };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.name).toBe('Updated Name');
        expect(result.gender).toBe('male'); // unchanged
        expect(result.birthYear).toBe(1989); // unchanged
        expect(result.heightCm).toBe(178); // unchanged
      });

      it('should update only birthYear when provided', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { birthYear: 1985 };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.birthYear).toBe(1985);
        expect(result.name).toBe('Existing User'); // unchanged
      });

      it('should update only height when provided', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { heightCm: 180 };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.heightCm).toBe(180);
      });

      it('should update only gender when provided', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { gender: 'female' };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.gender).toBe('female');
      });

      it('should update only ethnicity when provided', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { ethnicity: 'asian' };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.ethnicity).toBe('asian');
      });

      it('should update multiple fields at once', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = {
          name: 'New Name',
          birthYear: 1988,
          heightCm: 179,
        };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.name).toBe('New Name');
        expect(result.birthYear).toBe(1988);
        expect(result.heightCm).toBe(179);
      });

      it('should update updatedAt timestamp', async () => {
        // Arrange
        const beforeTime = new Date();
        const updateInput: UpdateProfileInput = { name: 'Updated' };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        const afterTime = new Date();
        expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
        expect(result.updatedAt.getTime()).toBeLessThanOrEqual(
          afterTime.getTime()
        );
      });

      it('should preserve createdAt timestamp', async () => {
        // Act
        const result = await service.updateProfile('profile-existing', {
          name: 'Updated',
        });

        // Assert
        expect(result.createdAt.getTime()).toBe(
          existingProfile.createdAt.getTime()
        );
      });

      it('should preserve isDefault status', async () => {
        // Act
        const result = await service.updateProfile('profile-existing', {
          name: 'Updated',
        });

        // Assert
        expect(result.isDefault).toBe(true);
      });

      it('should trim whitespace from updated name', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { name: '  Spaced  ' };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(result.name).toBe('Spaced');
      });

      it('should save updated profile to repository', async () => {
        // Arrange
        const updateInput: UpdateProfileInput = { name: 'Updated' };

        // Act
        const result = await service.updateProfile(
          'profile-existing',
          updateInput
        );

        // Assert
        expect(mockProfileRepository.save).toHaveBeenCalledWith(result);
      });
    });

    describe('error scenarios', () => {
      it('should throw ProfileNotFoundError for non-existent profile', async () => {
        // Arrange
        mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

        // Act & Assert
        await expect(
          service.updateProfile('non-existent', { name: 'New Name' })
        ).rejects.toThrow(ProfileNotFoundError);

        await expect(
          service.updateProfile('non-existent', { name: 'New Name' })
        ).rejects.toThrow('Profile not found: non-existent');
      });

      it('should throw ValidationError for invalid birthYear in update', async () => {
        // Arrange
        const invalidUpdate: UpdateProfileInput = { birthYear: 1899 };

        // Act & Assert
        await expect(
          service.updateProfile('profile-existing', invalidUpdate)
        ).rejects.toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid height in update', async () => {
        // Arrange
        const invalidUpdate: UpdateProfileInput = { heightCm: 300 };

        // Act & Assert
        await expect(
          service.updateProfile('profile-existing', invalidUpdate)
        ).rejects.toThrow(ValidationError);
      });

      it('should not update profile when validation fails', async () => {
        // Arrange
        const invalidUpdate: UpdateProfileInput = { birthYear: 1800 };

        // Act & Assert
        try {
          await service.updateProfile('profile-existing', invalidUpdate);
        } catch {
          // Expected
        }
        expect(mockProfileRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('getProfile', () => {
    it('should return profile by ID', async () => {
      // Act
      const result = await service.getProfile('profile-existing');

      // Assert
      expect(mockProfileRepository.getById).toHaveBeenCalledWith(
        'profile-existing'
      );
      expect(result).toEqual(existingProfile);
    });

    it('should return null for non-existent profile', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act
      const result = await service.getProfile('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getAllProfiles', () => {
    it('should return all profiles', async () => {
      // Arrange
      mockProfileRepository.getAll = vi
        .fn()
        .mockResolvedValue([existingProfile, secondProfile]);

      // Act
      const results = await service.getAllProfiles();

      // Assert
      expect(mockProfileRepository.getAll).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(existingProfile);
      expect(results[1]).toEqual(secondProfile);
    });

    it('should return empty array when no profiles exist', async () => {
      // Arrange
      mockProfileRepository.getAll = vi.fn().mockResolvedValue([]);

      // Act
      const results = await service.getAllProfiles();

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('deleteProfile', () => {
    it('should call repository delete with correct ID', async () => {
      // Act
      await service.deleteProfile('profile-existing');

      // Assert
      expect(mockProfileRepository.delete).toHaveBeenCalledWith(
        'profile-existing'
      );
    });

    it('should verify profile exists before deleting', async () => {
      // Act
      await service.deleteProfile('profile-existing');

      // Assert
      expect(mockProfileRepository.getById).toHaveBeenCalledWith(
        'profile-existing'
      );
    });

    it('should throw ProfileNotFoundError when profile does not exist', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteProfile('non-existent')).rejects.toThrow(
        ProfileNotFoundError
      );
    });

    it('should not call delete when profile not found', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      try {
        await service.deleteProfile('non-existent');
      } catch {
        // Expected
      }
      expect(mockProfileRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDefaultProfile', () => {
    it('should return default profile from repository', async () => {
      // Act
      const result = await service.getDefaultProfile();

      // Assert
      expect(mockProfileRepository.getDefault).toHaveBeenCalled();
      expect(result).toEqual(existingProfile);
    });

    it('should return null when no default profile set', async () => {
      // Arrange
      mockProfileRepository.getDefault = vi.fn().mockResolvedValue(null);

      // Act
      const result = await service.getDefaultProfile();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setDefaultProfile', () => {
    it('should call repository setDefault with correct ID', async () => {
      // Act
      await service.setDefaultProfile('profile-existing');

      // Assert
      expect(mockProfileRepository.setDefault).toHaveBeenCalledWith(
        'profile-existing'
      );
    });

    it('should verify profile exists before setting as default', async () => {
      // Act
      await service.setDefaultProfile('profile-existing');

      // Assert
      expect(mockProfileRepository.getById).toHaveBeenCalledWith(
        'profile-existing'
      );
    });

    it('should throw ProfileNotFoundError when profile does not exist', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.setDefaultProfile('non-existent')).rejects.toThrow(
        ProfileNotFoundError
      );
    });

    it('should not call setDefault when profile not found', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      try {
        await service.setDefaultProfile('non-existent');
      } catch {
        // Expected
      }
      expect(mockProfileRepository.setDefault).not.toHaveBeenCalled();
    });
  });

  describe('getProfileAge', () => {
    it('should calculate age from birthYear', async () => {
      // Arrange - existingProfile has birthYear 1989
      const expectedAge = currentYear - 1989;

      // Act
      const age = await service.getProfileAge('profile-existing');

      // Assert
      expect(age).toBe(expectedAge);
    });

    it('should return null for non-existent profile', async () => {
      // Arrange
      mockProfileRepository.getById = vi.fn().mockResolvedValue(null);

      // Act
      const age = await service.getProfileAge('non-existent');

      // Assert
      expect(age).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent profile creation', async () => {
      // Arrange
      let getAllCallCount = 0;
      mockProfileRepository.getAll = vi.fn().mockImplementation(() => {
        getAllCallCount++;
        // First call returns empty, simulating race condition
        return Promise.resolve(getAllCallCount === 1 ? [] : [existingProfile]);
      });

      // Act
      const [profile1, profile2] = await Promise.all([
        service.createProfile({ ...validCreateInput, name: 'User 1' }),
        service.createProfile({ ...validCreateInput, name: 'User 2' }),
      ]);

      // Assert - both operations should complete
      expect(profile1.name).toBe('User 1');
      expect(profile2.name).toBe('User 2');
    });

    it('should propagate repository save errors', async () => {
      // Arrange
      mockProfileRepository.save = vi
        .fn()
        .mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createProfile(validCreateInput)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
