/**
 * Age Calculator
 * Pure functions for calculating age from birth year and optional birth month
 *
 * @module domain/calculations/age-calculator
 */

/**
 * Calculate age from birth year and optional birth month
 *
 * If birthMonth is provided, calculates precise age based on whether
 * the birthday has occurred this year. If not provided, falls back
 * to simple year subtraction (may be off by up to 1 year).
 *
 * @pure
 * @param birthYear - The year of birth (e.g., 1990)
 * @param birthMonth - Optional month of birth (1-12, where 1=January)
 * @returns The calculated age in years
 * @throws Error if birthYear or birthMonth is invalid
 *
 * @example
 * // Without month (year-only, may be ±1 year off)
 * calculateAge(1990) // Returns 36 if current year is 2026
 *
 * @example
 * // With month (precise calculation)
 * calculateAge(1990, 3) // Returns 35 if current date is Jan 2026 (birthday in March not yet)
 * calculateAge(1990, 3) // Returns 36 if current date is April 2026 (birthday passed)
 */
export function calculateAge(birthYear: number, birthMonth?: number): number {
  if (!isValidBirthYear(birthYear)) {
    throw new Error('Invalid birth year');
  }

  if (birthMonth !== undefined && !isValidBirthMonth(birthMonth)) {
    throw new Error('Invalid birth month');
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;

  // If birth month is provided, check if birthday has occurred this year
  if (birthMonth !== undefined) {
    const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11

    // If current month is before birth month, birthday hasn't occurred yet
    if (currentMonth < birthMonth) {
      age--;
    }
    // Note: If same month, we assume birthday has passed (simplest approach)
  }

  return age;
}

/**
 * Validate birth year
 * Valid range: 1900 to (current year - 5) for minimum age of 5
 *
 * @param year - The year to validate
 * @returns true if the birth year is valid, false otherwise
 */
export function isValidBirthYear(year: number): boolean {
  if (!Number.isInteger(year)) {
    return false;
  }
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear - 5; // Min age 5
}

/**
 * Validate birth month
 * Valid range: 1-12 (where 1=January, 12=December)
 * Undefined is also valid (month is optional)
 *
 * @param month - The month to validate (1-12) or undefined
 * @returns true if the birth month is valid or undefined, false otherwise
 */
export function isValidBirthMonth(month: number | undefined): boolean {
  // Undefined is valid (month is optional)
  if (month === undefined) {
    return true;
  }

  // Must be an integer
  if (!Number.isInteger(month)) {
    return false;
  }

  // Must be 1-12
  return month >= 1 && month <= 12;
}

/**
 * Get the valid birth year range
 * Useful for UI validation and form constraints
 *
 * @returns Object with min and max valid birth years
 */
export function getValidBirthYearRange(): { min: number; max: number } {
  const currentYear = new Date().getFullYear();
  return {
    min: 1900,
    max: currentYear - 5,
  };
}
