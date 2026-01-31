/**
 * Lean Body Mass Calculations
 *
 * @module domain/calculations/lean-body-mass
 *
 * Exports LBM calculation formulas:
 * - Boer (1984) - Estimates LBM from height and weight
 * - Direct calculation from body fat percentage
 */

export { calculateLBM_Boer, calculateLBM_FromBodyFat } from './boer';
