/**
 * BMR (Basal Metabolic Rate) Calculations
 *
 * @module domain/calculations/bmr
 *
 * Exports all BMR calculation formulas:
 * - Mifflin-St Jeor (1990) - Most accurate for general population
 * - Harris-Benedict (1918/1984) - Classic formula, widely used
 * - Katch-McArdle (1973) - Best for athletes/non-typical body composition
 */

export { calculateBMR_MifflinStJeor } from './mifflin-st-jeor';
export { calculateBMR_HarrisBenedict } from './harris-benedict';
export { calculateBMR_KatchMcArdle } from './katch-mcardle';
