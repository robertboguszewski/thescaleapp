# Analysis Module Specification

## Overview

A comprehensive health analysis dashboard that transforms raw body composition data into actionable health insights, following industry standards and best practices from leading health tech companies.

## Research Sources

### Industry Standards
- [Withings Body Scan](https://www.withings.com/us/en/body-scan) - Segmental analysis, health scores, personalized insights
- [Harvard Health - Body Fat Ranges](https://www.health.harvard.edu/staying-healthy/what-is-considered-a-healthy-body-fat-percentage-as-you-age)
- [BodySpec - Visceral Fat Levels](https://www.bodyspec.com/blog/post/visceral_fat_level_chart_understanding_your_health_risks)
- [InBody - Body Fat Percentage Chart](https://inbodyusa.com/blogs/inbodyblog/body-fat-percentage-chart/)

### UX Best Practices
- [UXPin - Dashboard Design Principles](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [DesignRush - Dashboard UX 2025](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-ux)
- Max 5-6 cards in initial view
- Visual hierarchy for key metrics
- Microinteractions for engagement
- Accessibility compliance

---

## Health Metric Standards

### Body Fat Percentage (Gender & Age Specific)

| Category | Men (20-39) | Men (40-59) | Men (60+) | Women (20-39) | Women (40-59) | Women (60+) |
|----------|-------------|-------------|-----------|---------------|---------------|-------------|
| Athletes | 6-13% | 8-14% | 10-16% | 14-20% | 16-23% | 18-25% |
| Fitness | 14-17% | 15-19% | 17-21% | 21-24% | 24-27% | 26-30% |
| Average | 18-24% | 20-26% | 22-28% | 25-31% | 28-33% | 30-35% |
| Obese | >25% | >27% | >29% | >32% | >34% | >36% |

### Visceral Fat Level (Scale 1-30)

| Level | Classification | Health Risk | Color |
|-------|---------------|-------------|-------|
| 1-9 | Healthy | Low | Green |
| 10-14 | Elevated | Moderate | Yellow/Amber |
| 15+ | High | High | Red |

### BMI Classification (WHO)

| BMI | Classification | Color |
|-----|---------------|-------|
| <18.5 | Underweight | Blue |
| 18.5-24.9 | Normal | Green |
| 25-29.9 | Overweight | Yellow |
| 30+ | Obese | Red |

### Muscle Mass Percentage

| Age Group | Men (Healthy) | Women (Healthy) |
|-----------|---------------|-----------------|
| 18-35 | 40-44% | 31-33% |
| 36-55 | 36-40% | 29-31% |
| 56-75 | 32-35% | 27-30% |
| 75+ | 31%+ | 26%+ |

### Body Water Percentage

| Gender | Low | Normal | High |
|--------|-----|--------|------|
| Men | <50% | 50-65% | >65% |
| Women | <45% | 45-60% | >60% |

---

## Module Architecture

### Components Structure

```
src/presentation/components/analysis/
├── AnalysisPage.tsx           # Main container
├── HealthScoreCard.tsx        # Circular gauge with score breakdown
├── BodyCompositionPanel.tsx   # 6 metric cards grid
├── MetricCard.tsx             # Individual metric with status
├── MetabolicHealthCard.tsx    # BMR, visceral fat analysis
├── RiskAssessmentCard.tsx     # Health risk indicators
├── TrendsComparisonCard.tsx   # Before/after comparison
├── RecommendationsPanel.tsx   # Actionable health tips
└── index.ts                   # Exports
```

### Data Flow

```
User selects profile
    ↓
useReport() hook calls ReportService.generateReport(profileId)
    ↓
ReportService fetches measurements + profile
    ↓
Calculates: trends, recommendations, summary
    ↓
Returns HealthReport object
    ↓
Components render with data
```

---

## UI Components Specification

### 1. Health Score Card (Hero)

**Purpose**: Primary metric showing overall health status

**Layout**:
```
┌─────────────────────────────────────────┐
│  ┌─────────┐                            │
│  │   75    │  Body Score               │
│  │  /100   │  "Good - Keep it up!"     │
│  └─────────┘                            │
│                                         │
│  BMI ████████░░ 25%                     │
│  Fat ██████░░░░ 35%                     │
│  Visc████████░░ 25%                     │
│  Musc██████░░░░ 15%                     │
└─────────────────────────────────────────┘
```

**Features**:
- Circular progress gauge (0-100)
- Color gradient: Red (0-40) → Yellow (40-70) → Green (70-100)
- Score breakdown bars showing contribution weights
- Status message based on score range

**Score Ranges**:
- 0-40: Poor - "Needs improvement"
- 41-60: Fair - "Room for improvement"
- 61-75: Good - "On the right track"
- 76-90: Very Good - "Keep it up!"
- 91-100: Excellent - "Outstanding!"

---

### 2. Body Composition Panel

**Purpose**: Visual breakdown of body composition metrics

**Layout** (2x3 grid):
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Body Fat    │ │ Muscle Mass │ │ Body Water  │
│ 🟡 27.5%    │ │ 🟢 56.4 kg  │ │ 🟢 51.1%    │
│ Elevated    │ │ Normal      │ │ Normal      │
└─────────────┘ └─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Bone Mass   │ │ Protein %   │ │ Lean Mass   │
│ 🟢 3.0 kg   │ │ 🟡 11.6%    │ │ 🟢 75.1 kg  │
│ Normal      │ │ Low         │ │ Normal      │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Each Card Contains**:
- Metric name
- Current value with unit
- Status indicator (🟢 Normal, 🟡 Attention, 🔴 Critical)
- Healthy range reference
- Mini trend arrow (↑ improving, ↓ declining, → stable)

---

### 3. Metabolic Health Card

**Purpose**: Display metabolic indicators

**Layout**:
```
┌─────────────────────────────────────────┐
│ Metabolic Health                        │
├─────────────────────────────────────────┤
│ BMR (Basal Metabolic Rate)              │
│ 2,084 kcal/day                          │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░ avg: 1,800 │
├─────────────────────────────────────────┤
│ Visceral Fat Level                      │
│ 🟡 11 (Elevated)                        │
│ ████████████░░░░░░░░░░░░░░░░░░ 1-30     │
│ Risk: Moderate - Monitor closely        │
├─────────────────────────────────────────┤
│ BMI                                     │
│ 🟡 29.7 (Overweight)                    │
│ Target: 18.5 - 24.9                     │
└─────────────────────────────────────────┘
```

---

### 4. Risk Assessment Card

**Purpose**: Highlight health risks based on metrics

**Risk Categories**:
1. **Cardiovascular Risk** (based on visceral fat, BMI)
2. **Metabolic Syndrome Risk** (based on body fat, visceral fat)
3. **Sarcopenia Risk** (based on muscle mass, age)

**Layout**:
```
┌─────────────────────────────────────────┐
│ Risk Assessment                         │
├─────────────────────────────────────────┤
│ Cardiovascular    [████░░░░░░] Moderate │
│ Metabolic         [██░░░░░░░░] Low      │
│ Muscle Loss       [░░░░░░░░░░] Low      │
├─────────────────────────────────────────┤
│ ⚠️ Primary concern: Visceral fat        │
│    Consider: cardio exercise, diet      │
└─────────────────────────────────────────┘
```

---

### 5. Trends Comparison Card

**Purpose**: Show progress over time

**Layout**:
```
┌─────────────────────────────────────────┐
│ Progress (Last 30 Days)                 │
├──────────────────┬──────────────────────┤
│ Metric           │ Change               │
├──────────────────┼──────────────────────┤
│ Weight           │ ↓ -2.0 kg  🟢        │
│ Body Fat         │ ↓ -1.2%   🟢        │
│ Muscle Mass      │ ↑ +0.3 kg  🟢        │
│ Visceral Fat     │ → 0       🟡        │
│ Body Score       │ ↑ +5 pts   🟢        │
├──────────────────┴──────────────────────┤
│ 📈 Overall: Improving                   │
│ "Great progress! Keep up the good work" │
└─────────────────────────────────────────┘
```

---

### 6. Recommendations Panel

**Purpose**: Actionable health advice

**Priority Levels**:
1. 🔴 Critical - Immediate attention needed
2. 🟡 Warning - Should address soon
3. 🔵 Info - General improvement tips

**Layout**:
```
┌─────────────────────────────────────────┐
│ Personalized Recommendations            │
├─────────────────────────────────────────┤
│ 🟡 Reduce Visceral Fat                  │
│    Your level (11) is elevated.         │
│    • Increase cardio to 150 min/week    │
│    • Reduce refined carbs               │
│    • Consider HIIT training             │
│    Source: WHO CVD Prevention           │
├─────────────────────────────────────────┤
│ 🔵 Maintain Muscle Mass                 │
│    Good muscle mass for your age.       │
│    • Continue resistance training       │
│    • Ensure adequate protein (1.6g/kg)  │
│    Source: ACSM Guidelines              │
└─────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Structure
1. Create `AnalysisPage.tsx` replacing placeholder
2. Implement `useReport()` hook integration
3. Create `HealthScoreCard` component

### Phase 2: Metric Cards
4. Implement `MetricCard` component with status logic
5. Create `BodyCompositionPanel` with 6-card grid
6. Add `MetabolicHealthCard`

### Phase 3: Insights
7. Implement `RiskAssessmentCard`
8. Create `TrendsComparisonCard`
9. Add `RecommendationsPanel`

### Phase 4: Polish
10. Add animations and microinteractions
11. Implement responsive design
12. Add accessibility features
13. Localization (PL/EN)

---

## Existing Code to Leverage

### Domain Logic
- `src/domain/calculations/health-assessment/scoring.ts` - Body score calculation
- `src/domain/calculations/health-assessment/recommendations.ts` - Recommendations engine
- `src/domain/calculations/constants.ts` - Health thresholds

### Services
- `src/application/services/ReportService.ts` - HealthReport generation
- IPC handlers: `REPORT_GENERATE`, `REPORT_QUICK_SUMMARY`

### Hooks
- `src/presentation/hooks/useReport.ts` - Report data fetching
- `src/presentation/hooks/useSmartRecommendations.ts` - Recommendations

### Existing Components
- `src/presentation/components/dashboard/SmartRecommendations.tsx` - Can reuse patterns

---

## Accessibility Requirements

- WCAG 2.1 AA compliance
- Color contrast ratios ≥ 4.5:1
- Screen reader support for all metrics
- Keyboard navigation
- Focus indicators
- Alt text for status indicators

---

## Localization Keys

```json
{
  "analysis": {
    "title": "Health Analysis",
    "healthScore": {
      "title": "Body Score",
      "excellent": "Excellent",
      "veryGood": "Very Good",
      "good": "Good",
      "fair": "Fair",
      "poor": "Poor"
    },
    "bodyComposition": {
      "title": "Body Composition",
      "bodyFat": "Body Fat",
      "muscleMass": "Muscle Mass",
      "bodyWater": "Body Water",
      "boneMass": "Bone Mass",
      "protein": "Protein",
      "leanMass": "Lean Mass"
    },
    "status": {
      "normal": "Normal",
      "elevated": "Elevated",
      "high": "High",
      "low": "Low"
    },
    "metabolic": {
      "title": "Metabolic Health",
      "bmr": "Basal Metabolic Rate",
      "visceralFat": "Visceral Fat",
      "bmi": "Body Mass Index"
    },
    "risk": {
      "title": "Risk Assessment",
      "cardiovascular": "Cardiovascular",
      "metabolic": "Metabolic Syndrome",
      "sarcopenia": "Muscle Loss"
    },
    "trends": {
      "title": "Progress",
      "improving": "Improving",
      "stable": "Stable",
      "declining": "Declining"
    },
    "recommendations": {
      "title": "Personalized Recommendations"
    }
  }
}
```

---

## Success Metrics

1. **User Engagement**: Time spent on analysis page
2. **Comprehension**: Users understand their health status
3. **Action Rate**: Users follow recommendations
4. **Accessibility**: 100% WCAG 2.1 AA compliance
5. **Performance**: <200ms initial render time
