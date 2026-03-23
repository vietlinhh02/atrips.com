'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  step: number;
  onBack?: () => void;
  showBack?: boolean;
}

export default function OnboardingLayout({
  children,
  step,
  onBack,
  showBack = true,
}: OnboardingLayoutProps) {
  const router = useRouter();
  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (step > 1) {
      router.push(`/onboarding/step-${step - 1}`);
    }
  };

  return (
    <div className="h-dvh overflow-y-auto bg-[var(--neutral-10)]">
      <div className="mx-auto max-w-[800px] px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          {showBack && step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 text-sm font-medium text-[var(--neutral-70)] hover:text-[var(--neutral-100)]"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}
          <div className="text-sm font-medium text-[var(--neutral-60)]">
            Step {step} of {totalSteps}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-20)]">
          <div
            className="h-full bg-[var(--primary-main)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
