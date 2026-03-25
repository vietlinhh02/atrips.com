'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, PencilSimple, FileText, X } from '@phosphor-icons/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { type ChatMessage, type MessageAttachment } from '@/src/components/features/chat/types';
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

function AttachmentThumbnail({ attachment }: { attachment: MessageAttachment }) {
  const [expanded, setExpanded] = useState(false);
  const isImage = attachment.fileType === 'IMAGE';
  const proxyUrl = `${API_BASE}/uploads/${attachment.id}/file`;
  const imageUrl = attachment.previewUrl || proxyUrl;

  if (isImage && imageUrl) {
    return (
      <>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="overflow-hidden rounded-lg border border-[var(--neutral-30)]"
        >
          <img
            src={imageUrl}
            alt={attachment.fileName}
            crossOrigin="use-credentials"
            className="h-20 w-20 object-cover transition-transform hover:scale-105"
          />
        </button>
        {expanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={() => setExpanded(false)}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
            <img
              src={proxyUrl}
              alt={attachment.fileName}
              crossOrigin="use-credentials"
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2">
      <FileText size={18} className="shrink-0 text-[var(--neutral-60)]" />
      <span className="max-w-[150px] truncate text-[12px] text-[var(--neutral-70)]">
        {attachment.fileName}
      </span>
    </div>
  );
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
      {message.attachments && message.attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap justify-end gap-2">
          {message.attachments.map((att) => (
            <AttachmentThumbnail key={att.id} attachment={att} />
          ))}
        </div>
      )}
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
