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
      title: 'Niedowaga',
      message: 'Twoje BMI wskazuje na niedowagę, co może zwiększać ryzyko niedoborów żywieniowych.',
      actions: [
        'Zwiększ spożycie kalorii o 300-500 kcal/dzień',
        'Skup się na wysokobiałkowych posiłkach',
        'Rozważ konsultację z dietetykiem'
      ],
      sources: ['WHO BMI Classification']
    });
  } else if (metrics.bmi >= 30) {
    recommendations.push({
      type: 'critical',
      category: 'bmi',
      title: 'Otyłość',
      message: 'Twoje BMI wskazuje na otyłość, co zwiększa ryzyko chorób sercowo-naczyniowych.',
      actions: [
        'Wprowadź deficyt kaloryczny 500-750 kcal/dzień',
        'Zwiększ aktywność fizyczną do minimum 150 min/tydzień',
        'Rozważ konsultację z lekarzem'
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
      title: 'Podwyższony poziom tkanki tłuszczowej',
      message: 'Twój poziom tkanki tłuszczowej jest powyżej zalecanego zakresu.',
      actions: [
        'Zwiększ aktywność fizyczną, w tym cardio',
        'Ogranicz przetworzoną żywność i cukry proste',
        'Zadbaj o odpowiednią ilość białka w diecie'
      ],
      sources: ['ACE Body Fat Guidelines']
    });
  }

  // Check visceral fat
  if (metrics.visceralFatLevel >= 15) {
    recommendations.push({
      type: 'critical',
      category: 'visceral',
      title: 'Wysoki tłuszcz trzewny',
      message: 'Wysoki poziom tłuszczu trzewnego znacząco zwiększa ryzyko cukrzycy i chorób serca.',
      actions: [
        'Priorytet: redukcja obwodu talii',
        'Wprowadź trening HIIT 2-3x w tygodniu',
        'Ogranicz alkohol i stres',
        'Rozważ konsultację medyczną'
      ],
      sources: ['Tanita Clinical Guidelines', 'WHO CVD Prevention']
    });
  } else if (metrics.visceralFatLevel >= 10) {
    recommendations.push({
      type: 'warning',
      category: 'visceral',
      title: 'Podwyższony tłuszcz trzewny',
      message: 'Twój poziom tłuszczu trzewnego jest lekko podwyższony.',
      actions: [
        'Zwiększ aktywność fizyczną',
        'Ogranicz alkohol',
        'Monitoruj regularnie'
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
      title: 'Niska masa mięśniowa',
      message: 'Zwiększenie masy mięśniowej poprawi metabolizm i zdrowie ogólne.',
      actions: [
        'Wprowadź trening siłowy 2-3x w tygodniu',
        'Zwiększ spożycie białka do 1.6-2.2g/kg masy ciała',
        'Zadbaj o regenerację (7-9h snu)'
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
      title: 'Możliwe odwodnienie',
      message: 'Twój poziom wody w organizmie może być niewystarczający.',
      actions: [
        'Pij minimum 2-3 litry wody dziennie',
        'Ogranicz kofeina i alkohol',
        'Wykonuj pomiar rano dla dokładniejszych wyników'
      ]
    });
  }

  // General positive feedback
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'info',
      category: 'general',
      title: 'Dobra kondycja!',
      message: 'Twoje parametry są w zdrowych zakresach. Kontynuuj obecny styl życia.',
      actions: [
        'Utrzymuj regularną aktywność fizyczną',
        'Kontynuuj zbilansowaną dietę',
        'Wykonuj pomiary regularnie dla monitoringu'
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
