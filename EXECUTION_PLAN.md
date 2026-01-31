# TheScale App - Parallel Execution Plan

## Plan równoległego wykonania zadań przez agentów

---

## 1. Mapa Zależności Warstw

```
                    ┌─────────────────────────────────────────────────┐
                    │                 PHASE 0: SETUP                   │
                    │     Project initialization (sequential)          │
                    └─────────────────────┬───────────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              ▼                           ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│     PHASE 1A            │ │     PHASE 1B            │ │     PHASE 1C            │
│   DOMAIN LAYER          │ │   INFRASTRUCTURE        │ │   INFRASTRUCTURE        │
│   (Calculations)        │ │   (Storage)             │ │   (BLE Research)        │
│   ───────────────       │ │   ───────────────       │ │   ───────────────       │
│   ✓ Zero dependencies   │ │   ✓ Zero dependencies   │ │   ✓ Zero dependencies   │
│   ✓ Pure functions      │ │   ✓ JSON file ops       │ │   ✓ BLE protocol study  │
│   ✓ 100% testable       │ │   ✓ File validation     │ │   ✓ Decryption impl     │
└───────────┬─────────────┘ └───────────┬─────────────┘ └───────────┬─────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        │
                                        ▼
              ┌─────────────────────────────────────────────────────┐
              │                    PHASE 2                          │
              │              APPLICATION LAYER                      │
              │     (Depends on Domain + Infrastructure Ports)      │
              └─────────────────────────┬───────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
      ┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
      │     PHASE 3A        │ │    PHASE 3B     │ │     PHASE 3C        │
      │   PRESENTATION      │ │  INTEGRATION    │ │   TESTING           │
      │   (UI Components)   │ │  (IPC/Preload)  │ │   (Integration)     │
      └─────────────────────┘ └─────────────────┘ └─────────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                                        ▼
              ┌─────────────────────────────────────────────────────┐
              │                    PHASE 4                          │
              │              POLISH & RELEASE                       │
              └─────────────────────────────────────────────────────┘
```

---

## 2. Szczegółowy Plan Zadań

### PHASE 0: Project Setup (Sequential - BLOCKER)

| ID | Zadanie | Agent Type | Polecenie | Zależności |
|----|---------|------------|-----------|------------|
| 0.1 | Init TypeScript project | `Bash` | `npm init -y && npm install typescript @types/node --save-dev && npx tsc --init` | - |
| 0.2 | Install dependencies | `Bash` | Zobacz sekcja 3.1 | 0.1 |
| 0.3 | Create directory structure | `Bash` | Zobacz sekcja 3.2 | 0.1 |
| 0.4 | Configure Vitest | `Write` | Plik `vitest.config.ts` | 0.2 |
| 0.5 | Configure ESLint | `Write` | Plik `.eslintrc.json` | 0.2 |
| 0.6 | Configure Tailwind | `Bash` | `npx tailwindcss init -p` | 0.2 |

---

### PHASE 1A: Domain Layer - Calculations (PARALLEL)

**Agent Type:** `Task` z `subagent_type: "general-purpose"` lub dedykowany

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 1A.1 | Types & Interfaces | `src/domain/calculations/types.ts` | 0.* | 1B.*, 1C.* |
| 1A.2 | Constants (healthy ranges) | `src/domain/calculations/constants.ts` | 0.* | 1B.*, 1C.* |
| 1A.3 | BMI calculations | `src/domain/calculations/bmi/index.ts` | 1A.1 | 1A.4-1A.8, 1B.*, 1C.* |
| 1A.4 | Body Fat formulas | `src/domain/calculations/body-fat/*.ts` | 1A.1 | 1A.3, 1A.5-1A.8, 1B.*, 1C.* |
| 1A.5 | BMR formulas | `src/domain/calculations/bmr/*.ts` | 1A.1 | 1A.3-1A.4, 1A.6-1A.8, 1B.*, 1C.* |
| 1A.6 | Body Water formulas | `src/domain/calculations/body-water/*.ts` | 1A.1 | 1A.3-1A.5, 1A.7-1A.8, 1B.*, 1C.* |
| 1A.7 | Lean Body Mass | `src/domain/calculations/lean-body-mass/*.ts` | 1A.1 | 1A.3-1A.6, 1A.8, 1B.*, 1C.* |
| 1A.8 | Visceral Fat | `src/domain/calculations/visceral-fat/*.ts` | 1A.1 | 1A.3-1A.7, 1B.*, 1C.* |
| 1A.9 | Health Assessment | `src/domain/calculations/health-assessment/*.ts` | 1A.1, 1A.2 | 1B.*, 1C.* |
| 1A.10 | Aggregator (calculateAllMetrics) | `src/domain/calculations/index.ts` | 1A.3-1A.9 | - |
| 1A.11 | Unit Tests | `src/domain/calculations/__tests__/*.ts` | 1A.3-1A.10 | - |
| 1A.12 | Validators | `src/domain/validators/*.ts` | 1A.1 | 1B.*, 1C.* |

---

### PHASE 1B: Infrastructure - Storage (PARALLEL z 1A)

**Agent Type:** `Task` z `subagent_type: "general-purpose"`

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 1B.1 | Storage interfaces (ports) | `src/application/ports/MeasurementRepository.ts`, `src/application/ports/ProfileRepository.ts` | 0.* | 1A.*, 1C.* |
| 1B.2 | File utilities | `src/infrastructure/storage/file-utils.ts` | 0.* | 1A.*, 1C.* |
| 1B.3 | JSON File Repository | `src/infrastructure/storage/JsonFileRepository.ts` | 1B.1, 1B.2 | 1A.*, 1C.* |
| 1B.4 | Settings storage | `src/infrastructure/storage/SettingsRepository.ts` | 1B.2 | 1A.*, 1C.* |
| 1B.5 | Storage tests | `src/infrastructure/storage/__tests__/*.ts` | 1B.3, 1B.4 | 1A.* |

---

### PHASE 1C: Infrastructure - BLE (PARALLEL z 1A, 1B)

**Agent Type:** `Task` z `subagent_type: "general-purpose"` + research

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 1C.1 | BLE Port interface | `src/application/ports/BLEPort.ts` | 0.* | 1A.*, 1B.* |
| 1C.2 | BLE State definitions | `src/domain/ble-states.ts` | 0.* | 1A.*, 1B.* |
| 1C.3 | Error handler | `src/infrastructure/ble/error-handler.ts` | 1C.1 | 1A.*, 1B.* |
| 1C.4 | Retry handler | `src/infrastructure/ble/retry-handler.ts` | 0.* | 1A.*, 1B.* |
| 1C.5 | S400 Protocol Parser | `src/infrastructure/ble/S400Parser.ts` | Research | 1A.*, 1B.* |
| 1C.6 | MiBeacon Decryptor | `src/infrastructure/ble/Decryptor.ts` | Research + crypto-js | 1A.*, 1B.* |
| 1C.7 | Noble/WebBluetooth Adapter | `src/infrastructure/ble/BLEAdapter.ts` | 1C.1, 1C.5, 1C.6 | 1A.* |
| 1C.8 | BLE tests (mocked) | `src/infrastructure/ble/__tests__/*.ts` | 1C.7 | 1A.* |

---

### PHASE 2: Application Layer (REQUIRES: Phase 1 completed)

**Agent Type:** `Task` z `subagent_type: "general-purpose"`

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 2.1 | MeasurementService | `src/application/services/MeasurementService.ts` | 1A.10, 1B.1, 1C.1 | 2.2, 2.3 |
| 2.2 | ProfileService | `src/application/services/ProfileService.ts` | 1B.1 | 2.1, 2.3 |
| 2.3 | ReportService | `src/application/services/ReportService.ts` | 1A.9, 1A.10 | 2.1, 2.2 |
| 2.4 | Use Cases | `src/application/use-cases/*.ts` | 2.1, 2.2, 2.3 | - |
| 2.5 | Application tests | `src/application/__tests__/*.ts` | 2.4 | - |

---

### PHASE 3A: Presentation Layer - UI (PARALLEL po Phase 2)

**Agent Type:** `Task` z `subagent_type: "frontend-developer"` lub `"fullstack-developer"`

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 3A.1 | App shell & routing | `src/presentation/App.tsx` | 2.* | 3B.*, 3C.* |
| 3A.2 | State management (Zustand) | `src/presentation/stores/*.ts` | 2.* | 3A.1, 3B.*, 3C.* |
| 3A.3 | Dashboard Tab | `src/presentation/components/Tabs/Dashboard.tsx` | 3A.2 | 3A.4-3A.8 |
| 3A.4 | Measurement Tab | `src/presentation/components/Tabs/Measurement.tsx` | 3A.2 | 3A.3, 3A.5-3A.8 |
| 3A.5 | History Tab | `src/presentation/components/Tabs/History.tsx` | 3A.2 | 3A.3-3A.4, 3A.6-3A.8 |
| 3A.6 | Trends Tab | `src/presentation/components/Tabs/Trends.tsx` | 3A.2 | 3A.3-3A.5, 3A.7-3A.8 |
| 3A.7 | Analysis Tab | `src/presentation/components/Tabs/Analysis.tsx` | 3A.2 | 3A.3-3A.6, 3A.8 |
| 3A.8 | Settings Tab | `src/presentation/components/Tabs/Settings.tsx` | 3A.2 | 3A.3-3A.7 |
| 3A.9 | Charts components | `src/presentation/components/Charts/*.tsx` | recharts | 3A.3-3A.8 |
| 3A.10 | UI components | `src/presentation/components/UI/*.tsx` | tailwind | 3A.3-3A.9 |

---

### PHASE 3B: Integration - IPC Bridge (PARALLEL po Phase 2)

**Agent Type:** `Task` z `subagent_type: "fullstack-developer"`

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 3B.1 | IPC type definitions | `src/shared/ipc-types.ts` | 2.* | 3A.*, 3C.* |
| 3B.2 | Preload script | `src/main/preload.ts` | 3B.1 | 3A.*, 3C.* |
| 3B.3 | IPC handlers (main) | `src/main/ipc-handlers.ts` | 2.*, 3B.1 | 3A.*, 3C.* |
| 3B.4 | Main process | `src/main/main.ts` | 3B.2, 3B.3 | 3A.*, 3C.* |

---

### PHASE 3C: Testing - Integration (PARALLEL po Phase 2)

**Agent Type:** `Task` z `subagent_type: "general-purpose"`

| ID | Zadanie | Pliki | Zależności | Może być równoległe z |
|----|---------|-------|------------|----------------------|
| 3C.1 | Integration test setup | `tests/integration/setup.ts` | 2.* | 3A.*, 3B.* |
| 3C.2 | Measurement flow tests | `tests/integration/measurement-flow.test.ts` | 3C.1 | 3A.*, 3B.* |
| 3C.3 | Profile flow tests | `tests/integration/profile-flow.test.ts` | 3C.1 | 3A.*, 3B.* |

---

### PHASE 4: Polish & Release (Sequential)

| ID | Zadanie | Agent Type | Zależności |
|----|---------|------------|------------|
| 4.1 | E2E tests (Playwright) | `test-automator` | 3A.*, 3B.* |
| 4.2 | Dark/Light theme | `frontend-developer` | 3A.* |
| 4.3 | Export CSV/PDF | `fullstack-developer` | 2.*, 3A.* |
| 4.4 | Electron Builder config | `Bash` | 3B.4 |
| 4.5 | Documentation | `Write` | All |

---

## 3. Polecenia do Wykonania

### 3.1 Install Dependencies (Phase 0.2)

```bash
npm install \
  react@^18.2.0 \
  react-dom@^18.2.0 \
  zustand@^4.4.7 \
  recharts@^2.10.3 \
  uuid@^9.0.1 \
  dayjs@^1.11.10 \
  zod@^3.22.4 \
  crypto-js@^4.2.0 \
  electron-store@^8.1.0 \
  electron-log@^5.0.3

npm install --save-dev \
  electron@^28.0.0 \
  electron-vite@^2.0.0 \
  electron-builder@^24.9.1 \
  typescript@^5.3.3 \
  @types/react@^18.2.45 \
  @types/react-dom@^18.2.18 \
  @types/node@^20.10.5 \
  @types/crypto-js@^4.2.1 \
  @types/uuid@^9.0.7 \
  vitest@^1.1.1 \
  @vitest/coverage-v8@^1.1.1 \
  @testing-library/react@^14.1.2 \
  @playwright/test@^1.40.1 \
  tailwindcss@^3.4.0 \
  postcss@^8.4.32 \
  autoprefixer@^10.4.16 \
  eslint@^8.56.0 \
  @typescript-eslint/eslint-plugin@^6.16.0 \
  @typescript-eslint/parser@^6.16.0
```

### 3.2 Create Directory Structure (Phase 0.3)

```bash
mkdir -p src/{domain/{calculations/{body-fat,body-water,lean-body-mass,bmr,bmi,visceral-fat,health-assessment,__tests__},entities,validators},application/{services,ports,use-cases,__tests__},infrastructure/{ble,storage},presentation/{components/{Tabs,Charts,UI},stores,hooks,styles},main,shared}

mkdir -p tests/{integration,e2e}
mkdir -p data/{measurements,profiles}
```

---

## 4. Parallel Execution Groups

### GROUP A: Można uruchomić natychmiast po Phase 0

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION GROUP A                                      │
│                                                                  │
│  Agent 1 (Domain):        1A.1 → 1A.3 → 1A.4 → 1A.5            │
│  Agent 2 (Domain):        1A.1 → 1A.6 → 1A.7 → 1A.8            │
│  Agent 3 (Storage):       1B.1 → 1B.2 → 1B.3 → 1B.4            │
│  Agent 4 (BLE Research):  1C.1 → 1C.2 → 1C.5 → 1C.6            │
│                                                                  │
│  ⏱️ Szacowany czas: najdłuższa ścieżka = ~4-6h                  │
└─────────────────────────────────────────────────────────────────┘
```

### GROUP B: Po zakończeniu Group A (synchronizacja)

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION GROUP B                                      │
│                                                                  │
│  Agent 1 (Domain):        1A.9 → 1A.10 → 1A.11                  │
│  Agent 2 (Storage):       1B.5                                   │
│  Agent 3 (BLE):           1C.3 → 1C.4 → 1C.7 → 1C.8            │
│                                                                  │
│  ⏱️ Szacowany czas: ~2-4h                                       │
└─────────────────────────────────────────────────────────────────┘
```

### GROUP C: Po zakończeniu Group B

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION GROUP C                                      │
│                                                                  │
│  Agent 1 (App Services):  2.1 ──┐                               │
│  Agent 2 (App Services):  2.2 ──┼→ 2.4 → 2.5                    │
│  Agent 3 (App Services):  2.3 ──┘                               │
│                                                                  │
│  ⏱️ Szacowany czas: ~3-4h                                       │
└─────────────────────────────────────────────────────────────────┘
```

### GROUP D: Po zakończeniu Group C

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL EXECUTION GROUP D                                      │
│                                                                  │
│  Agent 1 (UI):       3A.1 → 3A.2 → 3A.3/3A.4/3A.5 (parallel)   │
│  Agent 2 (UI):       3A.6/3A.7/3A.8 → 3A.9 → 3A.10             │
│  Agent 3 (IPC):      3B.1 → 3B.2 → 3B.3 → 3B.4                 │
│  Agent 4 (Tests):    3C.1 → 3C.2 → 3C.3                        │
│                                                                  │
│  ⏱️ Szacowany czas: ~6-8h                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Polecenia Task dla Agentów

### 5.1 Uruchomienie Phase 0 (Sequential)

```
/sc:task "Setup TypeScript project with Electron, React, Vitest.
Install all dependencies from EXECUTION_PLAN.md section 3.1.
Create directory structure from section 3.2.
Configure vitest.config.ts, tsconfig.json, tailwind.config.js"
```

### 5.2 Uruchomienie Group A (Parallel - 4 agenty)

**Agent 1 - Domain Types & BMI/Body Fat:**
```
/sc:implement "Implement Domain Layer calculations Part 1:
- src/domain/calculations/types.ts (UserProfile, RawMeasurement, CalculatedMetrics interfaces)
- src/domain/calculations/constants.ts (healthy ranges, thresholds)
- src/domain/calculations/bmi/index.ts (calculateBMI, interpretBMI)
- src/domain/calculations/body-fat/deurenberg.ts (Deurenberg 1991, 1992 formulas)
- src/domain/calculations/body-fat/gallagher.ts (Gallagher formula with ethnicity)
Use ARCHITECTURE.md for exact formulas and scientific citations.
All functions must be PURE with zero external dependencies."
```

**Agent 2 - Domain BMR/Body Water/LBM:**
```
/sc:implement "Implement Domain Layer calculations Part 2:
- src/domain/calculations/bmr/mifflin-st-jeor.ts
- src/domain/calculations/bmr/harris-benedict.ts
- src/domain/calculations/bmr/katch-mcardle.ts
- src/domain/calculations/body-water/hume-weyers.ts
- src/domain/calculations/lean-body-mass/boer.ts
Use ARCHITECTURE.md for exact formulas. Pure functions only."
```

**Agent 3 - Infrastructure Storage:**
```
/sc:implement "Implement Storage Infrastructure:
- src/application/ports/MeasurementRepository.ts (interface)
- src/application/ports/ProfileRepository.ts (interface)
- src/infrastructure/storage/file-utils.ts (ensureDir, readJSON, writeJSON)
- src/infrastructure/storage/JsonFileRepository.ts (implements MeasurementRepository)
Use Zod for validation. Store in data/measurements/ directory."
```

**Agent 4 - Infrastructure BLE Interfaces:**
```
/sc:implement "Implement BLE Infrastructure foundation:
- src/application/ports/BLEPort.ts (interface with states and errors)
- src/domain/ble-states.ts (BLE_STATE_MESSAGES)
- src/infrastructure/ble/error-handler.ts (BLE_ERRORS with suggestions)
- src/infrastructure/ble/retry-handler.ts (withRetry exponential backoff)
Use ARCHITECTURE.md section 5 for exact specifications."
```

### 5.3 Uruchomienie Group B (Po synchronizacji A)

**Agent 1 - Domain Aggregator & Tests:**
```
/sc:implement "Complete Domain Layer:
- src/domain/calculations/visceral-fat/index.ts
- src/domain/calculations/health-assessment/ranges.ts
- src/domain/calculations/health-assessment/scoring.ts
- src/domain/calculations/health-assessment/recommendations.ts
- src/domain/calculations/index.ts (calculateAllMetrics aggregator)
- Write comprehensive tests in __tests__/ with Vitest
Target: 95% code coverage"
```

**Agent 2 - BLE Implementation:**
```
/sc:implement "Implement BLE S400 integration:
- src/infrastructure/ble/S400Parser.ts (parse MiBeacon data)
- src/infrastructure/ble/Decryptor.ts (AES decryption with crypto-js)
- src/infrastructure/ble/BLEAdapter.ts (Web Bluetooth API implementation)
Reference: https://github.com/mnm-matin/miscale for protocol details"
```

### 5.4 Uruchomienie Group C (Application Layer)

```
/sc:implement "Implement Application Layer services:
- src/application/services/MeasurementService.ts
- src/application/services/ProfileService.ts
- src/application/services/ReportService.ts
- src/application/use-cases/CaptureMeasurement.ts
- src/application/use-cases/ViewHistory.ts
Services orchestrate Domain calculations and Infrastructure ports.
Write integration tests."
```

### 5.5 Uruchomienie Group D (Parallel - 4 agenty)

**Agent 1 - UI Core:**
```
/sc:implement "Build React UI foundation:
- src/presentation/App.tsx (main app with tab navigation)
- src/presentation/stores/measurementStore.ts (Zustand)
- src/presentation/stores/profileStore.ts
- src/presentation/components/Tabs/Dashboard.tsx
- src/presentation/components/Tabs/Measurement.tsx
Use Tailwind for styling. Follow PLAN_IMPLEMENTACJI.md section 6 for UI specs."
```

**Agent 2 - UI Tabs:**
```
/sc:implement "Build remaining UI tabs:
- src/presentation/components/Tabs/History.tsx (sortable table, filters)
- src/presentation/components/Tabs/Trends.tsx (Recharts line charts)
- src/presentation/components/Tabs/Analysis.tsx (body composition breakdown)
- src/presentation/components/Tabs/Settings.tsx (profile, BLE config)"
```

**Agent 3 - IPC Bridge:**
```
/sc:implement "Implement Electron IPC:
- src/shared/ipc-types.ts (type-safe IPC contracts)
- src/main/preload.ts (contextBridge API)
- src/main/ipc-handlers.ts (handle measurement, profile, settings)
- src/main/main.ts (Electron main with security settings)
Follow Electron security best practices from GAP_ANALYSIS.md section 5.3"
```

**Agent 4 - Integration Tests:**
```
/sc:test "Write integration tests:
- tests/integration/measurement-flow.test.ts
- tests/integration/profile-flow.test.ts
Test full flow from BLE mock to storage to UI state"
```

---

## 6. Krytyczne Ścieżki i Blokery

### Critical Path (najdłuższa sekwencja):
```
0.* → 1A.1 → 1A.10 → 2.4 → 3B.4 → 4.1
     (setup) (domain) (app) (main) (e2e)
```

### Potencjalne Blokery:
1. **BLE Protocol Research (1C.5, 1C.6)** - może wymagać więcej czasu na reverse engineering
2. **Web Bluetooth vs Noble** - decyzja technologiczna wpływa na 1C.7
3. **Domain Formulas Validation** - wymagana walidacja z rzeczywistymi danymi

### Mitygacja:
- Rozpocznij 1C.5/1C.6 wcześnie (research)
- Użyj mocków BLE do czasu implementacji prawdziwego adaptera
- Przygotuj test fixtures z oczekiwanymi wynikami obliczeń

---

## 7. Monitoring Postępu

### Checkpoints:

| Milestone | Zadania | Weryfikacja |
|-----------|---------|-------------|
| M1: Domain Ready | 1A.* complete | `npm run test -- src/domain` passes, coverage > 95% |
| M2: Infrastructure Ready | 1B.*, 1C.* complete | Storage tests pass, BLE mocks work |
| M3: Application Ready | 2.* complete | Integration tests pass |
| M4: UI Ready | 3A.*, 3B.* complete | App launches, tabs navigate |
| M5: Release Ready | 4.* complete | E2E tests pass, build works |

---

**Dokument przygotowany:** 2025-01-30
**Na podstawie:** PLAN_IMPLEMENTACJI.md, ARCHITECTURE.md, GAP_ANALYSIS.md
**Poziom pewności:** 85%
