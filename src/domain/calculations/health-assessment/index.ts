/**
 * Health Assessment Module
 *
 * @module domain/calculations/health-assessment
 */

export { calculateBodyScore, type BodyScoreInput } from './scoring';
export {
  generateRecommendations,
  getPriorityRecommendations,
  type HealthRecommendation
} from './recommendations';
