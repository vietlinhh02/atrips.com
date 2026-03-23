'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import useAuthStore from '@/src/stores/authStore';
import travelProfileService from '@/src/services/travelProfileService';
import { getPostLoginRedirect } from '@/src/lib/pendingChat';
import LoadingScreen from '@/src/components/layout/LoadingScreen';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const handleGoogleCallback = useAuthStore((state) => state.handleGoogleCallback);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      // Check URL for error parameter
      const searchParams = new URLSearchParams(window.location.search);
      const error = searchParams.get('error');

      if (error) {
        setError(`Google authentication failed: ${error}`);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      try {
        // ✅ Uses cookie-based auth now (no URL token extraction)
        await handleGoogleCallback();

        // Check if user needs onboarding
        try {
          const { needsOnboarding, currentStep } = await travelProfileService.needsOnboarding();

          if (needsOnboarding) {
            // Step 4 is the result page
            const targetRoute = currentStep === 4
              ? '/onboarding/result'
              : `/onboarding?step=${currentStep}`;
            router.push(targetRoute);
            return;
          }
        } catch {
          // If onboarding check fails, continue
        }

        // Check for pending chat message or redirect to home
        const redirectUrl = await getPostLoginRedirect('/');
        router.push(redirectUrl);
      } catch {
        setError('Đăng nhập Google thất bại. Vui lòng thử lại.');
        setTimeout(() => router.push('/login'), 3000);
      }
    };

    handleCallback();
  }, [handleGoogleCallback, router]);

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-white flex items-center justify-center"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center px-6"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-rose-600 font-medium mb-2">{error}</p>
          <p className="text-neutral-500 text-sm">Đang chuyển hướng...</p>
        </motion.div>
      </motion.div>
    );
  }

  return <LoadingScreen message="Đang xác thực với Google..." />;
}
