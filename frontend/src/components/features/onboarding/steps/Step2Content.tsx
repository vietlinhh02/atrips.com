'use client';

import { useState, useEffect, useMemo } from 'react';
import travelProfileService, {
  type TravelProfileOptions,
  type TravelProfileStep2,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';
import useOnboardingStore from '@/src/stores/onboardingStore';

interface Step2ContentProps {
  options: TravelProfileOptions;
  formData: TravelProfileStep2;
  onNext: () => void;
}

export default function Step2Content({ options, formData: initialData, onNext }: Step2ContentProps) {
  const updateStep2 = useOnboardingStore((state) => state.updateStep2);
  const [formData, setFormData] = useState<TravelProfileStep2>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync formData to store when it changes
  useEffect(() => {
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(initialData);
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateStep2(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const validationMessages = options?.validationMessages || {};

    if (!formData.spendingHabits) {
      newErrors.spendingHabits =
        validationMessages.spendingHabitsRequired || 'Please select your spending habits';
    }

    if (!formData.dailyRhythm) {
      newErrors.dailyRhythm =
        validationMessages.dailyRhythmRequired || 'Please select your daily rhythm';
    }

    if (!formData.socialPreference) {
      newErrors.socialPreference =
        validationMessages.socialPreferenceRequired || 'Please select your social preference';
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
      await travelProfileService.updateStep2(formData);
      toast.success('Progress saved', 'Moving to next step');
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

  const sliderOptions = useMemo(() => {
    return {
      spendingHabits: options?.spendingHabits ?? [],
      dailyRhythm: options?.dailyRhythm ?? [],
      socialPreference: options?.socialPreference ?? [],
    };
  }, [options]);

  const { step2: copy } = options.uiCopy;

  const getIndex = (list: Array<{ value: string }>, value: string) => {
    const index = list.findIndex((item) => item.value === value);
    return index === -1 ? 0 : index;
  };

  const SliderRow = ({
    title,
    list,
    value,
    onChange,
    error,
  }: {
    title: string;
    list: Array<{ value: string; label: string }>;
    value: string;
    onChange: (next: string) => void;
    error?: string;
  }) => {
    const selectedIndex = getIndex(list, value);
    const maxIndex = Math.max(list.length - 1, 1);
    const percent = (selectedIndex / maxIndex) * 100;

    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--neutral-100)]">{title}</p>
        <div className="space-y-3">
          <div className="relative h-[24px]">
            <div className="absolute top-1/2 h-[8px] w-full -translate-y-1/2 rounded-full bg-[var(--neutral-40)] opacity-40" />
            <div
              className="absolute top-1/2 size-[24px] -translate-y-1/2 rounded-full border border-[var(--primary-main)] bg-white shadow-[0_2px_6px_rgba(16,24,40,0.15)] transition-all duration-300"
              style={{ left: `calc(${percent}% - 12px)` }}
            />
            <input
              type="range"
              min={0}
              max={maxIndex}
              step={1}
              value={selectedIndex}
              onChange={(event) => {
                const nextIndex = Number(event.target.value);
                const next = list[nextIndex]?.value ?? '';
                onChange(next);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={title}
            />
          </div>
          {list.length === 3 ? (
            <div className="grid w-full grid-cols-3 text-sm text-[var(--neutral-100)]">
              {list.map((item, index) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange(item.value)}
                  className={`text-sm ${
                    index === 0
                      ? 'text-left'
                      : index === 1
                        ? 'text-center'
                        : 'text-right'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm text-[var(--neutral-100)]">
              {list.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onChange(item.value)}
                  className="text-sm"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-[32px] font-medium leading-[1.2] text-[var(--neutral-100)] lg:text-[40px]">
          {copy.title}
        </h1>
        <p className="text-sm text-[var(--neutral-60)]">{copy.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <SliderRow
          title={copy.question1}
          list={sliderOptions.spendingHabits}
          value={formData.spendingHabits}
          onChange={(value) => {
            setFormData({ ...formData, spendingHabits: value });
            setErrors((prev) => ({ ...prev, spendingHabits: '' }));
          }}
          error={errors.spendingHabits}
        />

        <SliderRow
          title={copy.question2}
          list={sliderOptions.dailyRhythm}
          value={formData.dailyRhythm}
          onChange={(value) => {
            setFormData({ ...formData, dailyRhythm: value });
            setErrors((prev) => ({ ...prev, dailyRhythm: '' }));
          }}
          error={errors.dailyRhythm}
        />

        <SliderRow
          title={copy.question3}
          list={sliderOptions.socialPreference}
          value={formData.socialPreference}
          onChange={(value) => {
            setFormData({ ...formData, socialPreference: value });
            setErrors((prev) => ({ ...prev, socialPreference: '' }));
          }}
          error={errors.socialPreference}
        />

        <Button
          type="submit"
          className="h-[44px] w-full rounded-[10px] bg-[var(--primary-main)] text-white shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : copy.ctaNext}
        </Button>
      </form>
    </>
  );
}
