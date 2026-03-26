'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import travelProfileService, {
  type TravelProfileOptions,
  type TravelProfileStep1,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import useOnboardingStore from '@/src/stores/onboardingStore';
import useAuthStore from '@/src/stores/authStore';
export default function OnboardingStep1() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const data = useOnboardingStore((state) => state.data);
  const updateStep1 = useOnboardingStore((state) => state.updateStep1);
  const loadFromBackend = useOnboardingStore((state) => state.loadFromBackend);
  const [options, setOptions] = useState<TravelProfileOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<TravelProfileStep1>(data.step1);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const samplePlaceholders = {
    firstName: 'Viet',
    lastName: 'Linh',
    age: '28',
    location: 'Hanoi, Vietnam',
  };

  const inputClassName =
    'rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2.5 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-60)] focus-visible:border-[var(--neutral-30)] focus-visible:ring-0';

  useEffect(() => {
    const init = async () => {
      // Check if user email is verified
      if (user && !user.emailVerified) {
        router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const isEditing = params.get('edit') === 'true';

      if (isEditing) {
        await loadFromBackend();
        loadOptions();
      } else {
        const canContinue = await guardStepAccess(1);
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

  // Sync store data and pre-fill from user auth in a single effect
  // to avoid race condition where store hydration overwrites user pre-fill
  useEffect(() => {
    const step1 = data.step1;
    const next = { ...step1 };
    let changed = false;

    if (!next.firstName && user?.name) {
      const parts = user.name.trim().split(/\s+/);
      next.firstName = parts[0] || '';
      next.lastName = parts.slice(1).join(' ') || '';
      changed = true;
    }

    if (!next.age || next.age === 0) {
      next.age = 25;
      changed = true;
    }

    if (!next.gender) {
      next.gender = 'prefer_not_to_say';
      changed = true;
    }

    setFormData(changed ? next : step1);
  }, [data.step1, user]);

  // Sync formData to store when it changes (debounced to avoid infinite loops)
  useEffect(() => {
    // Only update if formData is different from store
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(data.step1);
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateStep1(formData);
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
    } catch {
      toast.error('Failed to load options', 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanionToggle = (value: string) => {
    setFormData((prev) => {
      const companions = prev.travelCompanions.includes(value)
        ? prev.travelCompanions.filter((c) => c !== value)
        : [...prev.travelCompanions, value];
      return { ...prev, travelCompanions: companions };
    });
    setErrors((prev) => ({ ...prev, travelCompanions: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const validationMessages = options?.validationMessages || {};

    if (!formData.firstName || formData.firstName.trim().length < 2) {
      newErrors.firstName =
        validationMessages.firstNameMinLength || 'First name must be at least 2 characters';
    }

    if (!formData.lastName || formData.lastName.trim().length < 2) {
      newErrors.lastName =
        validationMessages.lastNameMinLength || 'Last name must be at least 2 characters';
    }

    if (!formData.age || formData.age < 13 || formData.age > 120) {
      newErrors.age = validationMessages.ageRange || 'Age must be between 13 and 120';
    }

    if (!formData.gender) {
      newErrors.gender = validationMessages.genderRequired || 'Please select your gender';
    }

    if (formData.travelCompanions.length === 0) {
      newErrors.travelCompanions =
        validationMessages.travelCompanionsRequired || 'Please select at least one option';
    }

    if (!formData.location || formData.location.trim().length === 0) {
      newErrors.location = validationMessages.locationRequired || 'Location is required';
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
      await travelProfileService.updateStep1(formData);
      toast.success('Progress saved', 'Moving to next step');
      router.push('/onboarding/step-2');
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

  const figmaCopy = {
    title: 'Build Your Travel Profile',
    subtitle:
      "Setting up your profile is quick and easy, and it's the first step toward accessing all the features and benefits of TripMind.",
    question: 'What do you typically travel with?',
    ctaNext: 'Next',
  };

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-[32px] font-medium leading-[1.2] text-[var(--neutral-100)] lg:text-[40px]">
          {figmaCopy.title}
        </h1>
        <p className="text-sm text-[var(--neutral-60)]">{figmaCopy.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--neutral-100)]">
                      First Name
                    </label>
                    <Input
                      placeholder={samplePlaceholders.firstName}
                      value={formData.firstName}
                      className={inputClassName}
                      onChange={(e) => {
                        setFormData({ ...formData, firstName: e.target.value });
                        setErrors((prev) => ({ ...prev, firstName: '' }));
                      }}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--neutral-100)]">
                      Last Name
                    </label>
                    <Input
                      placeholder={samplePlaceholders.lastName}
                      value={formData.lastName}
                      className={inputClassName}
                      onChange={(e) => {
                        setFormData({ ...formData, lastName: e.target.value });
                        setErrors((prev) => ({ ...prev, lastName: '' }));
                      }}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--neutral-100)]">
                      Age
                    </label>
                    <Input
                      type="number"
                      placeholder={samplePlaceholders.age}
                      value={formData.age || ''}
                      className={inputClassName}
                      onChange={(e) => {
                        setFormData({ ...formData, age: parseInt(e.target.value) || 0 });
                        setErrors((prev) => ({ ...prev, age: '' }));
                      }}
                      min={13}
                      max={120}
                    />
                    {errors.age && <p className="mt-1 text-sm text-red-500">{errors.age}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[var(--neutral-100)]">
                      Gender
                    </label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => {
                        setFormData({ ...formData, gender: value });
                        setErrors((prev) => ({ ...prev, gender: '' }));
                      }}
                    >
                      <SelectTrigger className="pr-10">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.genders.map((gender) => (
                          <SelectItem key={gender.value} value={gender.value}>
                            {gender.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-red-500">{errors.gender}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[var(--neutral-100)]">
                    {figmaCopy.question}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {options.travelCompanions.map((companion) => {
                      const selected = formData.travelCompanions.includes(companion.value);
                      return (
                        <button
                          key={companion.value}
                          type="button"
                          onClick={() => handleCompanionToggle(companion.value)}
                          className={`rounded-[4px] border px-3 py-1.5 text-sm transition ${
                            selected
                              ? 'border-[var(--primary-main)] text-[var(--primary-main)]'
                              : 'border-[var(--neutral-40)] text-[var(--neutral-100)]'
                          }`}
                        >
                          {companion.label}
                        </button>
                      );
                    })}
                  </div>
                  {errors.travelCompanions && (
                    <p className="text-sm text-red-500">{errors.travelCompanions}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--neutral-100)]">
                    Location
                  </label>
                  <Input
                    placeholder={samplePlaceholders.location}
                    value={formData.location}
                    className={inputClassName}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value });
                      setErrors((prev) => ({ ...prev, location: '' }));
                    }}
                  />
                  {errors.location && (
                    <p className="mt-1 text-sm text-red-500">{errors.location}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="h-[44px] w-full rounded-[10px] bg-[var(--primary-main)] text-sm font-medium text-white shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : figmaCopy.ctaNext}
                </Button>
              </form>
    </>
  );
}
