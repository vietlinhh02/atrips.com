'use client';

import { useRouter } from 'next/navigation';
import { UserPlus, Bag, List, CaretDown, Bell } from "@phosphor-icons/react";
import useSidebarStore from "@/src/stores/sidebarStore";
import useChatStore from "@/src/stores/chatStore";
import NovuInbox from "@/src/components/features/notification/NovuInbox";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const router = useRouter();
  const { toggleCollapse } = useSidebarStore();
  const createConversation = useChatStore((s) => s.createConversation);
  const resetConversation = useChatStore((s) => s.resetConversation);

  const handleCreateTrip = async () => {
    resetConversation();
    const id = await createConversation(undefined, 'New Trip');
    if (id) {
      router.push(`/chat/${id}`);
    }
  };

  return (
    <header className="relative z-20 bg-[var(--neutral-10)] border-b border-[var(--neutral-30)] w-full flex justify-between items-center px-4 md:px-6 py-3">
      <div className="flex items-center gap-4">
        {/* Mobile Sidebar Toggle */}
        <button
          className="md:hidden p-2 text-[var(--neutral-70)]"
          onClick={toggleCollapse}
          aria-label="Toggle sidebar"
        >
          <List size={24} />
        </button>

        {/* Mobile Logo */}
        <button
          onClick={() => router.push('/')}
          className="md:hidden text-xl font-normal text-[#073e71] font-logo"
          aria-label="Go to home"
        >
          atrips.me
        </button>

        {title && (
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-medium text-[var(--neutral-100)] leading-[1.2]">
              {title}
            </h1>
            <CaretDown size={16} className="text-[var(--neutral-100)]" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell — popup on desktop, navigate on mobile */}
        <div className="relative z-[60] hidden md:block">
          <NovuInbox />
        </div>
        <button
          className="md:hidden p-2 text-[var(--neutral-70)] hover:text-[var(--neutral-100)] transition-colors"
          onClick={() => router.push('/notifications')}
          aria-label="Notifications"
        >
          <Bell size={22} />
        </button>

        {/* Divider */}
        <div className="h-3 w-px bg-[var(--neutral-30)] hidden sm:block" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Invite Button */}
          <button
            className="hidden sm:flex border border-[var(--neutral-40)] rounded-[4px] px-3 py-1.5 items-center gap-1 hover:bg-[var(--neutral-20)] transition-colors text-[14px]"
            aria-label="Invite users"
          >
            <UserPlus size={16} weight="regular" />
            <span className="text-[var(--neutral-100)] font-normal leading-[1.5]">
              Invite
            </span>
          </button>

          {/* Create a Trip Button */}
          <button
            onClick={handleCreateTrip}
            className="bg-[var(--primary-main)] rounded-[4px] px-3 py-1.5 flex items-center gap-1 hover:bg-[var(--primary-hover)] transition-colors text-[14px]"
            aria-label="Create a new trip"
          >
            <Bag size={16} weight="regular" className="text-white" />
            <span className="text-white font-normal leading-[1.5]">
              Create a Trip
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
