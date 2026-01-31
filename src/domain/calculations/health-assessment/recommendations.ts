/**
 * Health Recommendations Engine
 *
 * Generates evidence-based health recommendations based on body composition metrics.
 *
 * @module domain/calculations/health-assessment/recommendations
 */

import type { CalculatedMetrics, UserProfile } from '../types';

/**
 * Health recommendation structure
 */
export interface HealthRecommendation {
  type: 'info' | 'warning' | 'critical';
  category: 'body_fat' | 'muscle' | 'visceral' | 'bmi' | 'hydration' | 'general';
  title: string;
  message: string;
  actions: string[];
  sources?: string[];
}

/**
 * Generate health recommendations based on metrics
 * @pure - No side effects
 */
export function generateRecommendations(
  metrics: CalculatedMetrics,
  profile: UserProfile
): HealthRecommendation[] {
  const recommendations: HealthRecommendation[] = [];

  // Check BMI
  if (metrics.bmi < 18.5) {
    recommendations.push({
      type: 'warning',
      category: 'bmi',
      title: 'recommendations:health.underweight.title',
      message: 'recommendations:health.underweight.message',
      actions: [
        'recommendations:health.underweight.actions.0',
        'recommendations:health.underweight.actions.1',
        'recommendations:health.underweight.actions.2'
      ],
      sources: ['WHO BMI Classification']
    });
  } else if (metrics.bmi >= 30) {
    recommendations.push({
      type: 'critical',
      category: 'bmi',
      title: 'recommendations:health.obesity.title',
      message: 'recommendations:health.obesity.message',
      actions: [
        'recommendations:health.obesity.actions.0',
        'recommendations:health.obesity.actions.1',
        'recommendations:health.obesity.actions.2'
      ],
      sources: ['WHO Obesity Guidelines', 'ACSM Exercise Guidelines']
    });
  }

  // Check body fat
  const fatThreshold = profile.gender === 'male' ? 25 : 32;
  if (metrics.bodyFatPercent > fatThreshold) {
    recommendations.push({
      type: 'warning',
      category: 'body_fat',
      title: 'recommendations:health.elevatedBodyFat.title',
      message: 'recommendations:health.elevatedBodyFat.message',
      actions: [
        'recommendations:health.elevatedBodyFat.actions.0',
        'recommendations:health.elevatedBodyFat.actions.1',
        'recommendations:health.elevatedBodyFat.actions.2'
      ],
      sources: ['ACE Body Fat Guidelines']
    });
  }

  // Check visceral fat
  if (metrics.visceralFatLevel >= 15) {
    recommendations.push({
      type: 'critical',
      category: 'visceral',
      title: 'recommendations:health.highVisceralFat.title',
      message: 'recommendations:health.highVisceralFat.message',
      actions: [
        'recommendations:health.highVisceralFat.actions.0',
        'recommendations:health.highVisceralFat.actions.1',
        'recommendations:health.highVisceralFat.actions.2',
        'recommendations:health.highVisceralFat.actions.3'
      ],
      sources: ['Tanita Clinical Guidelines', 'WHO CVD Prevention']
    });
  } else if (metrics.visceralFatLevel >= 10) {
    recommendations.push({
      type: 'warning',
      category: 'visceral',
      title: 'recommendations:health.elevatedVisceralFat.title',
      message: 'recommendations:health.elevatedVisceralFat.message',
      actions: [
        'recommendations:health.elevatedVisceralFat.actions.0',
        'recommendations:health.elevatedVisceralFat.actions.1',
        'recommendations:health.elevatedVisceralFat.actions.2'
      ]
    });
  }

  // Check muscle mass
  const musclePercent = (metrics.muscleMassKg / (metrics.muscleMassKg + (metrics.bodyFatPercent / 100 * metrics.muscleMassKg / (1 - metrics.bodyFatPercent / 100)))) * 100;
  const muscleThreshold = profile.gender === 'male' ? 33 : 24;

  if (musclePercent < muscleThreshold * 0.9) {
    recommendations.push({
      type: 'info',
      category: 'muscle',
      title: 'recommendations:health.lowMuscleMass.title',
      message: 'recommendations:health.lowMuscleMass.message',
      actions: [
        'recommendations:health.lowMuscleMass.actions.0',
        'recommendations:health.lowMuscleMass.actions.1',
        'recommendations:health.lowMuscleMass.actions.2'
      ],
      sources: ['ISSN Position Stand on Protein', 'ACSM Resistance Training Guidelines']
    });
  }

  // Check hydration (body water)
  const waterThreshold = profile.gender === 'male' ? 50 : 45;
  if (metrics.bodyWaterPercent < waterThreshold) {
    recommendations.push({
      type: 'info',
      category: 'hydration',
      title: 'recommendations:health.possibleDehydration.title',
      message: 'recommendations:health.possibleDehydration.message',
      actions: [
        'recommendations:health.possibleDehydration.actions.0',
        'recommendations:health.possibleDehydration.actions.1',
        'recommendations:health.possibleDehydration.actions.2'
      ]
    });
  }

  // General positive feedback
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'info',
      category: 'general',
      title: 'recommendations:health.goodCondition.title',
      message: 'recommendations:health.goodCondition.message',
      actions: [
        'recommendations:health.goodCondition.actions.0',
        'recommendations:health.goodCondition.actions.1',
        'recommendations:health.goodCondition.actions.2'
      ]
    });
  }

  return recommendations;
}

/**
 * Get priority recommendations (most important first)
 */
export function getPriorityRecommendations(
  recommendations: HealthRecommendation[],
  limit: number = 3
): HealthRecommendation[] {
  const priorityOrder = { critical: 0, warning: 1, info: 2 };

  return [...recommendations]
    .sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type])
    .slice(0, limit);
}
