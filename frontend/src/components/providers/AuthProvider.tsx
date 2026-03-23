'use client';

import { useEffect } from 'react';
import useAuthStore from '@/src/stores/authStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isAuthenticated) {
      fetchCurrentUser();
    } else {
      useAuthStore.setState({ isLoading: false });
    }
  }, [hasHydrated, isAuthenticated, fetchCurrentUser]);

  return <>{children}</>;
}
