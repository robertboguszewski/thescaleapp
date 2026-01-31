/**
 * Measurement Store
 *
 * Zustand store for managing measurement state.
 * Handles current measurement, history, trends data,
 * and guest measurements for multi-profile support.
 *
 * @module presentation/stores/measurementStore
 */

import { create } from 'zustand';
import type { CalculatedMetrics, RawMeasurement } from '../../domain/calculations/types';
import type { StoredMeasurement } from '../../infrastructure/storage/schemas';

/**
 * Guest profile ID constant
 */
export const GUEST_PROFILE_ID = '__guest__';

/**
 * Date range options for trends
 */
export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';

/**
 * Metric types for selection in trends
 */
export type MetricType =
  | 'weight'
  | 'bmi'
  | 'bodyFatPercent'
  | 'muscleMassKg'
  | 'bodyWaterPercent'
  | 'visceralFatLevel'
  | 'bmrKcal'
  | 'bodyScore';

/**
 * Current measurement being taken
 */
export interface CurrentMeasurement {
  raw: RawMeasurement | null;
  calculated: CalculatedMetrics | null;
  timestamp: Date | null;
  isSaved: boolean;
}

/**
 * Measurement state interface
 */
interface MeasurementState {
  // Measurements
  measurements: StoredMeasurement[];
  currentMeasurement: CurrentMeasurement;
  selectedMeasurementId: string | null;

  // Guest measurements
  guestMeasurements: StoredMeasurement[];

  // Trends
  selectedMetric: MetricType;
  dateRange: DateRange;

  // History pagination
  historyPage: number;
  pageSize: number;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  setMeasurements: (measurements: StoredMeasurement[]) => void;
  addMeasurement: (measurement: StoredMeasurement) => void;
  removeMeasurement: (id: string) => void;
  updateMeasurement: (id: string, data: Partial<StoredMeasurement>) => void;

  setCurrentMeasurement: (measurement: Partial<CurrentMeasurement>) => void;
  clearCurrentMeasurement: () => void;

  setSelectedMeasurementId: (id: string | null) => void;
  setSelectedMetric: (metric: MetricType) => void;
  setDateRange: (range: DateRange) => void;

  setHistoryPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;

  // Guest measurements actions
  loadGuestMeasurements: () => void;
  assignGuestToProfile: (measurementId: string, profileId: string) => void;
}

/**
 * Initial current measurement state
 */
const initialCurrentMeasurement: CurrentMeasurement = {
  raw: null,
  calculated: null,
  timestamp: null,
  isSaved: false,
};

/**
 * Create the measurement store
 */
export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  // Initial state
  measurements: [],
  currentMeasurement: initialCurrentMeasurement,
  selectedMeasurementId: null,
  guestMeasurements: [],
  selectedMetric: 'weight',
  dateRange: '30d',
  historyPage: 1,
  pageSize: 10,
  isLoading: false,
  isSaving: false,

  // Actions
  setMeasurements: (measurements) =>
    set({
      measurements: [...measurements].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }),

  addMeasurement: (measurement) =>
    set((state) => {
      const newMeasurements = [measurement, ...state.measurements].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Update guest measurements if this is a guest measurement
      const newGuestMeasurements = measurement.userProfileId === GUEST_PROFILE_ID
        ? [measurement, ...state.guestMeasurements].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        : state.guestMeasurements;

      return {
        measurements: newMeasurements,
        guestMeasurements: newGuestMeasurements,
      };
    }),

  removeMeasurement: (id) =>
    set((state) => ({
      measurements: state.measurements.filter((m) => m.id !== id),
      guestMeasurements: state.guestMeasurements.filter((m) => m.id !== id),
      selectedMeasurementId:
        state.selectedMeasurementId === id ? null : state.selectedMeasurementId,
    })),

  updateMeasurement: (id, data) =>
    set((state) => {
      const updatedMeasurements = state.measurements.map((m) =>
        m.id === id ? { ...m, ...data } : m
      );

      // If updating userProfileId, handle guest measurements list
      let updatedGuestMeasurements = state.guestMeasurements;

      if (data.userProfileId !== undefined) {
        const measurement = state.measurements.find((m) => m.id === id);

        if (measurement) {
          // Was guest, now assigned to profile
          if (measurement.userProfileId === GUEST_PROFILE_ID && data.userProfileId !== GUEST_PROFILE_ID) {
            updatedGuestMeasurements = state.guestMeasurements.filter((m) => m.id !== id);
          }
          // Was profile, now guest
          else if (measurement.userProfileId !== GUEST_PROFILE_ID && data.userProfileId === GUEST_PROFILE_ID) {
            const updatedMeasurement = { ...measurement, ...data };
            updatedGuestMeasurements = [updatedMeasurement as StoredMeasurement, ...state.guestMeasurements];
          }
        }
      }

      return {
        measurements: updatedMeasurements,
        guestMeasurements: updatedGuestMeasurements,
      };
    }),

  setCurrentMeasurement: (measurement) =>
    set((state) => ({
      currentMeasurement: { ...state.currentMeasurement, ...measurement },
    })),

  clearCurrentMeasurement: () =>
    set({ currentMeasurement: initialCurrentMeasurement }),

  setSelectedMeasurementId: (selectedMeasurementId) =>
    set({ selectedMeasurementId }),

  setSelectedMetric: (selectedMetric) => set({ selectedMetric }),

  setDateRange: (dateRange) => set({ dateRange }),

  setHistoryPage: (historyPage) => set({ historyPage }),

  nextPage: () => {
    const { historyPage, measurements, pageSize } = get();
    const maxPage = Math.ceil(measurements.length / pageSize);
    if (historyPage < maxPage) {
      set({ historyPage: historyPage + 1 });
    }
  },

  prevPage: () => {
    const { historyPage } = get();
    if (historyPage > 1) {
      set({ historyPage: historyPage - 1 });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),

  // Guest measurements actions
  loadGuestMeasurements: () => {
    const { measurements } = get();
    const guestMeasurements = measurements
      .filter((m) => m.userProfileId === GUEST_PROFILE_ID)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    set({ guestMeasurements });
  },

  assignGuestToProfile: (measurementId, profileId) => {
    const { measurements, guestMeasurements } = get();

    // Update measurement
    const updatedMeasurements = measurements.map((m) =>
      m.id === measurementId ? { ...m, userProfileId: profileId } : m
    );

    // Remove from guest list
    const updatedGuestMeasurements = guestMeasurements.filter(
      (m) => m.id !== measurementId
    );

    set({
      measurements: updatedMeasurements,
      guestMeasurements: updatedGuestMeasurements,
    });
  },
}));

/**
 * Selector for latest measurement
 */
export const useLatestMeasurement = () =>
  useMeasurementStore((state) =>
    state.measurements.length > 0 ? state.measurements[0] : null
  );

/**
 * Selector for paginated measurements
 */
export const usePaginatedMeasurements = () =>
  useMeasurementStore((state) => {
    const { measurements, historyPage, pageSize } = state;
    const start = (historyPage - 1) * pageSize;
    const end = start + pageSize;
    return {
      data: measurements.slice(start, end),
      page: historyPage,
      totalPages: Math.ceil(measurements.length / pageSize),
      total: measurements.length,
    };
  });

/**
 * Selector for filtered measurements by date range
 */
export const useFilteredMeasurements = () =>
  useMeasurementStore((state) => {
    const { measurements, dateRange } = state;
    const now = new Date();

    const ranges: Record<DateRange, number | null> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
      'all': null,
    };

    const rangeMs = ranges[dateRange];

    if (rangeMs === null) {
      return measurements;
    }

    return measurements.filter((m) => {
      const measurementDate = new Date(m.timestamp);
      return now.getTime() - measurementDate.getTime() <= rangeMs;
    });
  });

/**
 * Selector for selected measurement details
 */
export const useSelectedMeasurement = () =>
  useMeasurementStore((state) => {
    if (!state.selectedMeasurementId) return null;
    return state.measurements.find((m) => m.id === state.selectedMeasurementId) || null;
  });

/**
 * Selector for guest measurements
 */
export const useGuestMeasurements = () =>
  useMeasurementStore((state) => state.guestMeasurements);

/**
 * Selector for guest measurements count
 */
export const useGuestMeasurementsCount = () =>
  useMeasurementStore((state) => state.guestMeasurements.length);

/**
 * Selector for checking if there are guest measurements
 */
export const useHasGuestMeasurements = () =>
  useMeasurementStore((state) => state.guestMeasurements.length > 0);
