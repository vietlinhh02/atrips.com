'use client';

import { ArrowLineLeft, ArrowLineRight } from '@phosphor-icons/react';

interface ChatPanelToggleProps {
  isPanelOpen: boolean;
  onToggle: () => void;
}

export default function ChatPanelToggle({
  isPanelOpen,
  onToggle,
}: ChatPanelToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-2 text-[var(--neutral-70)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)] hover:bg-[var(--neutral-20)] transition-colors"
      aria-label={isPanelOpen ? 'Close chat' : 'Open chat'}
    >
      {isPanelOpen ? (
        <ArrowLineLeft size={18} weight="bold" />
      ) : (
        <ArrowLineRight size={18} weight="bold" />
      )}
    </button>
  );
}
