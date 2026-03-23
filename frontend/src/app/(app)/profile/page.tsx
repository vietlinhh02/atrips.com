'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/src/stores/authStore';

export default function ProfilePage() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (userId) {
      router.replace(`/profile/${userId}`);
    } else {
      router.replace('/login');
    }
  }, [userId, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 rounded-full border-[3px] border-[var(--primary-surface)] border-t-[var(--primary-main)] animate-spin" />
    </div>
  );
}
