/**
 * ProfileRepository Port
 *
 * Defines the interface for user profile persistence operations.
 * This is a port in the Hexagonal Architecture - implementations
 * are provided in the infrastructure layer.
 */

/**
 * Special ID constant for guest profile (unassigned measurements)
 */
export const GUEST_PROFILE_ID = '__guest__';

/**
 * Extended user profile with persistence metadata
 *
 * Note: Uses birthYear (and optional birthMonth) for accurate age calculation over time
 */
export interface StoredUserProfile {
  /** Unique identifier */
  id: string;
  /** Display name for the profile */
  name: string;
  /** Biological gender - affects formula coefficients */
  gender: 'male' | 'female';
  /** Birth year for age calculation */
  birthYear: number;
  /** Birth month for more accurate age calculation (1-12, optional) */
  birthMonth?: number;
  /** Height in centimeters */
  heightCm: number;
  /** Ethnicity - affects some formulas */
  ethnicity?: 'asian' | 'non-asian';
  /** Whether this is the default profile */
  isDefault: boolean;
  /** Profile creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Calculate current age from birth year and optional birth month
 *
 * If birthMonth is provided, calculates precise age based on whether
 * the birthday has occurred this year. If not provided, falls back
 * to simple year subtraction (may be off by up to 1 year).
 *
 * @param birthYear - The year of birth
 * @param birthMonth - Optional month of birth (1-12, where 1=January)
 * @returns Current age in years
 */
export function calculateAgeFromBirthYear(
  birthYear: number,
  birthMonth?: number
): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;

  // If birth month is provided, check if birthday has occurred this year
  if (birthMonth !== undefined && birthMonth >= 1 && birthMonth <= 12) {
    const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11

    // If current month is before birth month, birthday hasn't occurred yet
    if (currentMonth < birthMonth) {
      age--;
    }
  }

  return age;
}

/**
 * Repository interface for user profile persistence
 *
 * Implementations:
 * - JsonProfileRepository (file-based JSON storage)
 * - InMemoryProfileRepository (for testing)
 */
export interface ProfileRepository {
  /**
   * Save a user profile
   * If profile with same ID exists, it will be overwritten
   * Updates the `updatedAt` timestamp automatically
   */
  save(profile: StoredUserProfile): Promise<void>;

  /**
   * Retrieve a profile by its ID
   * @returns The profile or null if not found
   */
  getById(id: string): Promise<StoredUserProfile | null>;

  /**
   * Retrieve all profiles
   * Results are sorted by name ascending
   */
  getAll(): Promise<StoredUserProfile[]>;

  /**
   * Delete a profile by its ID
   * No error if profile doesn't exist
   * Note: Consider deleting associated measurements first
   */
  delete(id: string): Promise<void>;

  /**
   * Get the default profile
   * @returns The default profile or null if none set
   */
  getDefault(): Promise<StoredUserProfile | null>;

  /**
   * Set a profile as the default
   * Removes default status from any other profile
   */
  setDefault(id: string): Promise<void>;
}
