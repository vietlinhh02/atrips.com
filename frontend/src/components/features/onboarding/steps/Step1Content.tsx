'use client';

import { useState, useEffect } from 'react';
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

interface Step1ContentProps {
  options: TravelProfileOptions;
  formData: TravelProfileStep1;
  onNext: () => void;
}

export default function Step1Content({ options, formData: initialData, onNext }: Step1ContentProps) {
  const updateStep1 = useOnboardingStore((state) => state.updateStep1);
  const user = useAuthStore((state) => state.user);
  const [formData, setFormData] = useState<TravelProfileStep1>(initialData);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill from user registration data and set defaults
  useEffect(() => {
    if (!user) return;
    setFormData(prev => {
      let changed = false;
      const next = { ...prev };

      // Always pre-fill from auth if form firstName is empty
      if (!next.firstName && user.name) {
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

      return changed ? next : prev;
    });
  }, [user, initialData]);

  const samplePlaceholders = {
    firstName: 'Viet',
    lastName: 'Linh',
    age: '28',
    location: 'Hanoi, Vietnam',
  };

  const inputClassName =
    'rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2.5 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-60)] focus-visible:border-[var(--neutral-30)] focus-visible:ring-0';

  // Sync formData to store when it changes
  useEffect(() => {
    const isDifferent = JSON.stringify(formData) !== JSON.stringify(initialData);
    if (isDifferent) {
      const timer = setTimeout(() => {
        updateStep1(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

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
