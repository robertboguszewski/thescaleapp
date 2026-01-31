/**
 * i18n Configuration
 *
 * Initializes i18next for internationalization support.
 * Supports Polish (default) and English languages.
 *
 * @module i18n/config
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Polish translations
import plCommon from '../locales/pl/common.json';
import plNavigation from '../locales/pl/navigation.json';
import plSettings from '../locales/pl/settings.json';
import plBle from '../locales/pl/ble.json';
import plValidation from '../locales/pl/validation.json';
import plDashboard from '../locales/pl/dashboard.json';
import plHistory from '../locales/pl/history.json';
import plMeasurement from '../locales/pl/measurement.json';
import plRecommendations from '../locales/pl/recommendations.json';
import plAnalysis from '../locales/pl/analysis.json';

// English translations
import enCommon from '../locales/en/common.json';
import enNavigation from '../locales/en/navigation.json';
import enSettings from '../locales/en/settings.json';
import enBle from '../locales/en/ble.json';
import enValidation from '../locales/en/validation.json';
import enDashboard from '../locales/en/dashboard.json';
import enHistory from '../locales/en/history.json';
import enMeasurement from '../locales/en/measurement.json';
import enRecommendations from '../locales/en/recommendations.json';
import enAnalysis from '../locales/en/analysis.json';

/**
 * Translation resources
 */
const resources = {
  pl: {
    common: plCommon,
    navigation: plNavigation,
    settings: plSettings,
    ble: plBle,
    validation: plValidation,
    dashboard: plDashboard,
    history: plHistory,
    measurement: plMeasurement,
    recommendations: plRecommendations,
    analysis: plAnalysis,
  },
  en: {
    common: enCommon,
    navigation: enNavigation,
    settings: enSettings,
    ble: enBle,
    validation: enValidation,
    dashboard: enDashboard,
    history: enHistory,
    measurement: enMeasurement,
    recommendations: enRecommendations,
    analysis: enAnalysis,
  },
};

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

/**
 * Available namespaces
 */
export const NAMESPACES = [
  'common',
  'navigation',
  'settings',
  'ble',
  'validation',
  'dashboard',
  'history',
  'measurement',
  'recommendations',
  'analysis',
] as const;

export type Namespace = typeof NAMESPACES[number];

/**
 * Track missing translation keys in development
 */
const missingKeys = new Set<string>();

/**
 * Get all missing translation keys (for debugging)
 */
export const getMissingKeys = (): string[] => Array.from(missingKeys);

/**
 * Clear missing keys (useful after fixing)
 */
export const clearMissingKeys = (): void => missingKeys.clear();

/**
 * Log all missing keys to console
 */
export const logMissingKeys = (): void => {
  if (missingKeys.size === 0) {
    console.log('[i18n] ✅ No missing translation keys');
    return;
  }
  console.group(`[i18n] ❌ Missing ${missingKeys.size} translation keys:`);
  const grouped: Record<string, string[]> = {};
  missingKeys.forEach((key) => {
    const [ns, ...rest] = key.split(':');
    if (!grouped[ns]) grouped[ns] = [];
    grouped[ns].push(rest.join(':'));
  });
  Object.entries(grouped).forEach(([ns, keys]) => {
    console.groupCollapsed(`${ns} (${keys.length})`);
    keys.forEach((k) => console.log(`  - ${k}`));
    console.groupEnd();
  });
  console.groupEnd();
};

// Expose to window for debugging in dev tools
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__i18n = {
    getMissingKeys,
    clearMissingKeys,
    logMissingKeys,
    i18n,
  };
}

/**
 * Initialize i18next
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en', // English as default
    supportedLngs: ['pl', 'en'],
    defaultNS: 'common',
    ns: NAMESPACES,

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'thescale-language',
    },

    react: {
      useSuspense: true,
      bindI18n: 'languageChanged loaded',
    },

    // Debug mode in development
    debug: false, // Disable verbose i18next logs, use custom handler instead

    // Missing key handler - logs missing translations
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      const fullKey = `${ns}:${key}`;
      if (!missingKeys.has(fullKey)) {
        missingKeys.add(fullKey);
        console.error(
          `[i18n] ❌ MISSING: ${fullKey}`,
          `\n  Languages: ${lngs.join(', ')}`,
          `\n  Fallback: "${fallbackValue || key}"`,
          `\n  Stack:`,
          new Error().stack?.split('\n').slice(2, 6).join('\n')
        );
      }
    },

    // Return key as fallback so we can see what's missing in the UI
    returnEmptyString: false,
    parseMissingKeyHandler: (key: string) => `⚠️ ${key}`,
  });

export default i18n;
