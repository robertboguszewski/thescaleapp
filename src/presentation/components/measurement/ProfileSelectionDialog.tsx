/**
 * ProfileSelectionDialog Component
 *
 * Modal dialog for selecting a profile when auto-detection
 * is ambiguous or requires confirmation.
 *
 * @module presentation/components/measurement/ProfileSelectionDialog
 */

import React from 'react';
import { Button } from '../common/Button';

/**
 * Profile option for selection
 */
export interface ProfileOption {
  id: string;
  name: string;
}

/**
 * Props for ProfileSelectionDialog
 */
export interface ProfileSelectionDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message explaining why selection is needed */
  message: string;
  /** List of profiles to choose from */
  profiles: ProfileOption[];
  /** Callback when a profile is selected */
  onSelect: (profileId: string) => void;
  /** Callback when saving as guest */
  onSaveAsGuest: () => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

/**
 * User icon component
 */
const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * Guest icon component
 */
const GuestIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

/**
 * Close icon component
 */
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * ProfileSelectionDialog component
 *
 * Displays a modal dialog for profile selection with:
 * - List of available profiles
 * - Save as guest option
 * - Cancel button
 */
export const ProfileSelectionDialog: React.FC<ProfileSelectionDialogProps> = ({
  isOpen,
  title,
  message,
  profiles,
  onSelect,
  onSaveAsGuest,
  onCancel,
}) => {
  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-selection-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="profile-selection-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Zamknij"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Message */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>

          {/* Profile list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => onSelect(profile.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600
                    hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-600
                    transition-colors text-left group"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-700 dark:group-hover:text-primary-300">
                      {profile.name}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-primary-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Brak dostępnych profili</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                lub
              </span>
            </div>
          </div>

          {/* Guest option */}
          <button
            onClick={onSaveAsGuest}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600
              hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:border-yellow-400 dark:hover:border-yellow-600
              transition-colors text-left group"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <GuestIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white group-hover:text-yellow-700 dark:group-hover:text-yellow-300">
                Zapisz jako gość
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Możesz przypisać do profilu później
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelectionDialog;
