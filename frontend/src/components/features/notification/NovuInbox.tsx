'use client';

import { Inbox } from '@novu/react';
import useAuthStore from '@/src/stores/authStore';
import { novuAppearance } from '@/src/components/features/notification/novuAppearance';

const NOVU_APP_ID = process.env.NEXT_PUBLIC_NOVU_APP_ID || '';

export default function NovuInbox() {
  const userId = useAuthStore((s) => s.user?.id);

  if (!userId || !NOVU_APP_ID) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={NOVU_APP_ID}
      subscriber={userId}
      appearance={novuAppearance}
    />
  );
}
