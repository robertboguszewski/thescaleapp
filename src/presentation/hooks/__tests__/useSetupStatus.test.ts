/**
 * useSetupStatus Hook Tests
 *
 * TDD tests for setup status hook that tracks app configuration state.
 * Tests profile, device, and measurement configuration detection.
 *
 * @vitest-environment jsdom
 * @module presentation/hooks/__tests__/useSetupStatus.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the stores before importing the hook
vi.mock('../../stores/profileStore', () => ({
  useProfileStore: vi.fn(),
}));

vi.mock('../../stores/bleStore', () => ({
  useBLEStore: vi.fn(),
  useIsDeviceConfigured: vi.fn(),
}));

vi.mock('../../stores/measurementStore', () => ({
  useMeasurementStore: vi.fn(),
}));

// Import mocked modules
import { useProfileStore } from '../../stores/profileStore';
import { useBLEStore, useIsDeviceConfigured } from '../../stores/bleStore';
import { useMeasurementStore } from '../../stores/measurementStore';

// Import hook (will be created)
import { useSetupStatus, type SetupStep, type SetupStatus } from '../useSetupStatus';

describe('useSetupStatus', () => {
  // Mock store selectors
  const mockProfileStore = useProfileStore as unknown as ReturnType<typeof vi.fn>;
  const mockBLEStore = useBLEStore as unknown as ReturnType<typeof vi.fn>;
  const mockIsDeviceConfigured = useIsDeviceConfigured as unknown as ReturnType<typeof vi.fn>;
  const mockMeasurementStore = useMeasurementStore as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('profileConfigured', () => {
    it('should return false when no profiles exist', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.profileConfigured).toBe(false);
    });

    it('should return true when at least one profile exists', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1', name: 'Test User' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.profileConfigured).toBe(true);
    });

    it('should return true when multiple profiles exist', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({
          profiles: [
            { id: 'profile-1', name: 'User 1' },
            { id: 'profile-2', name: 'User 2' },
          ],
        })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.profileConfigured).toBe(true);
    });
  });

  describe('deviceConfigured', () => {
    it('should return false when device is not configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.deviceConfigured).toBe(false);
    });

    it('should return true when device is configured (deviceMac and bleKey present)', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.deviceConfigured).toBe(true);
    });
  });

  describe('hasMeasurements', () => {
    it('should return false when no measurements exist', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.hasMeasurements).toBe(false);
    });

    it('should return true when at least one measurement exists', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [{ id: 'measurement-1', weight: 70.5 }] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.hasMeasurements).toBe(true);
    });
  });

  describe('isSetupComplete', () => {
    it('should return false when neither profile nor device is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.isSetupComplete).toBe(false);
    });

    it('should return false when only profile is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.isSetupComplete).toBe(false);
    });

    it('should return false when only device is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.isSetupComplete).toBe(false);
    });

    it('should return true when both profile and device are configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.isSetupComplete).toBe(true);
    });
  });

  describe('setupSteps', () => {
    it('should return steps with correct IDs', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.setupSteps).toHaveLength(3);
      expect(result.current.setupSteps.map((s) => s.id)).toEqual([
        'profile',
        'device',
        'measurement',
      ]);
    });

    it('should have correct labels in Polish', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.setupSteps[0].label).toBe('Utwórz profil');
      expect(result.current.setupSteps[1].label).toBe('Skonfiguruj wagę');
      expect(result.current.setupSteps[2].label).toBe('Wykonaj pomiar');
    });

    it('should mark profile step as completed when profile exists', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      const profileStep = result.current.setupSteps.find((s) => s.id === 'profile');
      expect(profileStep?.status).toBe('completed');
    });

    it('should mark device step as pending when profile not configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      const profileStep = result.current.setupSteps.find((s) => s.id === 'profile');
      const deviceStep = result.current.setupSteps.find((s) => s.id === 'device');
      expect(profileStep?.status).toBe('current');
      expect(deviceStep?.status).toBe('pending');
    });

    it('should mark device step as current when profile configured but device not', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      const deviceStep = result.current.setupSteps.find((s) => s.id === 'device');
      expect(deviceStep?.status).toBe('current');
    });

    it('should mark device step as completed when device is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      const deviceStep = result.current.setupSteps.find((s) => s.id === 'device');
      expect(deviceStep?.status).toBe('completed');
    });

    it('should mark measurement step as current when profile and device configured but no measurements', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      const measurementStep = result.current.setupSteps.find((s) => s.id === 'measurement');
      expect(measurementStep?.status).toBe('current');
    });

    it('should mark all steps as completed when setup is complete with measurements', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [{ id: 'measurement-1' }] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.setupSteps.every((s) => s.status === 'completed')).toBe(true);
    });

    it('should provide navigation targets for each step', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.setupSteps[0].navigateTo).toEqual({
        tab: 'settings',
        subTab: 'profiles',
      });
      expect(result.current.setupSteps[1].navigateTo).toEqual({
        tab: 'settings',
        subTab: 'device',
      });
      expect(result.current.setupSteps[2].navigateTo).toEqual({
        tab: 'measure',
      });
    });
  });

  describe('completionProgress', () => {
    it('should return 0 when nothing is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.completionProgress).toBe(0);
    });

    it('should return approximately 33% when only profile is configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.completionProgress).toBeCloseTo(33.33, 1);
    });

    it('should return approximately 67% when profile and device are configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.completionProgress).toBeCloseTo(66.67, 1);
    });

    it('should return 100% when everything is configured and has measurements', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [{ id: 'measurement-1' }] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.completionProgress).toBe(100);
    });
  });

  describe('currentStep', () => {
    it('should return profile step when no profile configured', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.currentStep?.id).toBe('profile');
    });

    it('should return device step when profile configured but device not', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(false);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.currentStep?.id).toBe('device');
    });

    it('should return measurement step when profile and device configured but no measurements', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.currentStep?.id).toBe('measurement');
    });

    it('should return null when all steps are complete', () => {
      // Arrange
      mockProfileStore.mockImplementation((selector: (state: { profiles: unknown[] }) => unknown) =>
        selector({ profiles: [{ id: 'profile-1' }] })
      );
      mockIsDeviceConfigured.mockReturnValue(true);
      mockMeasurementStore.mockImplementation((selector: (state: { measurements: unknown[] }) => unknown) =>
        selector({ measurements: [{ id: 'measurement-1' }] })
      );

      // Act
      const { result } = renderHook(() => useSetupStatus());

      // Assert
      expect(result.current.currentStep).toBeNull();
    });
  });
});
