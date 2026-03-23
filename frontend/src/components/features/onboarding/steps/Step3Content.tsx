'use client';

import { useState, useEffect } from 'react';
import travelProfileService, {
  type TravelProfileOptions,
  type TravelProfileStep3,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';
import useOnboardingStore from '@/src/stores/onboardingStore';

interface Step3ContentProps {
  options: TravelProfileOptions;
  formData: TravelProfileStep3;
  onNext: () => void;
}

export default function Step3Content({ options, formData: initialData, onNext }: Step3ContentProps) {
  const updateStep3 = useOnboardingStore((state) => state.updateStep3);
  const clearData = useOnboardingStore((state) => state.clearData);
  const [formData, setFormData] = useState<TravelProfileStep3>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync formData to store when it changes
  useEffect(() => {
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(initialData);
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateStep3(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const handleTypeToggle = (value: string) => {
    setFormData((prev) => {
      const types = prev.travelerTypes.includes(value)
        ? prev.travelerTypes.filter((t) => t !== value)
        : prev.travelerTypes.length < 3
          ? [...prev.travelerTypes, value]
          : prev.travelerTypes;
      return { ...prev, travelerTypes: types };
    });
    setErrors((prev) => ({ ...prev, travelerTypes: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const validationMessages = options?.validationMessages || {};

    if (formData.travelerTypes.length === 0) {
      newErrors.travelerTypes =
        validationMessages.travelerTypesRequired || 'Please select 1 to 3 traveler types';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      await travelProfileService.updateStep3(formData);
      toast.success('Profile complete!', 'Generating your persona...');
      clearData(); // Clear cache after successful completion
      onNext();
    } catch (error: unknown) {
      const data = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string | { message?: string } } } }).response?.data
        : undefined;
      const rawError = data?.error;
      const message = typeof rawError === 'string'
        ? rawError
        : rawError?.message || 'Failed to save progress';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = formData.travelerTypes.length;
  const maxReached = selectedCount >= 3;

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-[32px] font-medium leading-[1.2] text-[var(--neutral-100)] lg:text-[40px]">
          What Describes You as Traveler
        </h1>
        <p className="text-sm text-[var(--neutral-60)]">
          Select up to 3 travel type that resonate with you most
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--neutral-100)]">
            What do you typically travel with?
          </p>
          <div className="flex flex-wrap gap-2">
            {options.travelerTypes.map((type) => {
              const selected = formData.travelerTypes.includes(type.value);
              const disabled = maxReached && !selected;

              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeToggle(type.value)}
                  disabled={disabled}
                  className={`rounded-[6px] border px-4 py-2 text-sm transition ${
                    selected
                      ? 'border-[var(--primary-main)] text-[var(--primary-main)]'
                      : 'border-[var(--neutral-40)] text-[var(--neutral-100)]'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
          {errors.travelerTypes && (
            <p className="text-sm text-red-500">{errors.travelerTypes}</p>
          )}
        </div>

        <Button
          type="submit"
          className="h-[44px] w-full rounded-[10px] bg-[var(--primary-main)] text-white shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
          disabled={submitting || selectedCount === 0}
        >
          {submitting ? 'Creating your persona...' : 'Next'}
        </Button>
      </form>
    </>
  );
}
