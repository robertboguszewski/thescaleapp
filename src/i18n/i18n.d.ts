/**
 * i18next TypeScript Type Declarations
 *
 * This file extends i18next types to allow any string keys.
 * For full type-safe translations, a more complex setup would be needed
 * with generated types from translation files.
 *
 * @module i18n/types
 */

import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    // Disable strict key checking for simpler usage
    // This allows any string as translation key
    returnNull: false;
  }
}
