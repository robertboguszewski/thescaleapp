/**
 * HistoryList Component
 *
 * Paginated list of past measurements.
 * Supports filtering, sorting, and deletion.
 *
 * @module presentation/components/history/HistoryList
 */

import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/LoadingSpinner';
import { MeasurementRow } from './MeasurementRow';
import {
  useMeasurementStore,
  usePaginatedMeasurements,
} from '../../stores/measurementStore';
import { useAppStore } from '../../stores/appStore';

/**
 * Empty state component
 */
const EmptyState: React.FC = () => {
  const { setActiveTab } = useAppStore();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
        <svg
          className="w-12 h-12 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 8v4l3 3" />
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12a9 9 0 1 0 9-9" />
          <path d="M3 3v6h6" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Brak pomiarow
      </h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400 text-center max-w-md">
        Nie masz jeszcze zadnych zapisanych pomiarow. Wykonaj pierwszy pomiar, aby rozpoczac sledzenie wynikow.
      </p>
      <Button
        variant="primary"
        size="lg"
        className="mt-6"
        onClick={() => setActiveTab('measure')}
      >
        Wykonaj pomiar
      </Button>
    </div>
  );
};

/**
 * Loading skeleton
 */
const HistorySkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1">
            <Skeleton width="30%" className="mb-2" />
            <Skeleton width="20%" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/**
 * Delete confirmation modal
 */
const DeleteConfirmModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Usunąć pomiar?
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Ta operacja jest nieodwracalna. Pomiar zostanie trwale usunięty z historii.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            fullWidth
            onClick={onCancel}
          >
            Anuluj
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={onConfirm}
          >
            Usuń
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Pagination component
 */
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, total, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Strona {currentPage} z {totalPages} ({total} pomiarow)
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }

          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'primary' : 'outline'}
              size="sm"
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

/**
 * HistoryList component
 */
export const HistoryList: React.FC = () => {
  const { data, page, totalPages, total } = usePaginatedMeasurements();
  const {
    selectedMeasurementId,
    setSelectedMeasurementId,
    setHistoryPage,
    removeMeasurement,
    isLoading,
  } = useMeasurementStore();
  const { addNotification } = useAppStore();

  const [deleteModalId, setDeleteModalId] = React.useState<string | null>(null);

  // Handle measurement selection
  const handleSelect = (id: string) => {
    setSelectedMeasurementId(selectedMeasurementId === id ? null : id);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deleteModalId) {
      removeMeasurement(deleteModalId);
      setDeleteModalId(null);
      addNotification({
        type: 'success',
        title: 'Pomiar usunięty',
        duration: 3000,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <HistorySkeleton />
      </Card>
    );
  }

  if (total === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Historia pomiarów
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Łącznie: {total} pomiarów
          </p>
        </div>
      </div>

      {/* Measurement list */}
      <div className="space-y-3">
        {data.map((measurement) => (
          <MeasurementRow
            key={measurement.id}
            measurement={measurement}
            isSelected={selectedMeasurementId === measurement.id}
            onClick={() => handleSelect(measurement.id)}
            onDelete={() => setDeleteModalId(measurement.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setHistoryPage}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={deleteModalId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalId(null)}
      />
    </div>
  );
};

export default HistoryList;
