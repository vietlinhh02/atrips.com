'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/src/stores/authStore';
import LoadingScreen from '@/src/components/layout/LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTier?: 'FREE' | 'PRO' | 'BUSINESS' | null;
}


export default function ProtectedRoute({ children, requireTier = null }: ProtectedRouteProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const subscription = useAuthStore((state) => state.subscription);
  const isLoading = useAuthStore((state) => state.isLoading);
  const _hasHydrated = useAuthStore((state) => state._hasHydrated);

  useEffect(() => {
    if (_hasHydrated && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router, _hasHydrated]);

  useEffect(() => {
    // Check tier requirement
    if (!isLoading && isAuthenticated && requireTier && subscription) {
      const tierOrder = { FREE: 0, PRO: 1, BUSINESS: 2 };
      const currentTier = subscription.tier;

      if (tierOrder[currentTier] < tierOrder[requireTier]) {
        router.push('/upgrade');
      }
    }
  }, [isLoading, isAuthenticated, requireTier, subscription, router]);

  if (isLoading || !_hasHydrated) {
    return <LoadingScreen message="Đang xác thực..." />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  // Check tier requirement
  if (requireTier && subscription) {
    const tierOrder = { FREE: 0, PRO: 1, BUSINESS: 2 };
    const currentTier = subscription.tier;

    if (tierOrder[currentTier] < tierOrder[requireTier]) {
      return null; // Will redirect to upgrade
    }
  }

  return <>{children}</>;
}
