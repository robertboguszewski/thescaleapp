# i18n Integration Guide for Components

This guide shows how React components should consume domain layer functions that now return translation keys instead of hardcoded strings.

---

## Pattern 1: Health Recommendations

### Domain Function (Already Migrated)
```typescript
// src/domain/calculations/health-assessment/recommendations.ts
export function generateRecommendations(
  metrics: CalculatedMetrics,
  profile: UserProfile
): HealthRecommendation[]
```

**Returns:**
```typescript
{
  type: 'warning',
  category: 'bmi',
  title: 'recommendations:health.underweight.title',
  message: 'recommendations:health.underweight.message',
  actions: [
    'recommendations:health.underweight.actions.0',
    'recommendations:health.underweight.actions.1',
    'recommendations:health.underweight.actions.2'
  ]
}
```

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { generateRecommendations } from '../../domain/calculations/health-assessment';

export function RecommendationsPanel({ metrics, profile }) {
  const { t } = useTranslation();
  const recommendations = generateRecommendations(metrics, profile);

  // Translate the keys
  const translatedRecommendations = recommendations.map(rec => ({
    ...rec,
    title: t(rec.title),
    message: t(rec.message),
    actions: rec.actions.map(actionKey => t(actionKey))
  }));

  return (
    <div>
      {translatedRecommendations.map((rec, idx) => (
        <div key={idx} className={`alert alert-${rec.type}`}>
          <h3>{rec.title}</h3>
          <p>{rec.message}</p>
          <ul>
            {rec.actions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

---

## Pattern 2: BLE State Messages

### Domain Function (Already Migrated)
```typescript
// src/domain/ble-states.ts
export function getBLEStateMessage(state: BLEConnectionState): BLEStateMessage
```

**Returns:**
```typescript
{
  title: 'ble:states.connected.title',
  description: 'ble:states.connected.description',
  icon: 'connected',
  action: 'ble:states.connected.action'
}
```

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { getBLEStateMessage } from '../../domain/ble-states';
import { useIsConnected } from '../../presentation/stores/bleStore';

export function BLEStatusWidget() {
  const { t } = useTranslation();
  const connectionState = useBLEStore(state => state.connectionState);
  const stateMessage = getBLEStateMessage(connectionState);

  // Translate the keys
  const translatedMessage = {
    ...stateMessage,
    title: t(stateMessage.title),
    description: t(stateMessage.description),
    action: stateMessage.action ? t(stateMessage.action) : undefined
  };

  return (
    <div className="ble-status">
      <h3>{translatedMessage.title}</h3>
      <p>{translatedMessage.description}</p>
      {translatedMessage.action && (
        <button>{translatedMessage.action}</button>
      )}
    </div>
  );
}
```

---

## Pattern 3: BLE Error Messages

### Infrastructure Function (Already Migrated)
```typescript
// src/infrastructure/ble/error-handler.ts
export function createBLEError(code: BLEErrorCode): BLEError
```

**Returns:**
```typescript
{
  code: 'DEVICE_NOT_FOUND',
  message: 'ble:errors.DEVICE_NOT_FOUND.message',
  recoverable: true,
  suggestion: 'ble:errors.DEVICE_NOT_FOUND.suggestion'
}
```

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { useBLEStore } from '../../presentation/stores/bleStore';

export function ErrorDisplay() {
  const { t } = useTranslation();
  const lastError = useBLEStore(state => state.lastError);

  if (!lastError) return null;

  const translatedError = {
    ...lastError,
    message: t(lastError.message),
    suggestion: t(lastError.suggestion)
  };

  return (
    <div className="alert alert-error">
      <h4>{translatedError.message}</h4>
      <p>{translatedError.suggestion}</p>
      {translatedError.recoverable && (
        <p className="text-muted">This error is recoverable. Try again.</p>
      )}
    </div>
  );
}
```

---

## Pattern 4: Profile Matching Results

### Domain Function (Already Migrated)
```typescript
// src/domain/profile-matching/ProfileMatcher.ts
export function detectProfile(
  newWeightKg: number,
  profiles: ProfileWeightData[]
): DetectionResult
```

**Returns:**
```typescript
{
  type: 'ambiguous',
  candidateIds: ['profile-1', 'profile-2'],
  confidence: 50,
  requiresConfirmation: true,
  reason: 'recommendations:health.profileMatching.ambiguous'
}
```

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { detectProfile } from '../../domain/profile-matching/ProfileMatcher';

export function MeasurementAutoAssignment({ weight, profilesData }) {
  const { t } = useTranslation();
  const result = detectProfile(weight, profilesData);

  // Translate the reason
  const translatedReason = t(result.reason);

  return (
    <div>
      <p>{translatedReason}</p>
      {result.requiresConfirmation && (
        <UserConfirmationDialog
          message={translatedReason}
          candidates={result.candidateIds}
        />
      )}
    </div>
  );
}
```

---

## Pattern 5: Report Insights (Service Layer)

### Application Service (Already Migrated)
```typescript
// src/application/services/ReportService.ts
async generateReport(profileId: string): Promise<HealthReport>
```

**Returns:**
```typescript
{
  summary: {
    keyInsight: 'recommendations:health.report.excellent'
  }
}
```

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { useReportService } from '../../application/services/ReportService';

export function HealthReport({ profileId }) {
  const { t } = useTranslation();
  const report = useReportService().generateReport(profileId);

  // Translate the insight
  const translatedInsight = t(report.summary.keyInsight);

  return (
    <div className="health-report">
      <div className="insight">
        <p>{translatedInsight}</p>
      </div>
    </div>
  );
}
```

---

## Pattern 6: Zustand Store with Translation Keys

### Store Function (Already Migrated)
```typescript
// src/presentation/stores/bleStore.ts
export const getStatusMessage = (state: BLEConnectionState): string
```

**Returns:** Translation key like `'ble:status.connected'`

### Component Usage Example
```typescript
import { useTranslation } from 'react-i18next';
import { useBLEStore, getStatusMessage } from '../../presentation/stores/bleStore';

export function BLEStatusIndicator() {
  const { t } = useTranslation();
  const connectionState = useBLEStore(state => state.connectionState);

  // getStatusMessage returns a translation key
  const statusKey = getStatusMessage(connectionState);
  const statusMessage = t(statusKey);

  return <span>{statusMessage}</span>;
}
```

---

## Common Translation Key Patterns

### Single String Keys
```typescript
// Direct translation
const translated = t('ble:states.connected.title');
```

### Array Index Keys
```typescript
// For action items in recommendations
const actions = [
  'recommendations:health.underweight.actions.0',
  'recommendations:health.underweight.actions.1',
  'recommendations:health.underweight.actions.2'
];

const translatedActions = actions.map(key => t(key));
```

### Nested Objects
```typescript
// Translate multiple properties from returned object
const stateMessage = getBLEStateMessage('connected');
const translated = {
  ...stateMessage,
  title: t(stateMessage.title),
  description: t(stateMessage.description),
  action: stateMessage.action ? t(stateMessage.action) : undefined
};
```

---

## Key Points to Remember

✓ **Always import useTranslation hook** in components that consume domain functions
```typescript
import { useTranslation } from 'react-i18next';
```

✓ **Call t() on every translation key** returned from domain/service layers
```typescript
const translated = t(domainResult.title);
```

✓ **Handle optional translations** (some messages may not have optional fields)
```typescript
action: stateMessage.action ? t(stateMessage.action) : undefined
```

✓ **Use array map for multiple items**
```typescript
actions: rec.actions.map(actionKey => t(actionKey))
```

✓ **Don't modify domain layer functions** - they should always return keys, not translated strings

✓ **Test language switching** - ensure translations update when user changes language

---

## Helpful Utilities

Consider creating a helper function to standardize translation:

```typescript
// utils/translationHelpers.ts
export function translateObject<T extends Record<string, string>>(
  obj: T,
  t: TFunction,
  keys: (keyof T)[]
): Record<keyof T, string> {
  return Object.fromEntries(
    keys.map(key => [key, t(obj[key])])
  ) as Record<keyof T, string>;
}

// Usage:
const translated = translateObject(stateMessage, t, ['title', 'description', 'action']);
```

---

## Related Files

- 📄 Locale Files: `src/locales/{en,pl}/{recommendations,ble}.json`
- 🔧 Domain Layer: `src/domain/**/*.ts`
- 🎨 Component Examples: Will be updated during component refactoring phase
- 📚 i18n Config: `src/i18n/i18n.ts`
