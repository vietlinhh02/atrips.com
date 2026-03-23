'use client';

import { memo } from 'react';
import { type ChatMessage } from '@/src/components/features/chat/types';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';

interface MessageItemProps {
  message: ChatMessage;
  user: {
    avatarUrl?: string;
    email?: string;
    name?: string;
    displayName?: string;
  } | null;
  prevMessage?: ChatMessage; // For retry functionality
}

const MessageItem = memo(({ message, user, prevMessage }: MessageItemProps) => (
  <div className="flex flex-col gap-2 pb-6">
    {message.role === 'user' ? (
      <UserMessage message={message} user={user} />
    ) : (
      <AssistantMessage
        message={message}
        userMessageId={prevMessage?.role === 'user' ? prevMessage.id : undefined}
      />
    )}
  </div>
));

MessageItem.displayName = 'MessageItem';

export default MessageItem;
