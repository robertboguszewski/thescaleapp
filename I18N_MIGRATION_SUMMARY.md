# Domain Layer i18n Migration - Complete Summary

Date: 2026-01-31

## Overview
Successfully migrated all domain layer files and related services to use i18n translation keys instead of hardcoded Polish strings. This allows React components and other layers to dynamically translate all user-facing messages.

---

## Files Modified

### 1. **Locale Files (JSON Translation Files)**

#### `/src/locales/pl/recommendations.json`
Added new translation keys under `health` namespace:
- `health.underweight.title`, `.message`, `.actions[0-2]`
- `health.obesity.title`, `.message`, `.actions[0-2]`
- `health.elevatedBodyFat.title`, `.message`, `.actions[0-2]`
- `health.highVisceralFat.title`, `.message`, `.actions[0-3]`
- `health.elevatedVisceralFat.title`, `.message`, `.actions[0-2]`
- `health.lowMuscleMass.title`, `.message`, `.actions[0-2]`
- `health.possibleDehydration.title`, `.message`, `.actions[0-2]`
- `health.goodCondition.title`, `.message`, `.actions[0-2]`
- `health.profileMatching.*` (newProfileNoHistory, weightNoMatch, ambiguous, matchedByWeight, invalidWeight)
- `health.report.*` (regularMeasurements, excellent, goodProgress, improving, fatIncrease, muscleLoss, needsAttention, stable)

#### `/src/locales/en/recommendations.json`
Added equivalent English translations for all keys added to Polish file.

#### `/src/locales/pl/ble.json`
Added new translation keys:
- `states.*` - All BLE connection state messages (disconnected, scanning, connecting, connected, reading, error)
- `errors.*` - All BLE error codes with messages and suggestions (BLUETOOTH_OFF, DEVICE_NOT_FOUND, CONNECTION_TIMEOUT, READ_FAILED, DECRYPTION_FAILED, INVALID_DATA)

#### `/src/locales/en/ble.json`
Added equivalent English translations for all BLE state and error keys.

---

### 2. **Domain Layer Files**

#### `/src/domain/calculations/health-assessment/recommendations.ts`
Changed all hardcoded Polish strings to translation keys:
- BMI underweight recommendation → `recommendations:health.underweight.*`
- BMI obesity recommendation → `recommendations:health.obesity.*`
- Elevated body fat → `recommendations:health.elevatedBodyFat.*`
- High visceral fat → `recommendations:health.highVisceralFat.*`
- Elevated visceral fat → `recommendations:health.elevatedVisceralFat.*`
- Low muscle mass → `recommendations:health.lowMuscleMass.*`
- Possible dehydration → `recommendations:health.possibleDehydration.*`
- Good condition feedback → `recommendations:health.goodCondition.*`

**Note:** Action strings use array index notation (e.g., `recommendations:health.underweight.actions.0`)

#### `/src/domain/ble-states.ts`
Changed all BLE state messages to use translation keys:
- All 6 states (disconnected, scanning, connecting, connected, reading, error) now return keys like:
  - `ble:states.disconnected.title`
  - `ble:states.disconnected.description`
  - `ble:states.disconnected.action`

#### `/src/domain/profile-matching/ProfileMatcher.ts`
Changed reason messages to use translation keys:
- `'recommendations:health.profileMatching.invalidWeight'`
- `'recommendations:health.profileMatching.newProfileNoHistory'`
- `'recommendations:health.profileMatching.weightNoMatch'`
- `'recommendations:health.profileMatching.matchedByWeight'`
- `'recommendations:health.profileMatching.ambiguous'`

#### `/src/infrastructure/ble/error-handler.ts`
Changed error messages to use translation keys:
- All 6 error codes now return keys like:
  - `ble:errors.BLUETOOTH_OFF.message`
  - `ble:errors.BLUETOOTH_OFF.suggestion`
- Applied to: BLUETOOTH_OFF, DEVICE_NOT_FOUND, CONNECTION_TIMEOUT, READ_FAILED, DECRYPTION_FAILED, INVALID_DATA

#### `/src/application/services/ReportService.ts`
Changed `generateKeyInsight()` function to return translation keys:
- `'recommendations:health.report.regularMeasurements'`
- `'recommendations:health.report.excellent'`
- `'recommendations:health.report.goodProgress'`
- `'recommendations:health.report.improving'`
- `'recommendations:health.report.fatIncrease'`
- `'recommendations:health.report.muscleLoss'`
- `'recommendations:health.report.needsAttention'`
- `'recommendations:health.report.stable'`

#### `/src/presentation/stores/bleStore.ts`
Changed `getStatusMessage()` function to return translation keys instead of hardcoded strings:
- `'ble:status.disconnected'`
- `'ble:status.scanning'`
- `'ble:status.connecting'`
- `'ble:status.connected'`
- `'ble:status.reading'`
- `'ble:status.error'`

Added JSDoc comment noting that components should call `t()` on returned keys.

---

## Key Design Decisions

### 1. **Translation Key Format**
Used namespace:key.path format:
- `recommendations:health.underweight.title` for recommendations
- `ble:states.disconnected.title` for BLE states
- `ble:errors.BLUETOOTH_OFF.message` for BLE errors
- `ble:status.disconnected` for status messages

### 2. **Action Arrays**
For multi-line action recommendations, used array index notation:
- `recommendations:health.underweight.actions.0`
- `recommendations:health.underweight.actions.1`
- `recommendations:health.underweight.actions.2`

This allows components to iterate and translate each action individually if needed.

### 3. **No React Hooks in Domain Layer**
Domain layer files DO NOT use `useTranslation()` hook because:
- They are pure business logic functions, not React components
- They must return translation keys (strings) that can be translated later
- The actual translation happens in the presentation layer when components call `t(key)`

### 4. **Component Integration Pattern**
Components that consume these domain functions should:
```typescript
const { t } = useTranslation();
const recommendations = generateRecommendations(metrics, profile);

// Translate the keys when displaying
const translatedRecommendations = recommendations.map(rec => ({
  ...rec,
  title: t(rec.title),
  message: t(rec.message),
  actions: rec.actions.map(action => t(action))
}));
```

---

## Translation Key Mapping

### Recommendations Namespace (`recommendations.json`)
```
health.underweight.{title, message, actions[]}
health.obesity.{title, message, actions[]}
health.elevatedBodyFat.{title, message, actions[]}
health.highVisceralFat.{title, message, actions[]}
health.elevatedVisceralFat.{title, message, actions[]}
health.lowMuscleMass.{title, message, actions[]}
health.possibleDehydration.{title, message, actions[]}
health.goodCondition.{title, message, actions[]}
health.profileMatching.{newProfileNoHistory, weightNoMatch, ambiguous, matchedByWeight, invalidWeight}
health.report.{regularMeasurements, excellent, goodProgress, improving, fatIncrease, muscleLoss, needsAttention, stable}
```

### BLE Namespace (`ble.json`)
```
states.{disconnected, scanning, connecting, connected, reading, error}.{title, description, action?}
errors.{BLUETOOTH_OFF, DEVICE_NOT_FOUND, CONNECTION_TIMEOUT, READ_FAILED, DECRYPTION_FAILED, INVALID_DATA}.{message, suggestion}
status.{disconnected, scanning, connecting, connected, reading, error}
```

---

## Translation Coverage

### Polish (`pl`)
✓ All translation keys fully translated in Polish
✓ All 2 locale files updated with new keys

### English (`en`)
✓ All translation keys fully translated in English
✓ All 2 locale files updated with new keys

---

## Testing Checklist

When integrating these changes:

- [ ] Verify recommendations are displayed correctly with translations
- [ ] Verify BLE state messages are translated properly
- [ ] Verify error messages are translated correctly
- [ ] Verify profile matching reason messages display correctly
- [ ] Verify report insights use correct translated text
- [ ] Check that components properly call `t()` on returned keys
- [ ] Verify i18n switching (Polish ↔ English) updates all messages
- [ ] Test with missing translation keys to ensure fallback behavior

---

## Files Changed Summary

| File | Changes | Type |
|------|---------|------|
| src/locales/pl/recommendations.json | +60 lines (new keys) | Locale |
| src/locales/en/recommendations.json | +60 lines (new keys) | Locale |
| src/locales/pl/ble.json | +60 lines (new keys) | Locale |
| src/locales/en/ble.json | +60 lines (new keys) | Locale |
| src/domain/calculations/health-assessment/recommendations.ts | 10 hardcoded strings → keys | Domain |
| src/domain/ble-states.ts | 12 hardcoded strings → keys | Domain |
| src/domain/profile-matching/ProfileMatcher.ts | 4 hardcoded strings → keys | Domain |
| src/infrastructure/ble/error-handler.ts | 12 hardcoded strings → keys | Infrastructure |
| src/application/services/ReportService.ts | 8 hardcoded strings → keys | Application |
| src/presentation/stores/bleStore.ts | 6 hardcoded strings → keys | Presentation |

---

## Next Steps

1. **Update Components** - Review components that consume these domain functions and ensure they properly translate returned keys using the `useTranslation()` hook
2. **Test i18n Integration** - Run the application and test language switching to ensure all translations display correctly
3. **Component Refactoring** - Update presentation components to properly handle the new translation key format
4. **Documentation** - Update component documentation to show the new pattern for translating domain-layer results

---

## Important Notes

⚠️ **Critical:** No React hooks are used in domain layer files - all translation happens in the presentation layer

⚠️ **Action Arrays:** Action items are indexed (0, 1, 2, etc.) and must be translated individually in components

⚠️ **Key Format:** Always use the full namespace:key.path format when referencing these translations
