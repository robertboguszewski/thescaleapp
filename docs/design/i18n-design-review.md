# i18n Implementation Design Review

**Document Version:** 1.0
**Date:** 2026-01-31
**Status:** REVIEW PENDING
**Confidence Level:** 90%

---

## 1. Executive Summary

This design review evaluates the architecture for adding multi-language support to TheScale Electron app. The current codebase has **~150+ hardcoded Polish strings** across **35+ components** with no existing i18n infrastructure.

### Recommendation Summary

| Decision | Recommendation | Confidence |
|----------|----------------|------------|
| Library | **i18next + react-i18next** | 95% |
| Translation Loading | **Bundled (static import)** | 85% |
| Namespace Strategy | **Feature-based (5-6 namespaces)** | 90% |
| Type Safety | **TypeScript with strict typing** | 95% |
| Initial Languages | **Polish (default) + English** | 90% |

---

## 2. Current Architecture Analysis

### 2.1 Application Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│   (Node.js - electron-store, BLE, IPC handlers)             │
└─────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Renderer Process (React)                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     App.tsx                              ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              Zustand Stores                         │││
│  │  │  appStore │ bleStore │ profileStore │ measurementStore│
│  │  └─────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              Components (35+)                       │││
│  │  │  layout/ │ settings/ │ dashboard/ │ measurement/   │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 String Distribution Analysis

| Location | Count | Examples |
|----------|-------|----------|
| **Navigation (Sidebar.tsx)** | 8 | `'Pulpit'`, `'Pomiar'`, `'Historia'` |
| **BLE Status (bleStore.ts)** | 6 | `'Szukam wagi...'`, `'Połączono'` |
| **Settings (Settings.tsx)** | 25 | Tab labels, descriptions |
| **Profile Editor** | 30 | Form labels, months, validation |
| **Device Settings** | 20 | Error messages, labels |
| **Dashboard components** | 40 | Metrics, recommendations |
| **Notifications (toasts)** | 20 | Success/error messages |

### 2.3 Current Patterns (Anti-patterns for i18n)

```typescript
// ❌ Anti-pattern 1: Hardcoded arrays with labels
const baseNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Pulpit', icon: <DashboardIcon /> },
  { id: 'measure', label: 'Pomiar', icon: <MeasureIcon /> },
];

// ❌ Anti-pattern 2: Status message maps in stores
const messages: Record<BLEConnectionState, string> = {
  disconnected: 'Rozłączono',
  scanning: 'Szukam wagi...',
};

// ❌ Anti-pattern 3: Inline validation messages
if (!name) {
  errors.name = 'Nazwa profilu jest wymagana';
}
```

---

## 3. Library Evaluation

### 3.1 Candidates Comparison

| Criteria | i18next | react-intl | LinguiJS |
|----------|---------|------------|----------|
| **React Integration** | Excellent (react-i18next) | Native | Good |
| **TypeScript Support** | Excellent | Good | Excellent |
| **Bundle Size** | ~40KB | ~25KB | ~15KB |
| **Electron Support** | Native | Needs adapter | Needs adapter |
| **Pluralization** | ICU + custom | ICU | ICU |
| **Namespace Support** | Built-in | Limited | Built-in |
| **Lazy Loading** | Built-in | Manual | Built-in |
| **Community/Ecosystem** | Largest | Large | Growing |
| **Learning Curve** | Moderate | Moderate | Low |

### 3.2 Recommendation: i18next + react-i18next

**Rationale:**
1. **Electron-first design** - works seamlessly in both main and renderer processes
2. **Zustand compatibility** - integrates well with existing state management
3. **TypeScript excellence** - strict typing with `i18next.d.ts` extensions
4. **Mature ecosystem** - plugins for detection, backends, formatting
5. **Large community** - extensive documentation, Stack Overflow support

**Packages to install:**
```bash
npm install i18next react-i18next i18next-browser-languagedetector
# Optional for Electron main process:
npm install i18next-electron-fs-backend  # If loading from filesystem
```

---

## 4. Architecture Design

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    i18n Architecture                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐│
│  │   i18n Config   │───▶│      I18nextProvider            ││
│  │   (src/i18n/)   │    │      (wraps App.tsx)            ││
│  └─────────────────┘    └─────────────────────────────────┘│
│          │                            │                     │
│          ▼                            ▼                     │
│  ┌─────────────────┐    ┌─────────────────────────────────┐│
│  │  Translation    │    │      useTranslation Hook        ││
│  │  Resources      │    │      (in components)            ││
│  │  /locales/      │    └─────────────────────────────────┘│
│  │   ├── pl/       │                  │                     │
│  │   │   ├── common.json              │                     │
│  │   │   ├── navigation.json          ▼                     │
│  │   │   ├── settings.json  ┌─────────────────────────────┐│
│  │   │   ├── ble.json       │   t('namespace:key')        ││
│  │   │   └── validation.json│   <Trans i18nKey="..." />   ││
│  │   └── en/                └─────────────────────────────┘│
│  │       └── (same structure)                              │
│  └─────────────────┘                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Language Persistence                        ││
│  │   electron-store (config) ◀──▶ i18next languageDetector ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Namespace Strategy

**Option A: Feature-based (RECOMMENDED)**
```
src/locales/
├── pl/
│   ├── common.json        # Shared UI elements, buttons, labels
│   ├── navigation.json    # Sidebar, header navigation
│   ├── settings.json      # Settings page, profile editor
│   ├── ble.json          # Bluetooth status, device messages
│   ├── validation.json   # Form validation messages
│   └── dashboard.json    # Dashboard widgets, metrics
└── en/
    └── (same structure)
```

**Pros:**
- Clear separation of concerns
- Easier to maintain per-feature
- Supports lazy loading per namespace
- Team can work on different namespaces in parallel

**Option B: Single namespace (NOT RECOMMENDED)**
```
src/locales/
├── pl/translation.json   # All ~150 strings
└── en/translation.json
```

**Cons:**
- Large files difficult to maintain
- No lazy loading benefit
- Merge conflicts when multiple developers edit

### 4.3 Translation Key Convention

**Recommended format:** `namespace:section.element.state`

```json
// navigation.json
{
  "sidebar": {
    "dashboard": "Pulpit",
    "measure": "Pomiar",
    "history": "Historia",
    "trends": "Trendy",
    "analysis": "Analiza",
    "settings": "Ustawienia"
  },
  "sections": {
    "unassigned": "Nieprzypisane",
    "guestMeasurements": "Pomiary gości"
  }
}

// ble.json
{
  "status": {
    "disconnected": "Rozłączono",
    "scanning": "Szukam wagi...",
    "connecting": "Łączenie...",
    "connected": "Połączono",
    "reading": "Odczyt pomiaru...",
    "error": "Błąd połączenia"
  }
}

// validation.json
{
  "profile": {
    "name": {
      "required": "Nazwa profilu jest wymagana",
      "maxLength": "Nazwa profilu nie może mieć więcej niż {{max}} znaków"
    },
    "age": {
      "range": "Wiek musi być w zakresie {{min}}-{{max}} lat"
    }
  }
}
```

### 4.4 TypeScript Integration

**Type-safe translations with i18next:**

```typescript
// src/i18n/i18n.d.ts
import 'i18next';
import common from '../locales/pl/common.json';
import navigation from '../locales/pl/navigation.json';
import settings from '../locales/pl/settings.json';
import ble from '../locales/pl/ble.json';
import validation from '../locales/pl/validation.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      navigation: typeof navigation;
      settings: typeof settings;
      ble: typeof ble;
      validation: typeof validation;
    };
  }
}
```

**Usage with full type safety:**
```typescript
const { t } = useTranslation('navigation');
t('sidebar.dashboard');  // ✓ TypeScript validates key exists
t('sidebar.invalid');    // ✗ TypeScript error: key doesn't exist
```

---

## 5. Implementation Design

### 5.1 i18n Configuration

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations (bundled approach)
import plCommon from '../locales/pl/common.json';
import plNavigation from '../locales/pl/navigation.json';
import plSettings from '../locales/pl/settings.json';
import plBle from '../locales/pl/ble.json';
import plValidation from '../locales/pl/validation.json';

import enCommon from '../locales/en/common.json';
import enNavigation from '../locales/en/navigation.json';
import enSettings from '../locales/en/settings.json';
import enBle from '../locales/en/ble.json';
import enValidation from '../locales/en/validation.json';

const resources = {
  pl: {
    common: plCommon,
    navigation: plNavigation,
    settings: plSettings,
    ble: plBle,
    validation: plValidation,
  },
  en: {
    common: enCommon,
    navigation: enNavigation,
    settings: enSettings,
    ble: enBle,
    validation: enValidation,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'pl',  // Polish as default (existing users)
    supportedLngs: ['pl', 'en'],
    defaultNS: 'common',
    ns: ['common', 'navigation', 'settings', 'ble', 'validation'],

    interpolation: {
      escapeValue: false,  // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    react: {
      useSuspense: true,
      bindI18n: 'languageChanged loaded',
    },
  });

export default i18n;
```

### 5.2 Provider Setup

```typescript
// src/presentation/index.tsx
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { App } from './App';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element.');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </Suspense>
  </React.StrictMode>
);
```

### 5.3 Component Migration Pattern

**Before (current):**
```typescript
const baseNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Pulpit', icon: <DashboardIcon /> },
  { id: 'measure', label: 'Pomiar', icon: <MeasureIcon /> },
];
```

**After (with i18n):**
```typescript
import { useTranslation } from 'react-i18next';

const Sidebar: React.FC = () => {
  const { t } = useTranslation('navigation');

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <DashboardIcon /> },
    { id: 'measure', label: t('sidebar.measure'), icon: <MeasureIcon /> },
  ];
  // ...
};
```

### 5.4 Store Integration Pattern

**Before (bleStore.ts):**
```typescript
const messages: Record<BLEConnectionState, string> = {
  disconnected: 'Rozłączono',
  scanning: 'Szukam wagi...',
};
```

**After - Option A: Move to component (RECOMMENDED):**
```typescript
// In component using the status
import { useTranslation } from 'react-i18next';

const BLEStatus: React.FC = () => {
  const { t } = useTranslation('ble');
  const state = useBLEStore((s) => s.connectionState);

  const statusText = t(`status.${state}`);
  return <span>{statusText}</span>;
};
```

**After - Option B: Store with i18n instance:**
```typescript
// If absolutely needed in store (avoid if possible)
import i18n from '../i18n/config';

export const getStatusMessage = (state: BLEConnectionState): string => {
  return i18n.t(`ble:status.${state}`);
};
```

### 5.5 Language Switcher Component

```typescript
// src/presentation/components/settings/LanguageSwitcher.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const;

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
        {LANGUAGES.map(({ code, label, flag }) => (
          <button
            key={code}
            onClick={() => handleLanguageChange(code)}
            className={`
              px-4 py-2 rounded-lg flex items-center gap-2 transition-colors
              ${i18n.language === code
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
```

---

## 6. Alternative Approaches Evaluated

### 6.1 Lazy Loading vs Bundled Translations

| Approach | Bundled (SELECTED) | Lazy Loading |
|----------|-------------------|--------------|
| **Initial Load** | +50-100KB | Minimal |
| **Complexity** | Low | Medium |
| **Offline Support** | Full | Partial |
| **Language Switch** | Instant | Network delay |
| **Electron Fit** | Excellent | Good |

**Decision:** Bundled approach for this app size (~150 strings × 2 languages ≈ 50KB). Lazy loading adds complexity without significant benefit.

### 6.2 Persistence Strategy

| Option | electron-store | localStorage | Both |
|--------|---------------|--------------|------|
| **Main Process Access** | ✓ | ✗ | ✓ |
| **Renderer Access** | Via IPC | ✓ | ✓ |
| **Sync Complexity** | Medium | Low | High |

**Decision:** Use `i18next-browser-languagedetector` with localStorage for renderer. Sync to electron-store if main process needs language info.

### 6.3 Date/Number Formatting

**Option A: i18next formatting (RECOMMENDED)**
```typescript
// Uses Intl.DateTimeFormat under the hood
t('date.lastMeasurement', { date: new Date(), formatParams: { date: { dateStyle: 'long' } } });
```

**Option B: dayjs locale (existing)**
```typescript
import dayjs from 'dayjs';
import 'dayjs/locale/pl';
import 'dayjs/locale/en';

// Sync with i18n language change
i18n.on('languageChanged', (lng) => {
  dayjs.locale(lng);
});
```

**Decision:** Use both - dayjs for complex date operations (already in use), i18next for simple inline formatting.

---

## 7. Migration Strategy

### 7.1 Phased Rollout

```
Phase 1 (Week 1): Infrastructure
├── Install packages
├── Create i18n configuration
├── Set up TypeScript types
├── Add I18nextProvider to index.tsx
└── Create folder structure for locales

Phase 2 (Week 2): Navigation & Layout
├── Migrate Sidebar.tsx
├── Migrate Header.tsx
├── Extract navigation namespace
└── Test language switching

Phase 3 (Week 3): Settings Module
├── Migrate Settings.tsx
├── Migrate ProfileEditor.tsx
├── Migrate DeviceSettings.tsx
├── Extract settings + validation namespaces
└── Add LanguageSwitcher component

Phase 4 (Week 4): Stores & Status
├── Migrate bleStore status messages
├── Migrate notification messages
├── Extract ble namespace
└── Ensure store/component boundary is clean

Phase 5 (Week 5): Dashboard & Remaining
├── Migrate Dashboard components
├── Migrate history/trends components
├── Extract dashboard namespace
└── Complete remaining components

Phase 6 (Week 6): Polish & QA
├── Add English translations
├── Test all UI flows in both languages
├── Fix edge cases (plurals, interpolation)
└── Documentation and handoff
```

### 7.2 Migration Checklist Per Component

```markdown
For each component migration:
[ ] Identify all hardcoded strings
[ ] Add to appropriate namespace JSON
[ ] Import useTranslation hook
[ ] Replace strings with t() calls
[ ] Test component in both languages
[ ] Verify interpolation works correctly
[ ] Check for edge cases (empty states, errors)
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing Polish UI | Medium | High | Incremental migration, feature flags |
| Missing translations | High | Medium | Fallback to Polish, translation validation CI |
| Performance regression | Low | Medium | Bundle size monitoring, lazy loading if needed |
| Store/component boundary issues | Medium | Medium | Clear patterns, code review |
| Pluralization edge cases | Medium | Low | ICU message format, thorough testing |

---

## 9. Success Criteria

### 9.1 Functional Requirements
- [ ] App launches in detected system language (pl/en)
- [ ] Language can be changed in Settings
- [ ] Language preference persists across sessions
- [ ] All UI text is translated (0 hardcoded strings in components)
- [ ] Date/number formatting respects locale

### 9.2 Non-Functional Requirements
- [ ] Bundle size increase < 100KB
- [ ] No visible delay on language switch
- [ ] TypeScript compilation catches missing translation keys
- [ ] Translation coverage report in CI

### 9.3 Quality Gates
- [ ] All existing tests pass
- [ ] New tests for language switching
- [ ] Manual QA in both languages
- [ ] Accessibility audit (screen reader compatibility)

---

## 10. Open Questions for Review

1. **Language priorities:** Should we add German/Spanish in Phase 1, or defer to future?

2. **RTL support:** Any plans for Arabic/Hebrew requiring RTL layout support?

3. **Translation workflow:** Internal translation or external service (Crowdin, Lokalise)?

4. **Main process i18n:** Does the main process need translations (e.g., native menus, dialogs)?

5. **Fallback behavior:** If English translation missing, show Polish or show key?

---

## 11. Appendix

### A. File Structure After Implementation

```
src/
├── i18n/
│   ├── config.ts           # i18next initialization
│   └── i18n.d.ts           # TypeScript type extensions
├── locales/
│   ├── pl/
│   │   ├── common.json
│   │   ├── navigation.json
│   │   ├── settings.json
│   │   ├── ble.json
│   │   ├── validation.json
│   │   └── dashboard.json
│   └── en/
│       └── (same structure)
└── presentation/
    ├── index.tsx           # I18nextProvider wrapper
    ├── components/
    │   └── settings/
    │       └── LanguageSwitcher.tsx
    └── ...
```

### B. Example Translation Files

**pl/common.json:**
```json
{
  "buttons": {
    "save": "Zapisz",
    "cancel": "Anuluj",
    "delete": "Usuń",
    "edit": "Edytuj",
    "create": "Utwórz",
    "confirm": "Potwierdź"
  },
  "status": {
    "loading": "Ładowanie...",
    "error": "Wystąpił błąd",
    "success": "Sukces"
  },
  "time": {
    "today": "Dzisiaj",
    "yesterday": "Wczoraj",
    "daysAgo": "{{count}} dni temu",
    "daysAgo_one": "{{count}} dzień temu"
  }
}
```

**en/common.json:**
```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "confirm": "Confirm"
  },
  "status": {
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Success"
  },
  "time": {
    "today": "Today",
    "yesterday": "Yesterday",
    "daysAgo": "{{count}} days ago",
    "daysAgo_one": "{{count}} day ago"
  }
}
```

---

**Document prepared for design review.**
**Next step:** Stakeholder approval before implementation phase.
