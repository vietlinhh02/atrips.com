'use client';

import { Inbox, InboxContent } from '@novu/react';
import useAuthStore from '@/src/stores/authStore';
import { novuAppearance } from '@/src/components/features/notification/novuAppearance';

const NOVU_APP_ID = process.env.NEXT_PUBLIC_NOVU_APP_ID || '';

export default function NotificationsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6 md:px-6 [&_.nv-inbox-content]:min-h-[calc(100vh-140px)]">
      {user?.id && NOVU_APP_ID ? (
        <Inbox
          applicationIdentifier={NOVU_APP_ID}
          subscriber={user.id}
          appearance={novuAppearance}
        >
          <InboxContent />
        </Inbox>
      ) : (
        <div className="flex flex-col items-center py-12 text-[var(--neutral-50)]">
          Loading notifications...
        </div>
      )}
    </div>
  );
}
