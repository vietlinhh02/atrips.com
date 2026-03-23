'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import travelProfileService from '@/src/services/travelProfileService';
import useAuthStore from '@/src/stores/authStore';

export default function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!_hasHydrated || isLoading || hasCheckedRef.current) return;

    const skipPages =
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/verify-email') ||
      pathname.startsWith('/auth/');

    if (skipPages || !isAuthenticated) {
      setChecking(false);
      return;
    }

    hasCheckedRef.current = true;

    travelProfileService.needsOnboarding()
      .then(({ needsOnboarding, currentStep }) => {
        if (needsOnboarding) {
          const targetRoute = currentStep === 4
            ? '/onboarding/result'
            : `/onboarding?step=${currentStep}`;
          router.push(targetRoute);
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
    // Only run when auth state is ready, not on every pathname change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, isLoading, isAuthenticated]);

  if (checking || isLoading || !_hasHydrated) {
    return (
      <div className="grid h-dvh place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--neutral-20)] border-t-[var(--primary-main)]" />
          <p className="text-sm text-[var(--neutral-60)]">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
