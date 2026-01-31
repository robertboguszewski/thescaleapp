# Analysis Module - Design Review Document

## Executive Summary

This design review evaluates the proposed Analysis Module implementation against the existing codebase architecture, identifies reusable components, and provides recommendations for optimal integration.

**Review Date:** 2026-01-31
**Status:** Ready for Implementation
**Risk Level:** Low - Leverages existing patterns and components

---

## 1. Architecture Compatibility Assessment

### 1.1 Current Architecture Alignment

| Layer | Existing Pattern | Analysis Module Compliance |
|-------|------------------|---------------------------|
| **Domain** | Pure calculations, no side effects | ✅ Reuses `scoring.ts`, `recommendations.ts` |
| **Application** | Services with repository injection | ✅ Uses existing `ReportService` |
| **Infrastructure** | IPC handlers, file storage | ✅ Uses `REPORT_GENERATE` IPC handler |
| **Presentation** | React + Zustand + hooks | ✅ Uses `useReport()` hook pattern |

### 1.2 Data Flow Compliance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Analysis Module Data Flow                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   AnalysisPage.tsx                                                   │
│         │                                                             │
│         ▼                                                             │
│   useReport() hook ─────────────► window.electronAPI.generateReport() │
│         │                                    │                        │
│         │                                    ▼                        │
│         │                         IPC: REPORT_GENERATE                │
│         │                                    │                        │
│         │                                    ▼                        │
│         │                         ReportService.generateReport()      │
│         │                                    │                        │
│         │                    ┌───────────────┼───────────────┐        │
│         │                    ▼               ▼               ▼        │
│         │            ProfileRepo    MeasurementRepo    Calculations   │
│         │                    │               │               │        │
│         │                    └───────────────┴───────────────┘        │
│         │                                    │                        │
│         │                                    ▼                        │
│         │◄───────────────────── HealthReport Object                   │
│         │                                                             │
│         ▼                                                             │
│   Components render with HealthReport data                           │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Reusable Components Analysis

### 2.1 Direct Reuse (No Modification)

| Component | Location | Usage in Analysis |
|-----------|----------|-------------------|
| `BodyScoreGauge` | `dashboard/BodyScoreGauge.tsx` | HealthScoreCard hero metric |
| `MetricCard` | `dashboard/MetricCard.tsx` | Body composition grid cards |
| `Card` | `common/Card.tsx` | Base container for all cards |
| `useReport` | `hooks/useReport.ts` | Data fetching and state |

### 2.2 BodyScoreGauge Features Available

```typescript
// Already implemented:
- Circular progress gauge (0-100)
- Color gradient animation
- Score category labels (Excellent/VeryGood/Good/Fair/Poor)
- Animated score counting
- Customizable size and strokeWidth

// Props interface:
interface BodyScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabels?: boolean;
  className?: string;
}
```

### 2.3 MetricCard Features Available

```typescript
// Already implemented:
- Status indicators: 'good' | 'warning' | 'critical' | 'neutral'
- Trend direction: 'up' | 'down' | 'stable'
- Icon support
- Color coding by status
- Trend value display

// Props interface:
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: MetricStatus;
  trend?: TrendDirection;
  trendValue?: string;
  icon?: React.ReactNode;
  description?: string;
  onClick?: () => void;
}
```

### 2.4 useReport Hook Interface

```typescript
interface UseReportReturn {
  // State
  report: HealthReport | null;
  trends: MetricTrends | null;
  recommendations: HealthRecommendation[];
  quickSummary: { bodyScore: number; status: string } | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  generateReport: (profileId?: string) => Promise<HealthReport | null>;
  generateReportForCurrentProfile: () => Promise<HealthReport | null>;
  getQuickSummary: (profileId?: string) => Promise<...>;
  clearReport: () => void;
  clearError: () => void;
}
```

---

## 3. New Components Required

### 3.1 Component Hierarchy

```
src/presentation/components/analysis/
├── AnalysisPage.tsx              # Main container (NEW - replace placeholder)
├── HealthScoreCard.tsx           # Hero card wrapping BodyScoreGauge (NEW)
├── BodyCompositionPanel.tsx      # 2x3 MetricCard grid (NEW)
├── MetabolicHealthCard.tsx       # BMR, Visceral, BMI display (NEW)
├── RiskAssessmentCard.tsx        # Health risk indicators (NEW)
├── TrendsComparisonCard.tsx      # Progress tracking (NEW)
├── RecommendationsPanel.tsx      # Actionable advice (NEW)
└── index.ts                      # Barrel exports (NEW)
```

### 3.2 Component Specifications

#### AnalysisPage.tsx
```typescript
// Responsibilities:
// - Orchestrate data loading via useReport()
// - Handle loading/error states
// - Layout all child components
// - Trigger report generation on profile selection

const AnalysisPage: React.FC = () => {
  const { report, isLoading, error, generateReportForCurrentProfile } = useReport();
  const currentProfile = useCurrentProfile();

  useEffect(() => {
    if (currentProfile?.id) {
      generateReportForCurrentProfile();
    }
  }, [currentProfile?.id]);

  // Render components with report data
};
```

#### HealthScoreCard.tsx
```typescript
// Wraps BodyScoreGauge + adds score breakdown bars
interface HealthScoreCardProps {
  score: number;
  breakdown: {
    bmi: number;
    bodyFat: number;
    visceral: number;
    muscle: number;
  };
}
```

#### BodyCompositionPanel.tsx
```typescript
// Uses existing MetricCard in 2x3 grid
interface BodyCompositionPanelProps {
  metrics: {
    bodyFat: { value: number; status: MetricStatus; trend: TrendDirection };
    muscleMass: { value: number; status: MetricStatus; trend: TrendDirection };
    bodyWater: { value: number; status: MetricStatus; trend: TrendDirection };
    boneMass: { value: number; status: MetricStatus; trend: TrendDirection };
    protein: { value: number; status: MetricStatus; trend: TrendDirection };
    leanMass: { value: number; status: MetricStatus; trend: TrendDirection };
  };
}
```

---

## 4. Data Requirements

### 4.1 HealthReport Structure (Existing)

```typescript
interface HealthReport {
  profileId: string;
  profileName: string;
  generatedAt: Date;
  latestMeasurement: MeasurementResult;
  trends: MetricTrends;
  recommendations: HealthRecommendation[];
  summary: ReportSummary;
}

interface ReportSummary {
  bodyScore: number;
  overallStatus: 'excellent' | 'good' | 'fair' | 'poor';
  keyInsight: string;
}

interface MetricTrends {
  period: string;
  measurementCount: number;
  weightChange: number;
  bodyFatChange: number;
  muscleChange: number;
}
```

### 4.2 Mapping Report Data to Components

| Component | Data Source | Fields Used |
|-----------|-------------|-------------|
| HealthScoreCard | `report.summary` | `bodyScore`, `overallStatus` |
| BodyCompositionPanel | `report.latestMeasurement.calculated` | All metrics |
| MetabolicHealthCard | `report.latestMeasurement.calculated` | `bmrKcal`, `visceralFatLevel`, `bmi` |
| TrendsComparisonCard | `report.trends` | All trend fields |
| RecommendationsPanel | `report.recommendations` | Full array |

---

## 5. Styling Guidelines

### 5.1 Existing Design Tokens

```css
/* Status Colors (from MetricCard) */
--status-good: text-green-600 / bg-green-50
--status-warning: text-amber-600 / bg-amber-50
--status-critical: text-red-600 / bg-red-50
--status-neutral: text-gray-600 / bg-gray-50

/* Score Colors (from BodyScoreGauge) */
--score-poor: #EF4444 (red-500)
--score-fair: #F59E0B (amber-500)
--score-good: #10B981 (green-500)
--score-excellent: #3B82F6 (blue-500)
```

### 5.2 Layout Specifications

```
┌─────────────────────────────────────────────────────────────────┐
│                        Analysis Page Layout                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │   HealthScoreCard   │  │      TrendsComparisonCard       │   │
│  │   (Hero - 1/3 w)    │  │           (2/3 width)           │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              BodyCompositionPanel (Full Width)             │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │   │
│  │  │BodyFat  │ │ Muscle  │ │ Water   │                      │   │
│  │  └─────────┘ └─────────┘ └─────────┘                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │   │
│  │  │ Bone    │ │ Protein │ │ Lean    │                      │   │
│  │  └─────────┘ └─────────┘ └─────────┘                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │  MetabolicHealthCard │  │      RecommendationsPanel       │   │
│  │      (1/3 width)     │  │          (2/3 width)           │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │               RiskAssessmentCard (Full Width)              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Recommendations

### 6.1 Phase 1: Core Structure (Estimated: 1-2 days)
1. Create `AnalysisPage.tsx` replacing placeholder
2. Implement `useReport()` integration with auto-load on profile change
3. Create `HealthScoreCard` wrapping existing `BodyScoreGauge`

### 6.2 Phase 2: Metric Cards (Estimated: 1-2 days)
4. Create `BodyCompositionPanel` using existing `MetricCard`
5. Add `MetabolicHealthCard` for BMR, Visceral, BMI
6. Implement status calculation helpers

### 6.3 Phase 3: Insights (Estimated: 1-2 days)
7. Create `TrendsComparisonCard` using `MetricTrends` data
8. Implement `RiskAssessmentCard` with progress bars
9. Add `RecommendationsPanel` following existing `SmartRecommendations` patterns

### 6.4 Phase 4: Polish (Estimated: 1 day)
10. Add loading skeletons
11. Implement error states
12. Add i18n keys to locales
13. Verify accessibility (ARIA labels, keyboard nav)

---

## 7. Risk Assessment

### 7.1 Low Risk Items
- **Component reuse**: `BodyScoreGauge`, `MetricCard` are battle-tested
- **Data flow**: `useReport()` hook already implements error handling
- **Styling**: Existing design tokens ensure consistency

### 7.2 Medium Risk Items
- **Status calculation logic**: Need to map raw values to status categories
  - **Mitigation**: Use constants from `domain/calculations/constants.ts`
- **Empty state handling**: No measurements scenario
  - **Mitigation**: Detect and show "Take first measurement" CTA

### 7.3 Dependencies
- Requires working `useMeasurement()` hook (fixed in App.tsx)
- Requires test data for validation (generator fixed)

---

## 8. Testing Strategy

### 8.1 Unit Tests
```typescript
// Test files to create:
src/presentation/components/analysis/__tests__/
├── AnalysisPage.test.tsx
├── HealthScoreCard.test.tsx
├── BodyCompositionPanel.test.tsx
├── MetabolicHealthCard.test.tsx
└── status-helpers.test.ts
```

### 8.2 Test Scenarios
1. Loading state rendering
2. Error state rendering
3. Empty data state (no measurements)
4. Full data rendering with all metrics
5. Status color mapping correctness
6. Trend direction indicators

---

## 9. Acceptance Criteria

- [ ] AnalysisPage loads data on profile selection
- [ ] BodyScore displays with animated gauge
- [ ] All 6 composition metrics display with correct status
- [ ] Trends show changes from previous measurements
- [ ] Recommendations display with priority indicators
- [ ] Loading skeleton appears during data fetch
- [ ] Error message displays on failure
- [ ] Empty state shows when no measurements exist
- [ ] All text is localized (PL/EN)
- [ ] Keyboard navigation works
- [ ] Screen reader announces metrics correctly

---

## 10. Approval

**Design Review Status:** ✅ APPROVED FOR IMPLEMENTATION

**Key Decisions:**
1. Reuse existing `BodyScoreGauge` and `MetricCard` components
2. Follow established hook pattern with `useReport()`
3. Use existing color tokens for status indicators
4. Implement in 4 phases for incremental delivery

**Next Steps:**
1. Create component files in `src/presentation/components/analysis/`
2. Implement Phase 1 (Core Structure)
3. Run integration test with generated test data
