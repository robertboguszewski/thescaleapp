# TheScale App - TODO

> Last updated: 2026-01-31

---

## 🚫 Out of Scope (Never Implement)

| Task | Reason |
|------|--------|
| User authentication (PIN/password) | Not in scope |
| Data encryption at-rest | Not in scope |
| Secure BLE Key storage | Not in scope |
| GDPR compliance - export/delete all data | Not in scope |
| Electron security hardening | Not in scope |

---

## ✅ Completed

### Phase 0: Setup
- [x] Project structure (Electron + React + TypeScript)
- [x] Dependencies installed (zustand, recharts, zod, dayjs, etc.)
- [x] Vitest configured
- [x] Tailwind CSS configured

### Phase 1A: Domain Calculations
- [x] Types & interfaces
- [x] BMI calculations
- [x] Body fat formulas (Deurenberg, Gallagher)
- [x] BMR formulas (Mifflin-St Jeor, Harris-Benedict, Katch-McArdle)
- [x] Body water calculations (Hume-Weyers)
- [x] Lean body mass (Boer)
- [x] Visceral fat calculations
- [x] Health assessment & scoring
- [x] Unit tests (95%+ coverage)

### Phase 1B: Infrastructure - Storage
- [x] MeasurementRepository interface & implementation
- [x] ProfileRepository interface & implementation
- [x] AppConfigStore
- [x] File utilities
- [x] Storage tests

### Phase 1C: Infrastructure - BLE
- [x] BLEPort interface
- [x] BLE states definitions
- [x] Error handler with suggestions
- [x] Retry handler (exponential backoff)
- [x] S400 Parser
- [x] MiBeacon Decryptor
- [x] WebBluetoothAdapter
- [x] NativeBLEPort (Noble)
- [x] BLE tests

### Phase 2: Application Layer
- [x] MeasurementService
- [x] ProfileService
- [x] ReportService
- [x] BackupService
- [x] ProfileMatchingService
- [x] Use cases (CaptureMeasurement, ViewHistory, GenerateReport)
- [x] Integration tests

### Phase 3A: Presentation - UI
- [x] App shell with tab navigation
- [x] Zustand stores (measurement, profile, BLE, app, xiaomi)
- [x] Dashboard with metric cards
- [x] Measurement panel with BLE status
- [x] History list with filters
- [x] Trends charts (Recharts)
- [x] Settings (profiles, device, appearance)
- [x] Common components (Button, Card, LoadingSpinner, ErrorMessage)

### Phase 3B: IPC Bridge
- [x] IPC type definitions
- [x] Preload script (contextBridge)
- [x] IPC handlers
- [x] Main process with DI container

### Previously P1/P2 (Now Complete)
- [x] **Onboarding flow** - `useSetupStatus` hook + `SetupStatus` component
- [x] **Health alerts/recommendations** - `SmartRecommendations` component
- [x] **Notification system** - Full support in appStore (success, error, warning, info)
- [x] **Dark/Light theme** - `isDarkMode` with persistence in appStore
- [x] **Report generation** - `ReportService` with trends & recommendations

---

## 📋 Pending Tasks

### 🟠 P1: High Priority

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Profile deletion confirmation dialog | ⚠️ Partial | Delete works but needs confirmation modal |
| 2 | Profile switching guard during measurement | ⚠️ Partial | `ProfileSelectionDialog` exists, needs review |
| 3 | Timestamp handling verification (UTC) | ❓ Unknown | Need to verify timezone handling |

### 🟡 P2: Medium Priority (Before Release)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4 | E2E tests (Playwright) | ❌ Not started | No `tests/e2e` directory |
| 5 | CSV export | ❌ Not started | Report generation exists, needs export |
| 6 | PDF export | ❌ Not started | Requires PDF library |
| 7 | Performance optimization | ❌ Not started | Lazy loading, virtualized lists |
| 8 | Accessibility (a11y) | ❌ Not started | ARIA labels, keyboard navigation |
| 9 | Electron Builder config | ❌ Not started | Package for macOS distribution |
| 10 | Comparison view (vs last week) | ❌ Not started | |
| 11 | Goals progress tracking UI | ⚠️ Partial | Goals in profile, no progress UI |

### 🟢 P3: Low Priority (Nice to Have)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Keyboard shortcuts | ❌ Not started | |
| 13 | macOS widget | ❌ Not started | |
| 14 | Data sync between devices | ❌ Not started | |
| 15 | Theme customization (beyond dark/light) | ❌ Not started | |
| 16 | Measurement reminders | ❌ Not started | |

---

## 📊 Progress Summary

| Category | Status |
|----------|--------|
| Core functionality | ✅ 100% |
| BLE integration | ✅ 100% |
| UI/UX | ✅ 90% |
| Testing (unit/integration) | ✅ 85% |
| Testing (E2E) | ❌ 0% |
| Release readiness | ⚠️ 70% |

---

## Notes

- Security features (auth, encryption) explicitly excluded from scope
- App is functional for personal use
- Missing E2E tests and build config for production release
