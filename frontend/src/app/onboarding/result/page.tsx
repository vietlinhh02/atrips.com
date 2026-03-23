'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import travelProfileService, {
  type TravelProfile,
  type TravelProfileOptions,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';
import { CaretRight } from '@phosphor-icons/react';
import useAuthStore from '@/src/stores/authStore';
export default function OnboardingResult() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<TravelProfile | null>(null);
  const [options, setOptions] = useState<TravelProfileOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [editableQuestions, setEditableQuestions] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Check if user email is verified
      if (user && !user.emailVerified) {
        router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      const canContinue = await guardAccess();
      if (canContinue) {
        loadData();
      } else {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardAccess = async () => {
    try {
      const { needsOnboarding, currentStep } = await travelProfileService.needsOnboarding();

      // If onboarding is complete, allow access to result page
      if (!needsOnboarding) {
        return true;
      }

      // If still need onboarding but not on step 4 (result), redirect to correct step
      if (needsOnboarding && currentStep !== 4) {
        const targetRoute = `/onboarding?step=${currentStep}`;
        router.replace(targetRoute);
        return false;
      }

      // If needsOnboarding and currentStep is 4, allow access to result page
      return true;
    } catch {
      return true;
    }
  };

  const loadData = async () => {
    try {
      const [profileData, optionsData] = await Promise.all([
        travelProfileService.getProfile(),
        travelProfileService.getOptions(),
      ]);

      if (!profileData) {
        router.push('/onboarding');
        return;
      }

      setProfile(profileData);
      setOptions(optionsData);
      setEditableQuestions(profileData?.personaSuggestedQuestions || []);

      // Initialize answers from existing personaAnswers or empty
      const existingAnswers = profileData?.personaAnswers || {};
      setAnswers(existingAnswers);
    } catch {
      toast.error('Failed to load profile', 'Please try again');
      router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnswers = async () => {
    // Only save if there are answers
    const hasAnswers = Object.keys(answers).some((key) => answers[key]?.trim());
    if (!hasAnswers) {
      toast.error('Please provide at least one answer');
      return;
    }

    setSavingAnswers(true);
    try {
      await travelProfileService.updateStep4(answers);
      toast.success('Answers saved successfully!');
      // Reload profile to get updated data
      const updatedProfile = await travelProfileService.getProfile();
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data?.error?.message
          || (error as { response?: { data?: { message?: string } } }).response?.data?.message
          || 'Failed to save answers'
        : 'Failed to save answers';
      toast.error(message);
    } finally {
      setSavingAnswers(false);
    }
  };

  const handleContinue = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="grid min-h-[300px] place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--neutral-20)] border-t-[var(--primary-main)]" />
          <p className="text-sm text-[var(--neutral-60)]">Loading your persona...</p>
        </div>
      </div>
    );
  }

  if (!profile || !options) {
    return null;
  }

  const { result: copy } = options.uiCopy;
  const selectedTypes = options.travelerTypes.filter((type) =>
    profile.travelerTypes.includes(type.value),
  );

  return (
      <div className="pt-6">
        <div className="space-y-3">
          <h1 className="text-[32px] font-medium leading-[1.2] text-[var(--neutral-100)] lg:text-[40px]">
            {profile.personaTitle || 'Your Travel Persona'}
          </h1>
          <p className="text-sm text-[var(--neutral-60)]">
            {profile.personaDescription || ''}
            {profile.personaDescription ? ' ' : ''}
            <button
              type="button"
              className="text-[var(--neutral-100)] underline underline-offset-2"
            >
              {copy.readMore || 'Read More'}
            </button>
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--neutral-100)]">
              {copy.interestsTitle || 'Interest'}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTypes.slice(0, 3).map((type) => (
                <span
                  key={type.value}
                  className="rounded-[4px] border border-[var(--primary-main)] px-3 py-1.5 text-sm text-[var(--primary-main)]"
                >
                  {type.label}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--neutral-20)] pt-6">
            <p className="mb-3 text-sm font-medium text-[var(--neutral-100)]">
              {copy.questionsTitle || 'Questions matching your profile'}
            </p>
            <div className="space-y-4">
              {editableQuestions.slice(0, 4).map((question, index) => (
                <div key={`${question}-${index}`} className="space-y-2">
                  {editingIndex === index ? (
                    <input
                      value={question}
                      onChange={(event) => {
                        const next = [...editableQuestions];
                        next[index] = event.target.value;
                        setEditableQuestions(next);
                      }}
                      onBlur={() => setEditingIndex(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          setEditingIndex(null);
                        }
                      }}
                      autoFocus
                      className="w-full rounded-[8px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2 text-sm text-[var(--neutral-100)] outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingIndex(index)}
                      className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-[var(--neutral-100)]"
                    >
                      <span className="flex-1">{question}</span>
                      <CaretRight size={16} className="text-[var(--neutral-60)]" />
                    </button>
                  )}
                  <textarea
                    value={answers[question] || ''}
                    onChange={(e) => {
                      setAnswers((prev) => ({
                        ...prev,
                        [question]: e.target.value,
                      }));
                    }}
                    placeholder="Your answer..."
                    className="w-full rounded-[8px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-60)] outline-none resize-none"
                    rows={3}
                  />
                </div>
              ))}
            </div>
            {Object.keys(answers).some((key) => answers[key]?.trim()) && (
              <button
                type="button"
                onClick={handleSaveAnswers}
                disabled={savingAnswers}
                className="mt-4 w-full rounded-[10px] border border-[var(--primary-main)] bg-white px-4 py-2 text-sm font-medium text-[var(--primary-main)] hover:bg-[var(--neutral-10)] disabled:opacity-50"
              >
                {savingAnswers ? 'Saving answers...' : 'Save Answers'}
              </button>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <Button
              type="button"
              onClick={handleContinue}
              className="h-[44px] w-full rounded-[10px] bg-[var(--primary-main)] text-white shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] hover:bg-[var(--primary-hover)]"
            >
              {copy.ctaNext || 'Next'}
            </Button>
            <button
              type="button"
              className="h-[44px] w-full rounded-[10px] border border-[var(--neutral-30)] text-sm font-medium text-[var(--neutral-100)]"
            >
              {copy.ctaViewFullPersona || 'View Full Persona Page'}
            </button>
          </div>
        </div>
      </div>
  );
}
