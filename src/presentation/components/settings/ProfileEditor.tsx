/**
 * ProfileEditor Component
 *
 * Form for creating and editing user profiles.
 * Includes validation and save/cancel actions.
 * Uses birth year dropdown instead of age input.
 *
 * @module presentation/components/settings/ProfileEditor
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { InlineError } from '../common/ErrorMessage';
import {
  useProfileStore,
  useEditingProfile,
  validateProfileData,
  hasValidationErrors,
  ProfileFormData,
  ProfileValidationErrors,
} from '../../stores/profileStore';
import { useAppStore } from '../../stores/appStore';

export interface ProfileEditorProps {
  /** Profile ID to edit (null for new profile) */
  profileId?: string | null;
  /** Callback when editing is complete */
  onComplete?: () => void;
  /** Callback when editing is cancelled */
  onCancel?: () => void;
}

/**
 * Calculate age from birth year and optional month
 */
const calculateAgeFromBirthYear = (birthYear: number, birthMonth?: number): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;
  if (birthMonth !== undefined && today.getMonth() + 1 < birthMonth) {
    age--;
  }
  return age;
};

/**
 * Calculate birth year from age
 */
const calculateBirthYear = (age: number): number => {
  const currentYear = new Date().getFullYear();
  return currentYear - age;
};

/**
 * Generate birth year options (1920 to current year - 5)
 */
const generateBirthYearOptions = (): Array<{ value: string; label: string }> => {
  const currentYear = new Date().getFullYear();
  const minYear = 1920;
  const maxYear = currentYear - 5; // At least 5 years old
  const options: Array<{ value: string; label: string }> = [];

  for (let year = maxYear; year >= minYear; year--) {
    options.push({
      value: year.toString(),
      label: year.toString(),
    });
  }

  return options;
};

/**
 * Generate month options with translations
 */
const getMonthOptions = (t: (key: string) => string): Array<{ value: string; label: string }> => [
  { value: '1', label: t('common:months.1') },
  { value: '2', label: t('common:months.2') },
  { value: '3', label: t('common:months.3') },
  { value: '4', label: t('common:months.4') },
  { value: '5', label: t('common:months.5') },
  { value: '6', label: t('common:months.6') },
  { value: '7', label: t('common:months.7') },
  { value: '8', label: t('common:months.8') },
  { value: '9', label: t('common:months.9') },
  { value: '10', label: t('common:months.10') },
  { value: '11', label: t('common:months.11') },
  { value: '12', label: t('common:months.12') },
];

/**
 * Calculate age from birth year and optional month
 */
const calculateAgeWithMonth = (birthYear: number, birthMonth?: number): number => {
  const today = new Date();
  const currentYear = today.getFullYear();
  let age = currentYear - birthYear;

  if (birthMonth !== undefined) {
    const currentMonth = today.getMonth() + 1;
    if (currentMonth < birthMonth) {
      age--;
    }
  }

  return age;
};

/**
 * Form input component
 */
const FormInput: React.FC<{
  label: string;
  name: string;
  type?: 'text' | 'number';
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  helperText?: string;
}> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  min,
  max,
  required = false,
  helperText,
}) => (
  <div>
    <label
      htmlFor={name}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`
        w-full px-4 py-2 rounded-lg border transition-colors
        bg-white dark:bg-gray-800
        ${error
          ? 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
          : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500'
        }
        text-gray-900 dark:text-white
        placeholder-gray-400 dark:placeholder-gray-500
        focus:outline-none focus:ring-2
      `}
    />
    {helperText && !error && (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    )}
    {error && <InlineError message={error} />}
  </div>
);

/**
 * Form select component
 */
const FormSelect: React.FC<{
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  required?: boolean;
  helperText?: string;
}> = ({ label, name, value, onChange, options, error, required = false, helperText }) => (
  <div>
    <label
      htmlFor={name}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-full px-4 py-2 rounded-lg border transition-colors
        bg-white dark:bg-gray-800
        ${error
          ? 'border-red-300 dark:border-red-600'
          : 'border-gray-300 dark:border-gray-600'
        }
        text-gray-900 dark:text-white
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
      `}
    >
      <option value="">Wybierz...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {helperText && !error && (
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
    )}
    {error && <InlineError message={error} />}
  </div>
);

/**
 * Form checkbox component
 */
const FormCheckbox: React.FC<{
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helperText?: string;
}> = ({ label, name, checked, onChange, helperText }) => (
  <div className="flex items-start gap-3">
    <div className="flex items-center h-5">
      <input
        type="checkbox"
        id={name}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-primary-600 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
      />
    </div>
    <div>
      <label
        htmlFor={name}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      {helperText && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  </div>
);

/**
 * Birth date selector with year, optional month, and calculated age display
 */
const BirthDateSelector: React.FC<{
  birthYear: number;
  birthMonth?: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | undefined) => void;
  yearError?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ birthYear, birthMonth, onYearChange, onMonthChange, yearError, t }) => {
  const birthYearOptions = React.useMemo(() => generateBirthYearOptions(), []);
  const monthOptions = React.useMemo(() => getMonthOptions(t), [t]);
  const calculatedAge = calculateAgeWithMonth(birthYear, birthMonth);

  const handleMonthChange = (value: string) => {
    if (value === '') {
      onMonthChange(undefined);
    } else {
      onMonthChange(parseInt(value));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormSelect
          label={t('settings:profileEditor.birthYear')}
          name="birthYear"
          value={birthYear.toString()}
          onChange={(value) => onYearChange(parseInt(value) || new Date().getFullYear() - 30)}
          options={birthYearOptions}
          error={yearError}
          required
        />
        <FormSelect
          label={t('settings:profileEditor.birthMonth')}
          name="birthMonth"
          value={birthMonth?.toString() || ''}
          onChange={handleMonthChange}
          options={monthOptions}
          helperText={t('settings:profileEditor.birthMonthHelper')}
        />
      </div>
      <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
        {t('settings:profileEditor.ageDisplay', { age: calculatedAge })}
        {birthMonth === undefined && (
          <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">{t('settings:profileEditor.ageApprox')}</span>
        )}
      </p>
    </div>
  );
};

/**
 * ProfileEditor component
 */
export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profileId,
  onComplete,
  onCancel,
}) => {
  const { t } = useTranslation(['settings', 'common']);
  const editingProfile = useEditingProfile();
  const {
    addProfile,
    updateProfile,
    setIsEditing,
    setSaving,
    isSaving,
    validationErrors,
    setValidationErrors,
    clearValidationErrors,
  } = useProfileStore();
  const { addNotification } = useAppStore();

  // Form state with birth year and optional month instead of age
  const [formData, setFormData] = React.useState<ProfileFormData & { birthYear: number; birthMonth?: number }>({
    name: '',
    gender: 'male',
    age: 30,
    birthYear: new Date().getFullYear() - 30,
    birthMonth: undefined,
    heightCm: 175,
    ethnicity: undefined,
    isDefault: false,
  });

  // Load existing profile data
  React.useEffect(() => {
    if (editingProfile) {
      // editingProfile is StoredProfile which has birthYear, not age
      const birthYear = editingProfile.birthYear;
      const birthMonth = editingProfile.birthMonth;
      const calculatedAge = calculateAgeFromBirthYear(birthYear, birthMonth);
      setFormData({
        name: editingProfile.name,
        gender: editingProfile.gender,
        age: calculatedAge,
        birthYear: birthYear,
        birthMonth: birthMonth,
        heightCm: editingProfile.heightCm,
        ethnicity: editingProfile.ethnicity,
        isDefault: editingProfile.isDefault,
      });
    }
  }, [editingProfile]);

  // Handle form field changes
  const handleChange = (field: keyof ProfileFormData, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error for this field
    if (validationErrors[field as keyof ProfileValidationErrors]) {
      setValidationErrors({
        ...validationErrors,
        [field]: undefined,
      });
    }
  };

  // Handle birth year change - updates both birthYear and age
  const handleBirthYearChange = (year: number) => {
    const age = calculateAgeWithMonth(year, formData.birthMonth);
    setFormData((prev) => ({
      ...prev,
      birthYear: year,
      age: age,
    }));

    // Clear age error
    if (validationErrors.age) {
      setValidationErrors({
        ...validationErrors,
        age: undefined,
      });
    }
  };

  // Handle birth month change - updates both birthMonth and age
  const handleBirthMonthChange = (month: number | undefined) => {
    const age = calculateAgeWithMonth(formData.birthYear, month);
    setFormData((prev) => ({
      ...prev,
      birthMonth: month,
      age: age,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate (using age calculated from birth year)
    const dataToValidate: ProfileFormData = {
      name: formData.name,
      gender: formData.gender,
      age: formData.age,
      heightCm: formData.heightCm,
      ethnicity: formData.ethnicity,
      isDefault: formData.isDefault,
    };

    const errors = validateProfileData(dataToValidate);
    if (hasValidationErrors(errors)) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);

    try {
      if (editingProfile) {
        // Update existing profile via IPC
        const result = await window.electronAPI.updateProfile(editingProfile.id, {
          name: formData.name,
          gender: formData.gender,
          birthYear: formData.birthYear,
          birthMonth: formData.birthMonth,
          heightCm: formData.heightCm,
          ethnicity: formData.ethnicity,
        });

        if (result.success && result.data) {
          // Update local store with response from server
          const storedProfile = {
            ...result.data,
            createdAt:
              typeof result.data.createdAt === 'string'
                ? result.data.createdAt
                : result.data.createdAt.toISOString(),
            updatedAt:
              typeof result.data.updatedAt === 'string'
                ? result.data.updatedAt
                : result.data.updatedAt.toISOString(),
          };
          updateProfile(editingProfile.id, storedProfile);
          addNotification({
            type: 'success',
            title: t('profileEditor.updated'),
            duration: 3000,
          });
        } else {
          throw new Error(result.error?.message || 'Failed to update profile');
        }
      } else {
        // Create new profile via IPC
        const result = await window.electronAPI.createProfile({
          name: formData.name,
          gender: formData.gender,
          birthYear: formData.birthYear,
          birthMonth: formData.birthMonth,
          heightCm: formData.heightCm,
          ethnicity: formData.ethnicity,
        });

        if (result.success && result.data) {
          // Add to local store with response from server
          const storedProfile = {
            ...result.data,
            createdAt:
              typeof result.data.createdAt === 'string'
                ? result.data.createdAt
                : result.data.createdAt.toISOString(),
            updatedAt:
              typeof result.data.updatedAt === 'string'
                ? result.data.updatedAt
                : result.data.updatedAt.toISOString(),
          };
          addProfile(storedProfile);
          addNotification({
            type: 'success',
            title: t('profileEditor.created'),
            duration: 3000,
          });
        } else {
          throw new Error(result.error?.message || 'Failed to create profile');
        }
      }

      setIsEditing(false);
      clearValidationErrors();
      onComplete?.();
    } catch (error) {
      console.error('Error saving profile:', error);
      addNotification({
        type: 'error',
        title: t('profileEditor.saveError'),
        message: error instanceof Error ? error.message : t('profileEditor.saveErrorMessage'),
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    clearValidationErrors();
    onCancel?.();
  };

  return (
    <Card title={editingProfile ? t('profileEditor.editProfile') : t('profileEditor.newProfile')}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <FormInput
          label={t('profileEditor.profileName')}
          name="name"
          value={formData.name}
          onChange={(value) => handleChange('name', value)}
          error={validationErrors.name}
          placeholder={t('profileEditor.profileNamePlaceholder')}
          required
        />

        {/* Gender */}
        <FormSelect
          label={t('profileEditor.gender')}
          name="gender"
          value={formData.gender}
          onChange={(value) => handleChange('gender', value)}
          options={[
            { value: 'male', label: t('common:gender.male') },
            { value: 'female', label: t('common:gender.female') },
          ]}
          error={validationErrors.gender}
          required
        />

        {/* Birth date (year + optional month) */}
        <BirthDateSelector
          birthYear={formData.birthYear}
          birthMonth={formData.birthMonth}
          onYearChange={handleBirthYearChange}
          onMonthChange={handleBirthMonthChange}
          yearError={validationErrors.age}
          t={t}
        />

        {/* Height and Ethnicity row */}
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label={t('profileEditor.height')}
            name="heightCm"
            type="number"
            value={formData.heightCm}
            onChange={(value) => handleChange('heightCm', parseInt(value) || 0)}
            error={validationErrors.heightCm}
            min={90}
            max={220}
            required
            helperText={t('profileEditor.heightHelper')}
          />
        </div>

        {/* Default checkbox */}
        <FormCheckbox
          label={t('profileEditor.defaultProfile')}
          name="isDefault"
          checked={formData.isDefault}
          onChange={(checked) => handleChange('isDefault', checked)}
          helperText={t('profileEditor.defaultProfileHelper')}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            {t('common:buttons.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
          >
            {editingProfile ? t('common:buttons.saveChanges') : t('profileEditor.newProfile')}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProfileEditor;
