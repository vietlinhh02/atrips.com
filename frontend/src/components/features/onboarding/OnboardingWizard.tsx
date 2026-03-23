'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import travelProfileService, {
  type TravelProfileOptions,
} from '@/src/services/travelProfileService';
import { toast } from '@/src/components/ui/use-toast';
import useOnboardingStore from '@/src/stores/onboardingStore';
import useAuthStore from '@/src/stores/authStore';
import Step1Content from './steps/Step1Content';
import Step2Content from './steps/Step2Content';
import Step3Content from './steps/Step3Content';

export default function OnboardingWizard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const data = useOnboardingStore((state) => state.data);
  const loadFromBackend = useOnboardingStore((state) => state.loadFromBackend);

  const [currentStep, setCurrentStep] = useState(1);
  const [options, setOptions] = useState<TravelProfileOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    const init = async () => {
      if (user && !user.emailVerified) {
        router.replace(`/verify-email?email=${encodeURIComponent(user.email)}`);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const isEditing = params.get('edit') === 'true';
      const stepParam = params.get('step');

      if (isEditing) {
        await loadFromBackend();
        if (stepParam) {
          const step = parseInt(stepParam);
          if (step >= 1 && step <= 3) {
            setCurrentStep(step);
          }
        }
      } else {
        const canContinue = await guardStepAccess();
        if (!canContinue) {
          setLoading(false);
          return;
        }
      }

      // Prefetch options once
      await loadOptions();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardStepAccess = async () => {
    try {
      const { needsOnboarding, currentStep: backendStep } = await travelProfileService.needsOnboarding();
      if (!needsOnboarding) {
        router.replace('/');
        return false;
      }
      if (backendStep === 4) {
        router.replace('/onboarding/result');
        return false;
      }
      setCurrentStep(backendStep);
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

  const handleNext = async () => {
    setDirection('forward');
    // Small delay to allow animation to start
    setTimeout(() => {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        router.push('/onboarding/result');
      }
    }, 50);
  };

  const handleBack = () => {
    setDirection('backward');
    // Small delay to allow animation to start
    setTimeout(() => {
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
      }
    }, 50);
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

  return (
    <div className="relative overflow-hidden">
      <div
        className={`transition-all duration-500 ease-in-out ${direction === 'forward'
            ? 'animate-slideInFromRight'
            : 'animate-slideInFromLeft'
          }`}
        key={currentStep}
      >
        {currentStep === 1 && (
          <Step1Content
            options={options}
            formData={data.step1}
            onNext={handleNext}
          />
        )}
        {currentStep === 2 && (
          <Step2Content
            options={options}
            formData={data.step2}
            onNext={handleNext}
          />
        )}
        {currentStep === 3 && (
          <Step3Content
            options={options}
            formData={data.step3}
            onNext={handleNext}
          />
        )}
      </div>
    </div>
  );
}
