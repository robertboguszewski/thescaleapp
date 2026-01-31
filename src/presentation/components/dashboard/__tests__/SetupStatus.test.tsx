/**
 * SetupStatus Component Tests
 *
 * TDD tests for the setup status component that displays
 * onboarding checklist on the dashboard.
 *
 * @vitest-environment jsdom
 * @module presentation/components/dashboard/__tests__/SetupStatus.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock the useSetupStatus hook
vi.mock('../../../hooks/useSetupStatus', () => ({
  useSetupStatus: vi.fn(),
}));

// Mock appStore for navigation
const mockSetActiveTab = vi.fn();
const mockSetSettingsSubTab = vi.fn();

vi.mock('../../../stores/appStore', () => ({
  useAppStore: vi.fn(() => ({
    setActiveTab: mockSetActiveTab,
    setSettingsSubTab: mockSetSettingsSubTab,
  })),
}));

import { useSetupStatus } from '../../../hooks/useSetupStatus';
import { useAppStore } from '../../../stores/appStore';
import { SetupStatus } from '../SetupStatus';
import type { SetupStep, StepStatus } from '../../../hooks/useSetupStatus';

describe('SetupStatus', () => {
  const mockUseSetupStatus = useSetupStatus as unknown as ReturnType<typeof vi.fn>;
  const mockUseAppStore = useAppStore as unknown as ReturnType<typeof vi.fn>;

  // Helper to create mock setup steps
  const createMockSteps = (statuses: StepStatus[]): SetupStep[] => [
    {
      id: 'profile',
      label: 'Utwórz profil',
      description: 'Dodaj swój profil z danymi osobowymi',
      status: statuses[0],
      navigateTo: { tab: 'settings', subTab: 'profiles' },
    },
    {
      id: 'device',
      label: 'Skonfiguruj wagę',
      description: 'Połącz wagę Xiaomi przez Bluetooth',
      status: statuses[1],
      navigateTo: { tab: 'settings', subTab: 'device' },
    },
    {
      id: 'measurement',
      label: 'Wykonaj pomiar',
      description: 'Wykonaj pierwszy pomiar masy ciała',
      status: statuses[2],
      navigateTo: { tab: 'measure' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActiveTab.mockClear();
    mockSetSettingsSubTab.mockClear();
    mockUseAppStore.mockReturnValue({
      setActiveTab: mockSetActiveTab,
      setSettingsSubTab: mockSetSettingsSubTab,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('rendering', () => {
    it('should render the setup status card with title', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByText('Konfiguracja aplikacji')).toBeInTheDocument();
    });

    it('should display all three setup steps', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByText('Utwórz profil')).toBeInTheDocument();
      expect(screen.getByText('Skonfiguruj wagę')).toBeInTheDocument();
      expect(screen.getByText('Wykonaj pomiar')).toBeInTheDocument();
    });

    it('should show step descriptions', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByText('Dodaj swój profil z danymi osobowymi')).toBeInTheDocument();
    });
  });

  describe('step status indicators', () => {
    it('should show checkmark for completed steps', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'current', 'pending']),
        completionProgress: 33.33,
        currentStep: createMockSteps(['completed', 'current', 'pending'])[1],
      });

      // Act
      render(<SetupStatus />);

      // Assert - check for checkmark icon (aria-label or test-id)
      const completedStep = screen.getByTestId('step-profile');
      expect(completedStep).toHaveAttribute('data-status', 'completed');
    });

    it('should highlight current step', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'current', 'pending']),
        completionProgress: 33.33,
        currentStep: createMockSteps(['completed', 'current', 'pending'])[1],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      const currentStep = screen.getByTestId('step-device');
      expect(currentStep).toHaveAttribute('data-status', 'current');
    });

    it('should show pending status for future steps', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      const pendingStep = screen.getByTestId('step-measurement');
      expect(pendingStep).toHaveAttribute('data-status', 'pending');
    });
  });

  describe('progress indicator', () => {
    it('should display 0% progress when nothing configured', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByTestId('progress-bar')).toHaveStyle({ width: '0%' });
    });

    it('should display 33% progress when one step completed', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'current', 'pending']),
        completionProgress: 33.33,
        currentStep: createMockSteps(['completed', 'current', 'pending'])[1],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByTestId('progress-bar')).toHaveStyle({ width: '33.33%' });
    });

    it('should display 67% progress when two steps completed', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: true,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'completed', 'current']),
        completionProgress: 66.67,
        currentStep: createMockSteps(['completed', 'completed', 'current'])[2],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByTestId('progress-bar')).toHaveStyle({ width: '66.67%' });
    });
  });

  describe('navigation', () => {
    it('should navigate to settings/profiles when clicking profile step', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);
      const profileStep = screen.getByTestId('step-profile-action');
      fireEvent.click(profileStep);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
    });

    it('should navigate to settings/device when clicking device step', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'current', 'pending']),
        completionProgress: 33.33,
        currentStep: createMockSteps(['completed', 'current', 'pending'])[1],
      });

      // Act
      render(<SetupStatus />);
      const deviceStep = screen.getByTestId('step-device-action');
      fireEvent.click(deviceStep);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
    });

    it('should navigate to measure tab when clicking measurement step', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: true,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'completed', 'current']),
        completionProgress: 66.67,
        currentStep: createMockSteps(['completed', 'completed', 'current'])[2],
      });

      // Act
      render(<SetupStatus />);
      const measurementStep = screen.getByTestId('step-measurement-action');
      fireEvent.click(measurementStep);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('measure');
    });
  });

  describe('visibility', () => {
    it('should not render when setup is complete', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: true,
        profileConfigured: true,
        deviceConfigured: true,
        hasMeasurements: true,
        setupSteps: createMockSteps(['completed', 'completed', 'completed']),
        completionProgress: 100,
        currentStep: null,
      });

      // Act
      const { container } = render(<SetupStatus />);

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it('should render when setup is incomplete', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      const { container } = render(<SetupStatus />);

      // Assert
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('action buttons', () => {
    it('should show action button for current step', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: false,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['current', 'pending', 'pending']),
        completionProgress: 0,
        currentStep: createMockSteps(['current', 'pending', 'pending'])[0],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByRole('button', { name: /rozpocznij/i })).toBeInTheDocument();
    });

    it('should show correct action text for device configuration', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: false,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'current', 'pending']),
        completionProgress: 33.33,
        currentStep: createMockSteps(['completed', 'current', 'pending'])[1],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByRole('button', { name: /konfiguruj/i })).toBeInTheDocument();
    });

    it('should show correct action text for first measurement', () => {
      // Arrange
      mockUseSetupStatus.mockReturnValue({
        isSetupComplete: false,
        profileConfigured: true,
        deviceConfigured: true,
        hasMeasurements: false,
        setupSteps: createMockSteps(['completed', 'completed', 'current']),
        completionProgress: 66.67,
        currentStep: createMockSteps(['completed', 'completed', 'current'])[2],
      });

      // Act
      render(<SetupStatus />);

      // Assert
      expect(screen.getByRole('button', { name: /wykonaj pomiar/i })).toBeInTheDocument();
    });
  });
});
