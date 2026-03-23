'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/src/stores/authStore';
import LoadingScreen from '@/src/components/layout/LoadingScreen';

interface AuthRedirectRouteProps {
    children: React.ReactNode;
}

/**
 * AuthRedirectRoute - Redirects authenticated users to home page
 * Use this for auth pages (login, signup, forgot-password, reset-password)
 * to prevent logged-in users from accessing them
 */
export default function AuthRedirectRoute({ children }: AuthRedirectRouteProps) {
    const router = useRouter();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            router.replace('/');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return <LoadingScreen message="Đang chuyển hướng..." />;
    }

    if (isAuthenticated) {
        return null; // Will redirect to dashboard
    }

    return <>{children}</>;
}
