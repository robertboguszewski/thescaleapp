/**
 * Header Component Tests
 *
 * TDD tests for Header navigation behavior - specifically testing
 * that navigation to Settings sets the correct settingsSubTab.
 *
 * @vitest-environment jsdom
 * @module presentation/components/layout/__tests__/Header.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Mock stores
const mockSetActiveTab = vi.fn();
const mockSetSettingsSubTab = vi.fn();
const mockSetCurrentProfileId = vi.fn();
const mockSetIsEditing = vi.fn();
const mockSetEditingProfileId = vi.fn();

vi.mock('../../../stores/appStore', () => ({
  useAppStore: vi.fn(() => ({
    activeTab: 'dashboard',
    setActiveTab: mockSetActiveTab,
    setSettingsSubTab: mockSetSettingsSubTab,
    isDarkMode: false,
    toggleDarkMode: vi.fn(),
  })),
}));

vi.mock('../../../stores/profileStore', () => ({
  useProfileStore: vi.fn(() => ({
    profiles: [],
    setCurrentProfileId: mockSetCurrentProfileId,
    setIsEditing: mockSetIsEditing,
    setEditingProfileId: mockSetEditingProfileId,
  })),
  useCurrentProfile: vi.fn(() => null),
}));

vi.mock('../../../stores/bleStore', () => ({
  useBLEStore: vi.fn(() => ({
    connectionState: 'disconnected',
  })),
  useIsDeviceConfigured: vi.fn(() => false),
  getStatusMessage: vi.fn(() => 'Disconnected'),
  getStatusColor: vi.fn(() => 'text-gray-500'),
}));

import { useAppStore } from '../../../stores/appStore';
import { useProfileStore, useCurrentProfile } from '../../../stores/profileStore';
import { useBLEStore, useIsDeviceConfigured } from '../../../stores/bleStore';
import { Header } from '../Header';

describe('Header', () => {
  const mockUseAppStore = useAppStore as unknown as ReturnType<typeof vi.fn>;
  const mockUseProfileStore = useProfileStore as unknown as ReturnType<typeof vi.fn>;
  const mockUseCurrentProfile = useCurrentProfile as unknown as ReturnType<typeof vi.fn>;
  const mockUseBLEStore = useBLEStore as unknown as ReturnType<typeof vi.fn>;
  const mockUseIsDeviceConfigured = useIsDeviceConfigured as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActiveTab.mockClear();
    mockSetSettingsSubTab.mockClear();
    mockSetCurrentProfileId.mockClear();
    mockSetIsEditing.mockClear();
    mockSetEditingProfileId.mockClear();

    // Default mock setup
    mockUseAppStore.mockReturnValue({
      activeTab: 'dashboard',
      setActiveTab: mockSetActiveTab,
      setSettingsSubTab: mockSetSettingsSubTab,
      isDarkMode: false,
      toggleDarkMode: vi.fn(),
    });

    mockUseProfileStore.mockReturnValue({
      profiles: [],
      setCurrentProfileId: mockSetCurrentProfileId,
      setIsEditing: mockSetIsEditing,
      setEditingProfileId: mockSetEditingProfileId,
    });

    mockUseCurrentProfile.mockReturnValue(null);

    mockUseBLEStore.mockReturnValue({
      connectionState: 'disconnected',
    });

    mockUseIsDeviceConfigured.mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('BLEStatusIndicator', () => {
    it('should show "Configure scale" button when device is not configured', () => {
      // Arrange
      mockUseIsDeviceConfigured.mockReturnValue(false);

      // Act
      render(<Header />);

      // Assert
      expect(screen.getByText('Configure scale')).toBeInTheDocument();
    });

    it('should navigate to settings and set device sub-tab when clicking "Configure scale"', () => {
      // Arrange
      mockUseIsDeviceConfigured.mockReturnValue(false);

      // Act
      render(<Header />);
      const configureButton = screen.getByText('Configure scale');
      fireEvent.click(configureButton);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
      expect(mockSetSettingsSubTab).toHaveBeenCalledWith('device');
    });

    it('should show connection status when device is configured', () => {
      // Arrange
      mockUseIsDeviceConfigured.mockReturnValue(true);
      mockUseBLEStore.mockReturnValue({
        connectionState: 'connected',
      });

      // Act
      render(<Header />);

      // Assert
      expect(screen.queryByText('Configure scale')).not.toBeInTheDocument();
    });
  });

  describe('ProfileSelector', () => {
    it('should show "Create profile" button when no profiles exist', () => {
      // Arrange
      mockUseProfileStore.mockReturnValue({
        profiles: [],
        setCurrentProfileId: mockSetCurrentProfileId,
        setIsEditing: mockSetIsEditing,
        setEditingProfileId: mockSetEditingProfileId,
      });

      // Act
      render(<Header />);

      // Assert
      expect(screen.getByText('Create profile')).toBeInTheDocument();
    });

    it('should navigate to settings and set profiles sub-tab when clicking "Create profile"', () => {
      // Arrange
      mockUseProfileStore.mockReturnValue({
        profiles: [],
        setCurrentProfileId: mockSetCurrentProfileId,
        setIsEditing: mockSetIsEditing,
        setEditingProfileId: mockSetEditingProfileId,
      });

      // Act
      render(<Header />);
      const createProfileButton = screen.getByText('Create profile');
      fireEvent.click(createProfileButton);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
      expect(mockSetSettingsSubTab).toHaveBeenCalledWith('profiles');
      expect(mockSetIsEditing).toHaveBeenCalledWith(true);
      expect(mockSetEditingProfileId).toHaveBeenCalledWith(null);
    });

    it('should show profile dropdown when profiles exist', () => {
      // Arrange
      mockUseProfileStore.mockReturnValue({
        profiles: [{ id: 'profile-1', name: 'Jan Kowalski', gender: 'male', age: 30, isDefault: true }],
        setCurrentProfileId: mockSetCurrentProfileId,
        setIsEditing: mockSetIsEditing,
        setEditingProfileId: mockSetEditingProfileId,
      });
      mockUseCurrentProfile.mockReturnValue({
        id: 'profile-1',
        name: 'Jan Kowalski',
        gender: 'male',
        age: 30,
        isDefault: true,
      });

      // Act
      render(<Header />);

      // Assert
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      expect(screen.queryByText('Create profile')).not.toBeInTheDocument();
    });

    it('should navigate to settings/profiles when clicking "New profile" in dropdown', () => {
      // Arrange
      mockUseProfileStore.mockReturnValue({
        profiles: [{ id: 'profile-1', name: 'Jan Kowalski', gender: 'male', age: 30, isDefault: true }],
        setCurrentProfileId: mockSetCurrentProfileId,
        setIsEditing: mockSetIsEditing,
        setEditingProfileId: mockSetEditingProfileId,
      });
      mockUseCurrentProfile.mockReturnValue({
        id: 'profile-1',
        name: 'Jan Kowalski',
      });

      // Act
      render(<Header />);

      // Open dropdown
      const profileButton = screen.getByText('Jan Kowalski');
      fireEvent.click(profileButton);

      // Click "New profile"
      const newProfileButton = screen.getByText('New profile');
      fireEvent.click(newProfileButton);

      // Assert
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
      expect(mockSetSettingsSubTab).toHaveBeenCalledWith('profiles');
      expect(mockSetIsEditing).toHaveBeenCalledWith(true);
    });
  });

  describe('Header rendering', () => {
    it('should display page title based on active tab', () => {
      // Arrange
      mockUseAppStore.mockReturnValue({
        activeTab: 'dashboard',
        setActiveTab: mockSetActiveTab,
        setSettingsSubTab: mockSetSettingsSubTab,
        isDarkMode: false,
        toggleDarkMode: vi.fn(),
      });

      // Act
      render(<Header />);

      // Assert
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should display "Ustawienia" title when on settings tab', () => {
      // Arrange
      mockUseAppStore.mockReturnValue({
        activeTab: 'settings',
        setActiveTab: mockSetActiveTab,
        setSettingsSubTab: mockSetSettingsSubTab,
        isDarkMode: false,
        toggleDarkMode: vi.fn(),
      });

      // Act
      render(<Header />);

      // Assert
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});
