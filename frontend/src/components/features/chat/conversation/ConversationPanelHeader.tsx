'use client';

import { ChatCircleDots, MagnifyingGlass, BookmarkSimple } from '@phosphor-icons/react';

export default function ConversationPanelHeader() {
  return (
    <div className="flex flex-col gap-4 p-3 md:p-6 pb-2 border-b border-transparent">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-1 rounded-[10px] bg-[var(--neutral-100)] px-3 py-1.5 text-white shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
          <span className="flex h-7 w-7 items-center justify-center">
            <ChatCircleDots size={18} weight="regular" />
          </span>
          <span className="text-[14px] font-normal leading-[1.5]">Chat</span>
        </div>
        <div className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]">
          <span className="flex h-7 w-7 items-center justify-center">
            <MagnifyingGlass size={18} weight="regular" />
          </span>
          <span className="text-[14px] font-normal leading-[1.5]">Search</span>
        </div>
        <div className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]">
          <span className="flex h-7 w-7 items-center justify-center">
            <BookmarkSimple size={18} weight="regular" />
          </span>
          <span className="text-[14px] font-normal leading-[1.5]">Saved</span>
        </div>
      </div>
    </div>
  );
}
