/**
 * GuestMeasurements Component
 *
 * Displays list of unassigned guest measurements with
 * options to assign to a profile or delete.
 *
 * @module presentation/components/history/GuestMeasurements
 */

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { ProfileSelectionDialog, ProfileOption } from '../measurement/ProfileSelectionDialog';
import { useMeasurementStore } from '../../stores/measurementStore';
import { useProfileStore } from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';
import type { StoredMeasurement } from '../../../infrastructure/storage/schemas';

/**
 * Guest profile ID constant
 */
export const GUEST_PROFILE_ID = '__guest__';

/**
 * Weight icon component
 */
const WeightIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 6v6l4 2" />
  </svg>
);

/**
 * Trash icon component
 */
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

/**
 * User assign icon component
 */
const UserAssignIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

/**
 * Format date for display
 */
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/**
 * Guest measurement row component
 */
const GuestMeasurementRow: React.FC<{
  measurement: StoredMeasurement;
  onAssign: (measurementId: string) => void;
  onDelete: (measurementId: string) => void;
  isDeleting: boolean;
}> = ({ measurement, onAssign, onDelete, isDeleting }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(measurement.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Icon */}
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
        <WeightIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
      </div>

      {/* Measurement info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {measurement.raw.weightKg.toFixed(1)} kg
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            BMI: {measurement.calculated.bmi.toFixed(1)}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(measurement.timestamp)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {showDeleteConfirm ? (
          <>
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
              Usunąć?
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              loading={isDeleting}
            >
              Tak
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Nie
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAssign(measurement.id)}
              leftIcon={<UserAssignIcon className="w-4 h-4" />}
            >
              Przypisz do profilu
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteClick}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <TrashIcon className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Empty state component
 */
const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
      <WeightIcon className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
      Brak pomiarów gości
    </h3>
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Pomiary zapisane jako gość pojawią się tutaj
    </p>
  </div>
);

/**
 * GuestMeasurements component
 *
 * Shows list of unassigned measurements with options to:
 * - Assign to a profile
 * - Delete measurement
 */
export const GuestMeasurements: React.FC = () => {
  const { measurements, updateMeasurement, removeMeasurement } = useMeasurementStore();
  const { profiles } = useProfileStore();
  const { addNotification } = useAppStore();

  // Local state
  const [selectedMeasurementId, setSelectedMeasurementId] = React.useState<string | null>(null);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] = React.useState(false);

  // Filter guest measurements
  const guestMeasurements = React.useMemo(
    () => measurements.filter((m) => m.userProfileId === GUEST_PROFILE_ID),
    [measurements]
  );

  // Get available profiles for assignment
  const availableProfiles: ProfileOption[] = React.useMemo(
    () => profiles.map((p) => ({ id: p.id, name: p.name })),
    [profiles]
  );

  // Handle assign button click
  const handleAssignClick = (measurementId: string) => {
    setSelectedMeasurementId(measurementId);
    setShowProfileSelector(true);
  };

  // Handle profile selection for assignment
  const handleProfileSelect = async (profileId: string) => {
    if (!selectedMeasurementId) return;

    setIsAssigning(true);

    try {
      // Update measurement with new profile ID
      updateMeasurement(selectedMeasurementId, { userProfileId: profileId });

      // TODO: Persist to backend via IPC
      // await window.electronAPI.updateMeasurement(selectedMeasurementId, { userProfileId: profileId });

      const profile = profiles.find((p) => p.id === profileId);
      addNotification({
        type: 'success',
        title: 'Pomiar przypisany',
        message: `Pomiar został przypisany do profilu ${profile?.name || 'wybranego'}`,
        duration: 3000,
      });

      setShowProfileSelector(false);
      setSelectedMeasurementId(null);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Błąd przypisania',
        message: 'Nie udało się przypisać pomiaru do profilu',
        duration: 5000,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle delete measurement
  const handleDelete = async (measurementId: string) => {
    setDeletingId(measurementId);

    try {
      // Remove from store
      removeMeasurement(measurementId);

      // TODO: Persist to backend via IPC
      // await window.electronAPI.deleteMeasurement(measurementId);

      addNotification({
        type: 'success',
        title: 'Pomiar usunięty',
        duration: 3000,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Błąd usuwania',
        message: 'Nie udało się usunąć pomiaru',
        duration: 5000,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Handle cancel profile selection
  const handleCancelSelection = () => {
    setShowProfileSelector(false);
    setSelectedMeasurementId(null);
  };

  return (
    <>
      <Card
        title="Pomiary gości"
        subtitle={`${guestMeasurements.length} nieprzypisanych pomiarów`}
      >
        {guestMeasurements.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {guestMeasurements.map((measurement) => (
              <GuestMeasurementRow
                key={measurement.id}
                measurement={measurement}
                onAssign={handleAssignClick}
                onDelete={handleDelete}
                isDeleting={deletingId === measurement.id}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Profile selection dialog */}
      <ProfileSelectionDialog
        isOpen={showProfileSelector}
        title="Przypisz pomiar do profilu"
        message="Wybierz profil, do ktorego chcesz przypisac ten pomiar."
        profiles={availableProfiles}
        onSelect={handleProfileSelect}
        onSaveAsGuest={() => {
          // Already a guest, just close
          setShowProfileSelector(false);
          setSelectedMeasurementId(null);
        }}
        onCancel={handleCancelSelection}
      />
    </>
  );
};

export default GuestMeasurements;
