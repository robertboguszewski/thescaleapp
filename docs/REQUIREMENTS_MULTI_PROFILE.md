# Requirements Analysis: Multi-Profile Support

## Overview

**Feature**: Enhanced multi-profile support with automatic user detection
**Confidence Level**: 90%
**Status**: Requirements Discovery Complete

---

## 1. User Requirements

### R1: Multiple User Profiles
- User can create multiple profiles
- Each profile contains:
  - **Name**: Display name for the profile
  - **Birth Date**: Year and month of birth (for automatic age calculation)
  - **Height**: In centimeters
  - **Gender**: Male/Female

### R2: Active Profile Selection
- User can select which profile is currently active
- Active profile is used for new measurements by default
- Only one profile can be active at a time

### R3: Automatic Profile Assignment
- Each measurement from scale is assigned to default profile UNLESS:
- Weight differs by more than 2kg from the profile's recent average
- In case of deviation, system should detect correct profile automatically

---

## 2. Current Implementation Analysis

### Existing Capabilities ✅
| Feature | Status | Location |
|---------|--------|----------|
| Multiple profiles | ✅ Exists | `ProfileRepository` |
| Default profile | ✅ Exists | `isDefault` flag |
| Profile CRUD | ✅ Exists | `ProfileService` |
| Measurement-Profile link | ✅ Exists | `MeasurementResult.userProfileId` |

### Required Changes ❌
| Feature | Current | Required |
|---------|---------|----------|
| Age storage | `age: number` | `birthDate: { year, month }` |
| Weight history tracking | None | Per-profile weight averages |
| Auto-detection algorithm | None | `ProfileMatcher` service |
| Conflict resolution UI | None | Confirmation dialogs |

---

## 3. Industry Research

### Weight-Based Detection Standards

| Vendor | Threshold | Method |
|--------|-----------|--------|
| [Withings](https://support.withings.com/hc/en-us/articles/19608506154513-Body-Smart-User-recognition-and-selection) | ~4.5kg (10 lbs) | Weight range matching |
| [Greater Goods](https://greatergoods.com/service/0375) | 10 lbs | Weight proximity |
| [RENPHO](https://renpho.com/blogs/wellness-fitness-blog/how-to-use-your-smart-scales-multiple-users-feature) | 10 lbs | Auto-detection with manual override |
| [Wyze](https://why.wyze.com/scale-with-multi-user-auto-detection-for-family-health-tracking) | Variable | Smart recognition for 8 users |

**Key Finding**: Industry standard is **~4.5kg (10 lbs)** threshold. The requested **2kg threshold is stricter** and may cause more false positives.

### Open Source Implementations

- **[lolouk44/xiaomi_mi_scale](https://github.com/lolouk44/xiaomi_mi_scale)**: Uses `weight_min`/`weight_max` ranges per user
- **[esp32_xiaomi_mi_2_hass](https://github.com/rando-calrissian/esp32_xiaomi_mi_2_hass)**: Weight range matching with Home Assistant

### Advanced Identification Methods

Research from [Nature Scientific Reports](https://www.nature.com/articles/s41598-019-49792-9) shows bioimpedance patterns can be used as a biometric "fingerprint" with 94% accuracy. However, this requires:
- Consistent barefoot measurements
- Initial calibration period
- More complex hardware integration

---

## 4. Proposed Data Model

### Updated UserProfile
```typescript
interface UserProfile {
  gender: 'male' | 'female';
  birthDate: {
    year: number;   // e.g., 1990
    month: number;  // 1-12
  };
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}

// Computed property
function calculateAge(birthDate: { year: number; month: number }): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.year;
  if (today.getMonth() + 1 < birthDate.month) {
    age--;  // Birthday hasn't occurred this year
  }
  return age;
}
```

### New ProfileWeightHistory
```typescript
interface ProfileWeightHistory {
  profileId: string;
  recentWeights: Array<{
    date: Date;
    weightKg: number;
  }>;
  averageWeight: number;      // Rolling 7-day average
  weightRange: {
    min: number;              // averageWeight - threshold
    max: number;              // averageWeight + threshold
  };
  lastMeasurementDate: Date;
}
```

### DetectionResult
```typescript
type DetectionResultType =
  | 'confident'      // Single match, high confidence
  | 'ambiguous'      // Multiple profiles match
  | 'no_match'       // No profile matches (guest?)
  | 'new_profile';   // Profile has no history yet

interface DetectionResult {
  type: DetectionResultType;
  profile?: StoredUserProfile;
  candidates?: StoredUserProfile[];
  confidence: number;           // 0-100%
  requiresConfirmation: boolean;
  reason: string;               // Human-readable explanation
}
```

---

## 5. Auto-Detection Algorithm

```typescript
class ProfileMatcher {
  private readonly WEIGHT_THRESHOLD_KG = 4.5;  // Industry standard
  private readonly MIN_HISTORY_DAYS = 3;

  async detectProfile(
    newWeightKg: number,
    profiles: StoredUserProfile[],
    measurementRepo: MeasurementRepository
  ): Promise<DetectionResult> {

    // 1. Build weight history for each profile
    const profilesWithHistory = await this.buildWeightHistory(profiles, measurementRepo);

    // 2. Find profiles within weight threshold
    const matches = profilesWithHistory.filter(p => {
      if (!p.hasHistory) return false;  // Skip profiles without history
      return newWeightKg >= p.weightRange.min && newWeightKg <= p.weightRange.max;
    });

    // 3. Return detection result
    if (matches.length === 0) {
      // Check if any profile lacks history (new profile scenario)
      const newProfiles = profilesWithHistory.filter(p => !p.hasHistory);
      if (newProfiles.length === 1) {
        return {
          type: 'new_profile',
          profile: newProfiles[0].profile,
          confidence: 60,
          requiresConfirmation: true,
          reason: 'Nowy profil bez historii pomiarów'
        };
      }
      return {
        type: 'no_match',
        confidence: 0,
        requiresConfirmation: true,
        reason: 'Waga nie pasuje do żadnego profilu'
      };
    }

    if (matches.length === 1) {
      const match = matches[0];
      const deviation = Math.abs(newWeightKg - match.averageWeight);
      const confidence = Math.max(0, 100 - (deviation / this.WEIGHT_THRESHOLD_KG) * 50);

      return {
        type: 'confident',
        profile: match.profile,
        confidence,
        requiresConfirmation: false,
        reason: `Dopasowano do ${match.profile.name}`
      };
    }

    // Multiple matches - ambiguous
    return {
      type: 'ambiguous',
      candidates: matches.map(m => m.profile),
      confidence: 50,
      requiresConfirmation: true,
      reason: 'Waga pasuje do wielu profili'
    };
  }
}
```

---

## 6. Edge Cases & Solutions

### EC1: Two profiles with similar weights
**Scenario**: Adam (72kg) and Ewa (70kg) - weights overlap within 2kg threshold
**Solution**:
- Show "Kto to?" (Who is this?) dialog
- Use secondary signals: time of day patterns, impedance similarity
- Allow user to "lock" profile for current session

### EC2: New profile with no measurement history
**Scenario**: Just created profile, first measurement
**Solution**:
- Assign to default profile
- Mark as "establishing baseline" for first 3 measurements
- After baseline, use for auto-detection

### EC3: Significant weight change (diet/illness)
**Scenario**: User legitimately loses 4kg in 2 weeks
**Solution**:
- Detect trend direction (consistent loss vs spike)
- If consistent trend: adapt weight range gradually
- If spike: prompt for confirmation

### EC4: Guest user (unregistered weight)
**Scenario**: Visitor steps on scale
**Solution**:
- Save as "Unassigned measurement"
- Show in separate "Guest" section
- Allow later assignment to profile or deletion

### EC5: Profile overlap at exactly 2kg boundary
**Scenario**: newWeight = profileA.max = profileB.min
**Solution**:
- Both profiles match → ambiguous
- Show selection dialog
- Consider adding 0.1kg buffer between ranges

---

## 7. UI/UX Requirements

### Profile Editor Updates
- Birth date picker: Year dropdown (1920-current) + Month dropdown (1-12)
- Age displayed as calculated value (read-only)
- "Auto-aktualizacja wieku" indicator

### Measurement Flow
```
[Scale Reading]
    ↓
[Auto-Detection Algorithm]
    ↓
┌─────────────────────────────────────┐
│ confident → Assign directly         │
│ ambiguous → Show selection dialog   │
│ no_match  → Show "Kto to?" dialog   │
│ new_profile → Confirm for new user  │
└─────────────────────────────────────┘
```

### Settings
- Toggle: "Automatyczne rozpoznawanie profilu" (on/off)
- Slider: "Próg rozpoznawania" (1-5kg, default 2kg)
- Toggle: "Tryb gościa" (save unassigned measurements)

---

## 8. Architecture Changes

### Domain Layer
```
src/domain/
├── calculations/
│   ├── types.ts                    # UPDATE: birthDate instead of age
│   └── age-calculator.ts           # NEW: calculateAge() function
└── profile-matching/               # NEW
    ├── ProfileMatcher.ts           # Detection algorithm
    ├── types.ts                    # DetectionResult, WeightHistory
    └── __tests__/
        └── ProfileMatcher.test.ts
```

### Application Layer
```
src/application/
├── services/
│   ├── MeasurementService.ts       # UPDATE: add auto-detection
│   └── ProfileMatchingService.ts   # NEW: orchestrates detection
└── use-cases/
    └── AutoAssignMeasurementUseCase.ts  # NEW
```

### Infrastructure Layer
```
src/infrastructure/
└── storage/
    ├── schemas.ts                  # UPDATE: birthDate schema
    └── JsonProfileRepository.ts    # UPDATE: migration logic
```

### Presentation Layer
```
src/presentation/
├── components/
│   ├── settings/
│   │   └── ProfileEditor.tsx       # UPDATE: birth date picker
│   └── measurement/
│       ├── ProfileSelector.tsx     # NEW: selection dialog
│       └── GuestModePrompt.tsx     # NEW
└── stores/
    └── profileStore.ts             # UPDATE: auto-detection state
```

---

## 9. Migration Strategy

### Step 1: Add birthDate (backward compatible)
```typescript
interface UserProfile {
  gender: 'male' | 'female';
  age?: number;                      // DEPRECATED
  birthDate?: { year: number; month: number };  // NEW
  heightCm: number;
  ethnicity?: 'asian' | 'non-asian';
}
```

### Step 2: Migration script
```typescript
function migrateProfile(old: OldProfile): NewProfile {
  const currentYear = new Date().getFullYear();
  const estimatedBirthYear = currentYear - old.age;

  return {
    ...old,
    birthDate: {
      year: estimatedBirthYear,
      month: 1  // Default to January (user can update)
    }
  };
}
```

### Step 3: Remove deprecated field (v2.0)
- Remove `age` field entirely
- Require `birthDate` in all profiles

---

## 10. Design Decisions (Confirmed)

| Question | Decision |
|----------|----------|
| **Weight threshold** | **4.5kg** (industry standard) |
| **Birth date precision** | **Year only** (simpler UX) |
| **Guest mode** | **Save as "Guest"** with manual assignment option |
| **Ambiguous resolution** | **Always ask user** (no automatic selection)

---

## 11. Estimated Effort

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| Data Model | birthDate migration, schemas | 4h |
| Domain | ProfileMatcher, age calculator | 6h |
| Application | Services, use cases | 4h |
| UI | Profile editor, dialogs | 6h |
| Testing | Unit + integration tests | 6h |
| Migration | Data migration script | 2h |
| **Total** | | **~28h** |

---

## Sources

1. [Withings Body Smart - User Recognition](https://support.withings.com/hc/en-us/articles/19608506154513-Body-Smart-User-recognition-and-selection)
2. [Greater Goods Smart Scale](https://greatergoods.com/service/0375)
3. [RENPHO Multiple Users Feature](https://renpho.com/blogs/wellness-fitness-blog/how-to-use-your-smart-scales-multiple-users-feature)
4. [Wyze Scale Multi-User Detection](https://why.wyze.com/scale-with-multi-user-auto-detection-for-family-health-tracking)
5. [lolouk44/xiaomi_mi_scale (GitHub)](https://github.com/lolouk44/xiaomi_mi_scale)
6. [esp32_xiaomi_mi_2_hass (GitHub)](https://github.com/rando-calrissian/esp32_xiaomi_mi_2_hass)
7. [Bioimpedance Fingerprint Research (Nature)](https://www.nature.com/articles/s41598-019-49792-9)
8. [Soft Biometrics Research (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0167865505002345)
