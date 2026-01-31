# TheScale App - Deep Architecture Design

## Dokument przeglądu architektury z naciskiem na izolację, testowalność i obsługę błędów

---

## 1. Architektura Warstwowa (Clean Architecture)

### 1.1 Diagram Warstw

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   React UI      │  │   Components    │  │   State Management      │  │
│  │   (Renderer)    │  │   (Views)       │  │   (Context/Zustand)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                        │                │
│           └────────────────────┼────────────────────────┘                │
│                                │                                          │
├────────────────────────────────┼──────────────────────────────────────────┤
│                                │  IPC Bridge (Preload)                    │
├────────────────────────────────┼──────────────────────────────────────────┤
│                                ▼                                          │
│                        APPLICATION LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Use Cases     │  │   Services      │  │   Event Handlers        │  │
│  │                 │  │   (Facades)     │  │                         │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                        │                │
├───────────┼────────────────────┼────────────────────────┼────────────────┤
│           ▼                    ▼                        ▼                │
│                          DOMAIN LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Entities      │  │  Calculations   │  │   Business Rules        │  │
│  │   (Models)      │  │  (PURE)         │  │   (Validators)          │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                          │
│         ⚠️ ZERO DEPENDENCIES - PURE FUNCTIONS - 100% TESTABLE           │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE LAYER                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   BLE Adapter   │  │   Storage       │  │   External APIs         │  │
│  │   (@noble)      │  │   (JSON/SQLite) │  │   (Optional)            │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Zasada Zależności (Dependency Rule)

```
   OUTER → INNER (dozwolone)
   INNER → OUTER (ZABRONIONE)

   Presentation → Application → Domain ← Infrastructure
                                  ↑
                          Infrastructure
```

**Kluczowa zasada:** Domain Layer NIE MA żadnych zależności zewnętrznych.
Jest to **PURE TypeScript/JavaScript** bez importów z:
- Electron
- Node.js APIs
- Zewnętrznych bibliotek
- UI framework

---

## 2. Izolowany Moduł Obliczeń (NAJWAŻNIEJSZY)

### 2.1 Struktura Katalogu

```
src/
└── domain/
    └── calculations/           # 🎯 PURE FUNCTIONS - ZERO DEPENDENCIES
        ├── index.ts           # Public API export
        ├── types.ts           # Typy i interfejsy
        ├── constants.ts       # Stałe (zakresy, progi)
        │
        ├── body-fat/
        │   ├── index.ts
        │   ├── deurenberg.ts      # Deurenberg et al. (1991, 1992)
        │   ├── gallagher.ts       # Gallagher et al. (2000)
        │   ├── eddy.ts            # Eddy et al. (1976)
        │   └── impedance-based.ts # Formuły z impedancją
        │
        ├── body-water/
        │   ├── index.ts
        │   ├── hume-weyers.ts     # Hume & Weyers (1971)
        │   ├── lee-song.ts        # Lee, Song et al. (2001)
        │   └── behnke.ts          # Behnke et al. (1963)
        │
        ├── lean-body-mass/
        │   ├── index.ts
        │   ├── boer.ts            # Boer (1984)
        │   └── hume.ts            # Hume (1966)
        │
        ├── bmr/
        │   ├── index.ts
        │   ├── mifflin-st-jeor.ts # Mifflin-St Jeor (1990)
        │   ├── harris-benedict.ts  # Harris-Benedict (1918)
        │   └── katch-mcardle.ts    # Katch-McArdle (wymaga body fat)
        │
        ├── bmi/
        │   └── index.ts           # WHO BMI calculation
        │
        ├── visceral-fat/
        │   └── index.ts           # Tanita scale interpretation
        │
        ├── health-assessment/
        │   ├── index.ts
        │   ├── ranges.ts          # ACE/ACSM/WHO ranges
        │   ├── scoring.ts         # Body score algorithm
        │   └── recommendations.ts # Evidence-based advice
        │
        └── __tests__/             # 🧪 TESTY JEDNOSTKOWE
            ├── body-fat.test.ts
            ├── body-water.test.ts
            ├── lean-body-mass.test.ts
            ├── bmr.test.ts
            ├── bmi.test.ts
            ├── integration.test.ts
            └── edge-cases.test.ts
```

### 2.2 Implementacja Pure Functions

```typescript
// src/domain/calculations/types.ts

/** Dane wejściowe użytkownika */
export interface UserProfile {
  gender: 'male' | 'female';
  age: number;           // lata (6-80)
  heightCm: number;      // cm (90-220)
  ethnicity?: 'asian' | 'non-asian';
}

/** Surowe dane z wagi */
export interface RawMeasurement {
  weightKg: number;      // kg (0.1-150)
  impedanceOhm?: number; // Ω (opcjonalne)
  heartRateBpm?: number; // bpm (opcjonalne)
}

/** Obliczone metryki */
export interface CalculatedMetrics {
  bmi: number;
  bodyFatPercent: number;
  muscleMassKg: number;
  bodyWaterPercent: number;
  boneMassKg: number;
  visceralFatLevel: number;
  bmrKcal: number;
  leanBodyMassKg: number;
  proteinPercent: number;
  bodyScore: number;
}

/** Konfiguracja formuł */
export interface FormulaConfig {
  bodyFat: 'deurenberg1991' | 'deurenberg1992' | 'gallagher' | 'eddy' | 'impedance';
  bodyWater: 'hume-weyers' | 'lee-song' | 'behnke';
  leanBodyMass: 'boer' | 'hume' | 'direct';
  bmr: 'mifflin-st-jeor' | 'harris-benedict' | 'katch-mcardle';
}
```

```typescript
// src/domain/calculations/body-fat/deurenberg.ts

import { UserProfile, RawMeasurement } from '../types';

/**
 * Deurenberg et al. (1991)
 * "Body mass index as a measure of body fatness"
 * British Journal of Nutrition 65(2): 105-114
 *
 * @pure - No side effects, no external dependencies
 * @tested - See __tests__/body-fat.test.ts
 */
export function calculateBodyFatDeurenberg1991(
  profile: UserProfile,
  measurement: RawMeasurement
): number {
  const bmi = measurement.weightKg / Math.pow(profile.heightCm / 100, 2);

  if (profile.gender === 'male') {
    return (bmi * 1.2) + (profile.age * 0.23) - 16.2;
  } else {
    return (bmi * 1.2) + (profile.age * 0.23) - 5.4;
  }
}

/**
 * Deurenberg (1992) - Age-specific formula
 * Annual Report Nestle Foundation, pp. 35-72
 */
export function calculateBodyFatDeurenberg1992(
  profile: UserProfile,
  measurement: RawMeasurement
): number {
  const bmi = measurement.weightKg / Math.pow(profile.heightCm / 100, 2);
  const isMale = profile.gender === 'male' ? 1 : 0;

  if (profile.age >= 16) {
    return (1.2 * bmi) + (0.23 * profile.age) - (10.8 * isMale) - 5.4;
  } else {
    return (1.294 * bmi) + (0.20 * profile.age) - (11.4 * isMale) - 8.0;
  }
}
```

```typescript
// src/domain/calculations/body-fat/gallagher.ts

import { UserProfile, RawMeasurement } from '../types';

/**
 * Gallagher et al. (2000)
 * "Healthy percentage body fat ranges"
 * American Society for Clinical Nutrition
 *
 * Uwaga: Różne formuły dla Asian vs Non-Asian
 */
export function calculateBodyFatGallagher(
  profile: UserProfile,
  measurement: RawMeasurement
): number {
  const bmi = measurement.weightKg / Math.pow(profile.heightCm / 100, 2);
  const isAsian = profile.ethnicity === 'asian';

  if (profile.gender === 'male') {
    if (isAsian) {
      return 51.9 - (740.0 / bmi) + (0.029 * profile.age);
    } else {
      return 64.5 - (848.0 / bmi) + (0.079 * profile.age) - 16.4 + (0.05 * profile.age) + (39.0 / bmi);
    }
  } else {
    if (isAsian) {
      return 64.8 - (752.0 / bmi) + (0.016 * profile.age);
    } else {
      return 64.5 - (848.0 / bmi) + (0.079 * profile.age);
    }
  }
}
```

```typescript
// src/domain/calculations/bmr/mifflin-st-jeor.ts

import { UserProfile, RawMeasurement } from '../types';

/**
 * Mifflin-St Jeor (1990)
 * Najbardziej dokładna formuła BMR dla ogólnej populacji
 *
 * Male:   BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
 * Female: BMR = (10 × weight) + (6.25 × height) - (5 × age) - 161
 */
export function calculateBMR_MifflinStJeor(
  profile: UserProfile,
  measurement: RawMeasurement
): number {
  const base = (10 * measurement.weightKg) +
               (6.25 * profile.heightCm) -
               (5 * profile.age);

  return profile.gender === 'male' ? base + 5 : base - 161;
}

/**
 * Katch-McArdle (wymaga body fat %)
 * Dokładniejsza dla osób z niestandardową kompozycją ciała
 *
 * BMR = 370 + (21.6 × LBM)
 * gdzie LBM = weight × (1 - bodyFat/100)
 */
export function calculateBMR_KatchMcArdle(
  measurement: RawMeasurement,
  bodyFatPercent: number
): number {
  const lbm = measurement.weightKg * (1 - bodyFatPercent / 100);
  return 370 + (21.6 * lbm);
}
```

### 2.3 Agregator Obliczeń

```typescript
// src/domain/calculations/index.ts

import { UserProfile, RawMeasurement, CalculatedMetrics, FormulaConfig } from './types';
import { calculateBodyFatDeurenberg1992 } from './body-fat/deurenberg';
import { calculateBodyFatGallagher } from './body-fat/gallagher';
import { calculateBodyWaterHumeWeyers } from './body-water/hume-weyers';
import { calculateLBM_Boer } from './lean-body-mass/boer';
import { calculateBMR_MifflinStJeor, calculateBMR_KatchMcArdle } from './bmr/mifflin-st-jeor';
import { calculateBMI, interpretBMI } from './bmi';
import { interpretVisceralFat } from './visceral-fat';
import { calculateBodyScore } from './health-assessment/scoring';

/**
 * GŁÓWNA FUNKCJA OBLICZENIOWA
 * Pure function - łatwa do testowania
 *
 * @param profile - Dane użytkownika
 * @param measurement - Surowe dane z wagi
 * @param config - Wybór formuł (opcjonalne)
 * @returns Wszystkie obliczone metryki
 */
export function calculateAllMetrics(
  profile: UserProfile,
  measurement: RawMeasurement,
  config?: Partial<FormulaConfig>
): CalculatedMetrics {
  // BMI (zawsze ten sam)
  const bmi = calculateBMI(measurement.weightKg, profile.heightCm);

  // Body Fat % - wybór formuły
  let bodyFatPercent: number;
  switch (config?.bodyFat ?? 'deurenberg1992') {
    case 'gallagher':
      bodyFatPercent = calculateBodyFatGallagher(profile, measurement);
      break;
    case 'deurenberg1992':
    default:
      bodyFatPercent = calculateBodyFatDeurenberg1992(profile, measurement);
  }

  // Clamp body fat to realistic range
  bodyFatPercent = Math.max(3, Math.min(60, bodyFatPercent));

  // Lean Body Mass
  const leanBodyMassKg = calculateLBM_Boer(profile, measurement);

  // Muscle Mass (przybliżenie: ~75% LBM)
  const muscleMassKg = leanBodyMassKg * 0.75;

  // Body Water
  const bodyWaterPercent = calculateBodyWaterHumeWeyers(profile, measurement);

  // Bone Mass (przybliżenie: ~4% LBM dla mężczyzn, ~3% dla kobiet)
  const boneRatio = profile.gender === 'male' ? 0.04 : 0.03;
  const boneMassKg = leanBodyMassKg * boneRatio;

  // BMR
  const bmrKcal = config?.bmr === 'katch-mcardle'
    ? calculateBMR_KatchMcArdle(measurement, bodyFatPercent)
    : calculateBMR_MifflinStJeor(profile, measurement);

  // Visceral Fat (szacowanie na podstawie BMI i wieku)
  const visceralFatLevel = estimateVisceralFat(profile, bmi);

  // Protein % (przybliżenie na podstawie muscle mass)
  const proteinPercent = (muscleMassKg / measurement.weightKg) * 100 * 0.22;

  // Body Score
  const bodyScore = calculateBodyScore({
    bmi,
    bodyFatPercent,
    visceralFatLevel,
    muscleMassKg,
    weightKg: measurement.weightKg
  }, profile);

  return {
    bmi: round(bmi, 1),
    bodyFatPercent: round(bodyFatPercent, 1),
    muscleMassKg: round(muscleMassKg, 1),
    bodyWaterPercent: round(bodyWaterPercent, 1),
    boneMassKg: round(boneMassKg, 1),
    visceralFatLevel: Math.round(visceralFatLevel),
    bmrKcal: Math.round(bmrKcal),
    leanBodyMassKg: round(leanBodyMassKg, 1),
    proteinPercent: round(proteinPercent, 1),
    bodyScore: Math.round(bodyScore)
  };
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function estimateVisceralFat(profile: UserProfile, bmi: number): number {
  // Uproszczona formuła - w rzeczywistości zależna od impedancji
  let base = (bmi - 18.5) * 0.5;
  base += (profile.age - 20) * 0.1;
  if (profile.gender === 'male') base += 2;
  return Math.max(1, Math.min(30, base));
}
```

---

## 3. Strategia Testowania Modułu Obliczeń

### 3.1 Struktura Testów

```typescript
// src/domain/calculations/__tests__/body-fat.test.ts

import { describe, it, expect } from 'vitest'; // lub jest
import { calculateBodyFatDeurenberg1991, calculateBodyFatDeurenberg1992 } from '../body-fat/deurenberg';
import { calculateBodyFatGallagher } from '../body-fat/gallagher';

describe('Body Fat Calculations', () => {

  describe('Deurenberg 1991 Formula', () => {
    it('should calculate correctly for adult male', () => {
      const profile = { gender: 'male' as const, age: 35, heightCm: 178 };
      const measurement = { weightKg: 75 };

      const result = calculateBodyFatDeurenberg1991(profile, measurement);

      // BMI = 75 / (1.78)^2 = 23.67
      // BF = (23.67 * 1.2) + (35 * 0.23) - 16.2 = 28.40 + 8.05 - 16.2 = 20.25
      expect(result).toBeCloseTo(20.25, 1);
    });

    it('should calculate correctly for adult female', () => {
      const profile = { gender: 'female' as const, age: 30, heightCm: 165 };
      const measurement = { weightKg: 60 };

      const result = calculateBodyFatDeurenberg1991(profile, measurement);

      // BMI = 60 / (1.65)^2 = 22.04
      // BF = (22.04 * 1.2) + (30 * 0.23) - 5.4 = 26.45 + 6.9 - 5.4 = 27.95
      expect(result).toBeCloseTo(27.95, 1);
    });
  });

  describe('Deurenberg 1992 Formula (Age-specific)', () => {
    it('should use adult formula for age >= 16', () => {
      const profile = { gender: 'male' as const, age: 25, heightCm: 175 };
      const measurement = { weightKg: 70 };

      const result = calculateBodyFatDeurenberg1992(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50);
    });

    it('should use child formula for age < 16', () => {
      const profile = { gender: 'male' as const, age: 14, heightCm: 165 };
      const measurement = { weightKg: 55 };

      const result = calculateBodyFatDeurenberg1992(profile, measurement);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(40);
    });
  });

  describe('Gallagher Formula (Ethnicity-aware)', () => {
    it('should differ between Asian and Non-Asian males', () => {
      const baseProfile = { gender: 'male' as const, age: 30, heightCm: 170 };
      const measurement = { weightKg: 70 };

      const asianResult = calculateBodyFatGallagher(
        { ...baseProfile, ethnicity: 'asian' },
        measurement
      );
      const nonAsianResult = calculateBodyFatGallagher(
        { ...baseProfile, ethnicity: 'non-asian' },
        measurement
      );

      expect(asianResult).not.toEqual(nonAsianResult);
    });
  });
});
```

### 3.2 Testy Edge Cases

```typescript
// src/domain/calculations/__tests__/edge-cases.test.ts

import { describe, it, expect } from 'vitest';
import { calculateAllMetrics } from '../index';

describe('Edge Cases', () => {

  describe('Extreme Weight Values', () => {
    it('should handle minimum weight (20kg)', () => {
      const profile = { gender: 'male' as const, age: 20, heightCm: 170 };
      const measurement = { weightKg: 20 };

      const result = calculateAllMetrics(profile, measurement);

      expect(result.bmi).toBeLessThan(10); // Extremely underweight
      expect(result.bodyFatPercent).toBeGreaterThanOrEqual(3); // Clamped minimum
    });

    it('should handle maximum weight (150kg)', () => {
      const profile = { gender: 'female' as const, age: 50, heightCm: 160 };
      const measurement = { weightKg: 150 };

      const result = calculateAllMetrics(profile, measurement);

      expect(result.bmi).toBeGreaterThan(50); // Extreme obesity
      expect(result.bodyFatPercent).toBeLessThanOrEqual(60); // Clamped maximum
    });
  });

  describe('Extreme Age Values', () => {
    it('should handle child (age 6)', () => {
      const profile = { gender: 'male' as const, age: 6, heightCm: 120 };
      const measurement = { weightKg: 22 };

      const result = calculateAllMetrics(profile, measurement);

      expect(result.bodyScore).toBeDefined();
      expect(result.bmrKcal).toBeGreaterThan(500);
    });

    it('should handle elderly (age 80)', () => {
      const profile = { gender: 'female' as const, age: 80, heightCm: 155 };
      const measurement = { weightKg: 55 };

      const result = calculateAllMetrics(profile, measurement);

      expect(result.bmrKcal).toBeGreaterThan(800);
      expect(result.visceralFatLevel).toBeGreaterThan(1);
    });
  });

  describe('Missing Optional Data', () => {
    it('should work without impedance', () => {
      const profile = { gender: 'male' as const, age: 35, heightCm: 180 };
      const measurement = { weightKg: 80 }; // no impedance

      const result = calculateAllMetrics(profile, measurement);

      expect(result.bodyFatPercent).toBeDefined();
      expect(result.muscleMassKg).toBeDefined();
    });

    it('should work without heart rate', () => {
      const profile = { gender: 'female' as const, age: 28, heightCm: 168 };
      const measurement = { weightKg: 62, impedanceOhm: 500 };

      const result = calculateAllMetrics(profile, measurement);

      expect(result).toBeDefined();
    });
  });

  describe('Numerical Precision', () => {
    it('should not produce NaN or Infinity', () => {
      const profile = { gender: 'male' as const, age: 40, heightCm: 175 };
      const measurement = { weightKg: 75 };

      const result = calculateAllMetrics(profile, measurement);

      Object.values(result).forEach(value => {
        expect(Number.isFinite(value)).toBe(true);
        expect(Number.isNaN(value)).toBe(false);
      });
    });

    it('should round to appropriate precision', () => {
      const profile = { gender: 'female' as const, age: 32, heightCm: 163 };
      const measurement = { weightKg: 58.3 };

      const result = calculateAllMetrics(profile, measurement);

      // BMI should have 1 decimal place
      expect(result.bmi.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
      // BMR should be integer
      expect(Number.isInteger(result.bmrKcal)).toBe(true);
    });
  });
});
```

### 3.3 Konfiguracja Testów

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/domain/calculations/**/*.ts'],
      exclude: ['**/__tests__/**', '**/types.ts', '**/constants.ts'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95
      }
    }
  }
});
```

---

## 4. Service Layer (Application Layer)

### 4.1 Struktura Serwisów

```typescript
// src/application/services/MeasurementService.ts

import { calculateAllMetrics, FormulaConfig } from '../../domain/calculations';
import { UserProfile, RawMeasurement, CalculatedMetrics } from '../../domain/calculations/types';
import { MeasurementRepository } from '../ports/MeasurementRepository';
import { BLEPort } from '../ports/BLEPort';

export interface MeasurementResult {
  id: string;
  timestamp: Date;
  raw: RawMeasurement;
  calculated: CalculatedMetrics;
  userProfileId: string;
}

/**
 * Service Layer - orkiestracja między portami
 * NIE zawiera logiki obliczeniowej (deleguje do Domain)
 */
export class MeasurementService {
  constructor(
    private readonly measurementRepo: MeasurementRepository,
    private readonly blePort: BLEPort,
    private readonly formulaConfig?: Partial<FormulaConfig>
  ) {}

  async captureAndSaveMeasurement(
    userProfile: UserProfile,
    userProfileId: string
  ): Promise<MeasurementResult> {
    // 1. Pobierz dane z BLE
    const rawData = await this.blePort.readMeasurement();

    // 2. Oblicz metryki (delegacja do Domain Layer)
    const calculated = calculateAllMetrics(
      userProfile,
      rawData,
      this.formulaConfig
    );

    // 3. Stwórz wynik
    const result: MeasurementResult = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      raw: rawData,
      calculated,
      userProfileId
    };

    // 4. Zapisz
    await this.measurementRepo.save(result);

    return result;
  }

  async recalculateMeasurement(
    measurementId: string,
    userProfile: UserProfile,
    newConfig?: Partial<FormulaConfig>
  ): Promise<MeasurementResult> {
    const existing = await this.measurementRepo.getById(measurementId);
    if (!existing) throw new Error(`Measurement ${measurementId} not found`);

    // Przelicz z nowymi parametrami
    const recalculated = calculateAllMetrics(
      userProfile,
      existing.raw,
      newConfig ?? this.formulaConfig
    );

    const updated = { ...existing, calculated: recalculated };
    await this.measurementRepo.save(updated);

    return updated;
  }
}
```

### 4.2 Porty (Interfejsy dla Adapterów)

```typescript
// src/application/ports/BLEPort.ts

import { RawMeasurement } from '../../domain/calculations/types';

export type BLEConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'error';

export interface BLEError {
  code: 'BLUETOOTH_OFF' | 'DEVICE_NOT_FOUND' | 'CONNECTION_TIMEOUT' |
        'READ_FAILED' | 'DECRYPTION_FAILED' | 'INVALID_DATA';
  message: string;
  recoverable: boolean;
  suggestion: string;
}

export interface BLEPort {
  getState(): BLEConnectionState;
  onStateChange(callback: (state: BLEConnectionState) => void): () => void;
  onError(callback: (error: BLEError) => void): () => void;

  scan(timeoutMs?: number): Promise<void>;
  connect(deviceMac: string, bleKey: string): Promise<void>;
  disconnect(): Promise<void>;

  readMeasurement(): Promise<RawMeasurement>;

  isDeviceAvailable(): Promise<boolean>;
}
```

```typescript
// src/application/ports/MeasurementRepository.ts

import { MeasurementResult } from '../services/MeasurementService';

export interface MeasurementQuery {
  userProfileId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface MeasurementRepository {
  save(measurement: MeasurementResult): Promise<void>;
  getById(id: string): Promise<MeasurementResult | null>;
  getAll(query?: MeasurementQuery): Promise<MeasurementResult[]>;
  delete(id: string): Promise<void>;
  deleteAll(userProfileId: string): Promise<void>;
  count(query?: MeasurementQuery): Promise<number>;
}
```

---

## 5. Obsługa Błędów BLE i User Feedback

### 5.1 Stany Połączenia i Komunikaty

```typescript
// src/domain/ble-states.ts

export const BLE_STATE_MESSAGES: Record<string, {
  title: string;
  description: string;
  icon: string;
  action?: string;
}> = {
  disconnected: {
    title: 'Rozłączono',
    description: 'Waga nie jest połączona. Naciśnij "Połącz" aby rozpocząć.',
    icon: '📴',
    action: 'Połącz'
  },
  scanning: {
    title: 'Szukam wagi...',
    description: 'Upewnij się, że waga jest włączona i w zasięgu Bluetooth.',
    icon: '🔍'
  },
  connecting: {
    title: 'Łączenie...',
    description: 'Nawiązuję połączenie z wagą. To może potrwać kilka sekund.',
    icon: '🔄'
  },
  connected: {
    title: 'Połączono',
    description: 'Waga jest gotowa. Wejdź na wagę aby rozpocząć pomiar.',
    icon: '✅',
    action: 'Rozpocznij pomiar'
  },
  reading: {
    title: 'Pomiar w toku...',
    description: 'Stój nieruchomo. Czekam na stabilizację wagi.',
    icon: '⏳'
  },
  error: {
    title: 'Błąd',
    description: 'Wystąpił problem z połączeniem.',
    icon: '❌',
    action: 'Spróbuj ponownie'
  }
};
```

### 5.2 Obsługa Błędów z Sugestiami

```typescript
// src/infrastructure/ble/error-handler.ts

import { BLEError } from '../../application/ports/BLEPort';

export const BLE_ERRORS: Record<string, BLEError> = {
  BLUETOOTH_OFF: {
    code: 'BLUETOOTH_OFF',
    message: 'Bluetooth jest wyłączony',
    recoverable: true,
    suggestion: 'Włącz Bluetooth w Ustawieniach systemu (⌘ + Spacja → "Bluetooth")'
  },
  DEVICE_NOT_FOUND: {
    code: 'DEVICE_NOT_FOUND',
    message: 'Nie znaleziono wagi Xiaomi S400',
    recoverable: true,
    suggestion: 'Upewnij się, że:\n• Waga jest włączona (postaw na niej nogę)\n• Jesteś w zasięgu (< 5 metrów)\n• Aplikacja Xiaomi Home jest zamknięta'
  },
  CONNECTION_TIMEOUT: {
    code: 'CONNECTION_TIMEOUT',
    message: 'Przekroczono czas połączenia (30s)',
    recoverable: true,
    suggestion: 'Spróbuj:\n• Wyłączyć i włączyć Bluetooth\n• Podejść bliżej do wagi\n• Usunąć przeszkody między urządzeniami'
  },
  READ_FAILED: {
    code: 'READ_FAILED',
    message: 'Nie udało się odczytać danych z wagi',
    recoverable: true,
    suggestion: 'Waga mogła się rozłączyć. Spróbuj ponownie wykonać pomiar.'
  },
  DECRYPTION_FAILED: {
    code: 'DECRYPTION_FAILED',
    message: 'Błąd deszyfrowania danych',
    recoverable: false,
    suggestion: 'Klucz BLE może być nieprawidłowy. Sprawdź konfigurację w Ustawieniach lub wyeksportuj klucz ponownie z Xiaomi Cloud.'
  },
  INVALID_DATA: {
    code: 'INVALID_DATA',
    message: 'Otrzymano nieprawidłowe dane',
    recoverable: true,
    suggestion: 'Pomiar mógł zostać przerwany. Stój spokojnie przez cały czas pomiaru.'
  }
};
```

### 5.3 Retry Logic z Exponential Backoff

```typescript
// src/infrastructure/ble/retry-handler.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error;
  let delay = config.baseDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      onRetry?.(attempt, lastError, delay);

      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 6. Edge Cases - Pełna Lista

### 6.1 Dane Wejściowe

| Edge Case | Wartość | Obsługa |
|-----------|---------|---------|
| Waga minimalna | 0.1 kg | Akceptuj, ale oznacz jako nietypowa |
| Waga maksymalna | 150 kg | Akceptuj, clamp wyniki |
| Waga = 0 | 0 kg | Odrzuć, błąd walidacji |
| Waga ujemna | < 0 kg | Odrzuć, błąd walidacji |
| Wzrost minimalny | 90 cm | Akceptuj (dziecko) |
| Wzrost maksymalny | 220 cm | Akceptuj |
| Wiek minimalny | 6 lat | Użyj formuł dziecięcych |
| Wiek maksymalny | 80 lat | Akceptuj, uwaga na interpretację |
| Impedancja = 0 | 0 Ω | Użyj formuł bez impedancji |
| Impedancja bardzo wysoka | > 1000 Ω | Oznacz jako potencjalnie błędna |
| Brak tętna | null | Pomiń, nie jest wymagane |

### 6.2 Połączenie BLE

| Edge Case | Scenariusz | Obsługa |
|-----------|------------|---------|
| Bluetooth OFF | System BT wyłączony | Komunikat + instrukcja włączenia |
| Waga poza zasięgiem | > 10m | Timeout + sugestia przybliżenia |
| Waga w trybie parowania | Inna aplikacja | Informacja o zamknięciu innych app |
| Utrata połączenia mid-read | Przerwany pomiar | Retry z backoff |
| Nieprawidłowy BLE Key | Zmieniony klucz | Instrukcja re-eksportu |
| Wiele wag w zasięgu | Konflikt urządzeń | Wybór po MAC address |
| Bateria wagi rozładowana | Słaby sygnał | Sugestia wymiany baterii |

### 6.3 Wyniki Obliczeń

| Edge Case | Warunek | Obsługa |
|-----------|---------|---------|
| Body Fat < 3% | Niemożliwe biologicznie | Clamp do 3% + warning |
| Body Fat > 60% | Ekstremalna otyłość | Clamp do 60% + warning |
| BMI < 10 | Skrajne niedożywienie | Oznacz jako critical |
| BMI > 60 | Ekstremalna otyłość | Oznacz jako critical |
| BMR < 500 kcal | Nierealistyczne | Użyj minimum 500 kcal |
| Muscle Mass > Weight | Błąd obliczeń | Recalculate z inną formułą |
| Visceral Fat > 30 | Bardzo wysokie | Pilne ostrzeżenie zdrowotne |

### 6.4 Przechowywanie Danych

| Edge Case | Scenariusz | Obsługa |
|-----------|------------|---------|
| Dysk pełny | Brak miejsca | Graceful error + cleanup suggestion |
| Plik uszkodzony | Corrupted JSON | Backup + recovery |
| Brak uprawnień | Permission denied | Instrukcja naprawy uprawnień |
| Duplikat pomiaru | Ten sam timestamp | Nadpisz lub odrzuć (konfig) |
| Import z przyszłości | timestamp > now | Ostrzeżenie + akceptuj |

---

## 7. Struktura Katalogów (Finalna)

```
my-electron-app/
├── src/
│   ├── domain/                    # 🎯 PURE - ZERO DEPENDENCIES
│   │   ├── calculations/          # Wszystkie formuły obliczeniowe
│   │   │   ├── __tests__/         # Testy jednostkowe
│   │   │   ├── body-fat/
│   │   │   ├── body-water/
│   │   │   ├── lean-body-mass/
│   │   │   ├── bmr/
│   │   │   ├── bmi/
│   │   │   ├── visceral-fat/
│   │   │   ├── health-assessment/
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── entities/              # Modele domenowe
│   │   │   ├── Measurement.ts
│   │   │   ├── UserProfile.ts
│   │   │   └── HealthReport.ts
│   │   │
│   │   └── validators/            # Reguły biznesowe
│   │       ├── measurement-validator.ts
│   │       └── profile-validator.ts
│   │
│   ├── application/               # Use Cases & Services
│   │   ├── services/
│   │   │   ├── MeasurementService.ts
│   │   │   ├── ProfileService.ts
│   │   │   └── ReportService.ts
│   │   │
│   │   ├── ports/                 # Interfejsy dla adapterów
│   │   │   ├── BLEPort.ts
│   │   │   ├── MeasurementRepository.ts
│   │   │   └── ProfileRepository.ts
│   │   │
│   │   └── use-cases/
│   │       ├── CaptureMeasurement.ts
│   │       ├── ViewHistory.ts
│   │       └── GenerateReport.ts
│   │
│   ├── infrastructure/            # Adaptery (implementacje portów)
│   │   ├── ble/
│   │   │   ├── NobleAdapter.ts    # @abandonware/noble
│   │   │   ├── S400Parser.ts      # Dekodowanie danych S400
│   │   │   ├── Decryptor.ts       # MiBeacon decryption
│   │   │   ├── error-handler.ts
│   │   │   └── retry-handler.ts
│   │   │
│   │   └── storage/
│   │       ├── JsonFileRepository.ts
│   │       └── file-utils.ts
│   │
│   ├── presentation/              # UI (React)
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── styles/
│   │
│   ├── main/                      # Electron Main Process
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── ipc-handlers.ts
│   │
│   └── shared/                    # Współdzielone typy IPC
│       └── ipc-types.ts
│
├── data/                          # Runtime data (gitignored)
│   ├── measurements/
│   ├── profiles/
│   └── settings.json
│
├── tests/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── ARCHITECTURE.md                # Ten dokument
└── PLAN_IMPLEMENTACJI.md
```

---

## 8. Źródła Naukowe (Citations)

### Formuły Body Fat
- Deurenberg P et al. (1991) "Body mass index as a measure of body fatness" - *British Journal of Nutrition* 65(2):105-114
- Deurenberg P (1992) *Annual Report Nestle Foundation*, pp.35-72
- Gallagher D et al. (2000) "Healthy percentage body fat ranges" - *Am J Clin Nutr*
- Eddy TP et al. (1976) *Research into Obesity*, HMSO, p.9

### Formuły BMR
- Mifflin MD & St Jeor ST (1990) "A new predictive equation for resting energy expenditure" - *Am J Clin Nutr* 51:241-247
- Harris JA & Benedict FG (1918) "A Biometric Study of Basal Metabolism in Man" - Carnegie Institution
- Katch F & McArdle WD (1973) *J Appl Physiol* 35:801-804

### Formuły Body Water / LBM
- Hume R & Weyers E (1971) *J Clin Pathol* 24:234-238
- Boer P (1984) *Am J Physiol* 247:F632-F636
- Lee SW et al. (2001) *Nephrol Dial Transplant* 16(1):91-97

### Wytyczne Zdrowotne
- ACE (American Council on Exercise) - Body Fat Guidelines
- ACSM (American College of Sports Medicine) - Body Composition Assessment
- WHO - BMI Classification
- Tanita Europe - Visceral Fat Interpretation

---

## 9. Następne Kroki

1. **Akceptacja architektury** - Review tego dokumentu
2. **Setup projektu** - TypeScript, Vitest, struktura katalogów
3. **Implementacja Domain Layer** - Formuły + testy (100% coverage)
4. **Implementacja Infrastructure** - BLE adapter, JSON storage
5. **Implementacja Application Layer** - Services, Use Cases
6. **Implementacja Presentation** - React UI
7. **Integracja E2E** - Połączenie wszystkich warstw
8. **Testy integracyjne i E2E**

---

**Status:** Gotowy do review
**Poziom pewności:** 85% (wymagana walidacja formuł z danymi rzeczywistymi)
**Data:** 2025-01-30
