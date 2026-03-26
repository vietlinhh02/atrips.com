'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import travelProfileService, {
  type TravelProfileOptions,
  type TravelProfileStep2,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';
import useOnboardingStore from '@/src/stores/onboardingStore';
import useAuthStore from '@/src/stores/authStore';
export default function OnboardingStep2() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const data = useOnboardingStore((state) => state.data);
  const updateStep2 = useOnboardingStore((state) => state.updateStep2);
  const loadFromBackend = useOnboardingStore((state) => state.loadFromBackend);
  const [options, setOptions] = useState<TravelProfileOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<TravelProfileStep2>(data.step2);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      // Check if user email is verified
      if (user && !user.emailVerified) {
        setLoading(false);
        router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      // Allow editing if coming from result page
      const params = new URLSearchParams(window.location.search);
      const isEditing = params.get('edit') === 'true';

      if (isEditing) {
        await loadFromBackend();
        loadOptions();
      } else {
        const canContinue = await guardStepAccess(2);
        if (canContinue) {
          loadOptions();
        } else {
          setLoading(false);
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync formData changes to context
  useEffect(() => {
    setFormData(data.step2);
  }, [data.step2]);

  // Sync formData to store when it changes (debounced to avoid infinite loops)
  useEffect(() => {
    // Only update if formData is different from store
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(data.step2);
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateStep2(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const guardStepAccess = async (expectedStep: number) => {
    try {
      const { needsOnboarding, currentStep } = await travelProfileService.needsOnboarding();
      if (!needsOnboarding) {
        router.replace('/dashboard');
        return false;
      }
      if (currentStep !== expectedStep) {
        // Step 4 is the result page
        const targetRoute = currentStep === 4
          ? '/onboarding/result'
          : `/onboarding/step-${currentStep}`;
        router.replace(targetRoute);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const loadOptions = async () => {
    try {
      const opts = await travelProfileService.getOptions();
      setOptions(opts);

      // Default to middle option when empty (fixes slider not responding at first position)
      setFormData(prev => {
        let changed = false;
        const next = { ...prev };
        if (!next.spendingHabits && opts.spendingHabits.length > 1) {
          next.spendingHabits = opts.spendingHabits[1].value;
          changed = true;
        }
        if (!next.dailyRhythm && opts.dailyRhythm.length > 1) {
          next.dailyRhythm = opts.dailyRhythm[1].value;
          changed = true;
        }
        if (!next.socialPreference && opts.socialPreference.length > 1) {
          next.socialPreference = opts.socialPreference[1].value;
          changed = true;
        }
        return changed ? next : prev;
      });
    } catch {
      toast.error('Failed to load options', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

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
      router.push('/onboarding/step-3');
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

  if (loading) {
    return (
      <div className="grid min-h-[300px] place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--neutral-20)] border-t-[var(--primary-main)]" />
          <p className="text-sm text-[var(--neutral-60)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!options) {
    return null;
  }

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
              className="absolute top-1/2 size-[24px] -translate-y-1/2 rounded-full border border-[var(--primary-main)] bg-white shadow-[0_2px_6px_rgba(16,24,40,0.15)]"
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
