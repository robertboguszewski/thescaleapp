/**
 * Body Fat Calculation Module
 *
 * Exports all body fat percentage calculation functions and utilities.
 *
 * @module domain/calculations/body-fat
 */

export {
  calculateBodyFatDeurenberg1991,
  calculateBodyFatDeurenberg1992,
  getDeurenbergFormulaInfo,
} from './deurenberg';

export {
  calculateBodyFatGallagher,
  getGallagherFormulaInfo,
  getEthnicityAdjustmentExplanation,
} from './gallagher';
