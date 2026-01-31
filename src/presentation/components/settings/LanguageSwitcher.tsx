/**
 * LanguageSwitcher Component
 *
 * Allows users to switch between supported languages.
 *
 * @module presentation/components/settings/LanguageSwitcher
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../../i18n';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation('settings');

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('appearance.language')}
      </label>
      <div className="flex gap-2">
        {SUPPORTED_LANGUAGES.map(({ code, label, flag }) => (
          <button
            key={code}
            onClick={() => handleLanguageChange(code)}
            className={`
              px-4 py-2 rounded-lg flex items-center gap-2 transition-colors
              ${i18n.language === code || (i18n.language.startsWith(code) && !SUPPORTED_LANGUAGES.some(l => l.code === i18n.language))
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-2 ring-primary-500'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            <span>{flag}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
