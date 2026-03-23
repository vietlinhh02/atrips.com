'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') {
        setShowHelp(false);
        return;
      }

      if (isTyping) return;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector(
          '[data-chat-input]',
        ) as HTMLTextAreaElement | null;
        if (input) {
          input.focus();
        } else {
          router.push('/');
        }
      }

      if (isMod && e.key === 'n') {
        e.preventDefault();
        router.push('/');
      }

      if (isMod && e.key === '/') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
    },
    [router],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
