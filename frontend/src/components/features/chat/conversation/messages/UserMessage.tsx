'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Copy, PencilSimple } from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { type ChatMessage } from '@/src/components/features/chat/types';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';

interface UserMessageProps {
  message: ChatMessage;
  user: {
    avatarUrl?: string;
    email?: string;
    name?: string;
    displayName?: string;
  } | null;
}

const UserMessage = memo(({ message, user }: UserMessageProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    className="ml-auto flex w-full flex-col items-end gap-2"
  >
    <div className="flex items-center gap-3">
      <span className="font-['Inter_Tight'] text-[16px] font-medium text-[var(--neutral-100)]">You</span>
      <Avatar className="h-8 w-8 border border-[var(--neutral-30)] bg-[var(--neutral-20)]">
        <AvatarImage
          src={
            user?.avatarUrl ||
            getDefaultAvatarUrl(user?.email, user?.name)
          }
          alt={user?.name || user?.displayName || 'You'}
        />
        <AvatarFallback>
          {(user?.name || user?.displayName || 'Y').charAt(0)}
        </AvatarFallback>
      </Avatar>
    </div>
    <div className="flex w-full flex-col items-end pr-8 md:pr-11">
      <div className="max-w-[480px] rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 md:px-4 py-3 text-[14px] leading-[1.5] text-[var(--neutral-70)] shadow-sm">
        {message.content}
      </div>
      <div className="mt-3 flex items-center gap-3 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)]">
          <Copy size={20} />
        </button>
        <button className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)]">
          <PencilSimple size={20} />
        </button>
      </div>
    </div>
  </motion.div>
));

UserMessage.displayName = 'UserMessage';

export default UserMessage;
