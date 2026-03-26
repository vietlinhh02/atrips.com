'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Step4Redirect() {
  const router = useRouter();

  useEffect(() => {
    // Step 4 is the result page, redirect there
    router.replace('/onboarding/result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-[300px] place-items-center">
      <div className="text-center">
        <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--neutral-20)] border-t-[var(--primary-main)]" />
        <p className="text-sm text-[var(--neutral-60)]">Redirecting...</p>
      </div>
    </div>
  );
}
