'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useRouter } from 'next/navigation';

import useAuthStore from '@/src/stores/authStore';
import useChatStore from '@/src/stores/chatStore';
import { type ChatMessage } from '@/src/components/features/chat/types';

import ConversationPanelHeader from './ConversationPanelHeader';
import ChatInputArea from './ChatInputArea';
import MessageItem from './messages/MessageItem';

interface ChatConversationPanelProps {
  activeMobileTab?: 'chat' | 'map';
  onMobileTabChange?: (tab: 'chat' | 'map') => void;
  showTripPlan?: boolean;
  onTripPlanOpen?: () => void;
}

export default function ChatConversationPanel({
  activeMobileTab,
  onMobileTabChange,
  showTripPlan,
  onTripPlanOpen,
}: ChatConversationPanelProps = {}) {
  const user = useAuthStore((state) => state.user);
  const messages = useChatStore((state) => state.messages);
  const inputValue = useChatStore((state) => state.inputValue);
  const isSubmitting = useChatStore((state) => state.isSubmitting);
  const setInputValue = useChatStore((state) => state.setInputValue);
  const suggestions = useChatStore((state) => state.suggestions);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const createConversation = useChatStore((state) => state.createConversation);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const router = useRouter();

  const handleNewChat = useCallback(async () => {
    const conversationId = await createConversation();
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    }
  }, [createConversation, router]);

  // Check if any message is currently streaming
  const isAnyStreaming = useMemo(() =>
    messages.some(msg => msg.isStreaming),
    [messages]
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          behavior: isAnyStreaming ? 'auto' : 'smooth',
          align: 'end',
        });
      }, 50);
    }
  }, [messages.length, isAnyStreaming]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        sendMessage(inputValue);
      }
    }
  }, [inputValue, sendMessage]);

  const handleSend = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  // Render function for virtuoso
  const itemContent = useCallback((index: number, message: ChatMessage) => {
    const prevMessage = index > 0 ? messages[index - 1] : undefined;
    return <MessageItem message={message} user={user} prevMessage={prevMessage} />;
  }, [user, messages]);

  return (
    <div className="flex h-full w-full md:max-w-[480px] flex-col overflow-hidden md:rounded-[12px] bg-[var(--neutral-10)] md:border md:border-[var(--neutral-30)] md:shadow-[6px_6px_32px_rgba(0,0,0,0.06)]">
      <ConversationPanelHeader />

      {/* Messages Area - Virtualized */}
      <div className="flex-1 overflow-hidden overflow-x-hidden min-h-0 px-3 md:px-6 pt-3 md:pt-6">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={messages}
          itemContent={itemContent}
          followOutput="smooth"
          initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
          className="scrollbar-hide overflow-x-hidden"
          overscan={5}
        />
      </div>

      <ChatInputArea
        inputValue={inputValue}
        isSubmitting={isSubmitting}
        suggestions={suggestions}
        onValueChange={setInputValue}
        onSend={handleSend}
        onNewChat={handleNewChat}
        onKeyDown={handleKeyDown}
        onSuggestionClick={handleSuggestionClick}
        activeMobileTab={activeMobileTab}
        onMobileTabChange={onMobileTabChange}
        showTripPlan={showTripPlan}
        onTripPlanOpen={onTripPlanOpen}
      />
    </div>
  );
}
