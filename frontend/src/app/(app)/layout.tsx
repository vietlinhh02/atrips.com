'use client';

import { usePathname } from 'next/navigation';
import ProtectedRoute from '@/src/components/features/auth/ProtectedRoute';
import Sidebar from '@/src/components/layout/Sidebar';
import Header from '@/src/components/layout/Header';

const PUBLIC_PATHS = ['/', '/explore', '/stories', '/guides', '/community'];
const PUBLIC_PATH_PREFIXES = ['/trips/shared/'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith('/chat/');
  const isPublicPage = PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const content = (
    <div className="flex h-dvh bg-white overflow-hidden">
      <div className="shrink-0 h-full z-50">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {!isChatPage && (
          <div className="shrink-0">
            <Header />
          </div>
        )}

        <main className={`flex-1 flex flex-col ${isChatPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  );

  if (isPublicPage) {
    return content;
  }

  return <ProtectedRoute>{content}</ProtectedRoute>;
}
