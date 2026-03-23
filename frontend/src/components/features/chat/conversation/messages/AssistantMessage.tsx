'use client';

import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  ArrowCounterClockwise,
  ThumbsUp,
  ThumbsDown,
  Spinner,
  WarningCircle,
  Check,
} from '@phosphor-icons/react';
import { toast } from '@/src/components/ui/use-toast';
import AtripsAiMark from '@/src/components/common/brand/AtripsAiMark';
import { type ChatMessage } from '@/src/components/features/chat/types';
import MessageContent from '@/src/components/features/chat/message-content/MessageContent';
import FunctionCallsToggle from '@/src/components/features/chat/message-content/FunctionCallsToggle';
import SourcesList from '@/src/components/features/chat/message-content/SourcesList';
import useChatStore from '@/src/stores/chatStore';

interface AssistantMessageProps {
  message: ChatMessage;
  userMessageId?: string;
}

const AssistantMessage = memo(
  ({ message, userMessageId }: AssistantMessageProps) => {
    const { retryMessage, isSubmitting } = useChatStore();
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

    const hasSources = message.sources && message.sources.length > 0;
    const hasFunctionCalls =
      message.functionCalls && message.functionCalls.length > 0;
    const isThinking =
      message.isStreaming && !message.content && !hasFunctionCalls;
    const hasContent = message.content && message.content.length > 0;
    const hasError = message.error && !message.content;

    const handleRetry = () => {
      if (userMessageId && !isSubmitting) {
        retryMessage(userMessageId);
      }
    };

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    const handleFeedback = (type: 'up' | 'down') => {
      const next = feedback === type ? null : type;
      setFeedback(next);
      if (next) {
        toast.success('Cảm ơn phản hồi của bạn!');
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="group mr-auto flex w-full flex-col items-start gap-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-surface)] text-white shadow-sm">
            <AtripsAiMark size={20} />
          </div>
          <span className="font-logo text-[16px] font-normal text-[var(--neutral-100)]">
            Atripsme
          </span>
          {isThinking && (
            <span className="flex items-center gap-1.5 text-[13px] text-[var(--neutral-50)]">
              <Spinner
                size={14}
                className="animate-spin text-[var(--primary-main)]"
              />
              Thinking...
            </span>
          )}
          {hasFunctionCalls && (
            <FunctionCallsToggle
              functionCalls={message.functionCalls!}
              toolResults={message.toolResults}
              isStreaming={message.isStreaming}
            />
          )}
        </div>
        <div className="flex w-full flex-col pl-8 md:pl-11">
          {hasError && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-[var(--neutral-30)] border-l-[3px] border-l-[var(--primary-main)] bg-[var(--neutral-10)] px-3 py-2 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                  <WarningCircle
                    size={14}
                    className="text-[var(--primary-main)]"
                    weight="fill"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-[var(--neutral-100)]">
                    Không thể tạo phản hồi
                  </span>
                  <span className="text-[11px] leading-[1.3] text-[var(--neutral-50)]">
                    Vui lòng thử lại
                  </span>
                </div>
              </div>

              <button
                onClick={handleRetry}
                disabled={isSubmitting}
                className="flex flex-shrink-0 items-center gap-1 rounded-[5px] bg-[var(--primary-main)] px-2.5 py-1 text-[12px] font-medium text-white transition-all hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowCounterClockwise
                  size={12}
                  weight="bold"
                  className={isSubmitting ? 'animate-spin' : ''}
                />
                {isSubmitting ? '...' : 'Thử lại'}
              </button>
            </motion.div>
          )}
          {hasContent && (
            <div className="w-full rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 md:px-4 py-3 text-[14px] leading-[1.5] text-[var(--neutral-70)] shadow-sm">
              <MessageContent
                content={message.content}
                isStreaming={message.isStreaming}
                sources={message.sources}
              />
            </div>
          )}
          {!message.isStreaming && hasSources && (
            <SourcesList sources={message.sources!} />
          )}
        </div>
        {!message.isStreaming && hasContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-3 flex items-center gap-4 px-1"
          >
            {/* Copy button -- always visible */}
            <button
              onClick={handleCopy}
              className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors"
              title={copied ? 'Đã sao chép!' : 'Sao chép'}
            >
              {copied ? (
                <Check size={20} className="text-green-500" />
              ) : (
                <Copy size={20} />
              )}
            </button>

            {/* Retry -- hover reveal */}
            <button
              onClick={handleRetry}
              disabled={isSubmitting}
              className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
              title="Tạo lại phản hồi"
            >
              <ArrowCounterClockwise size={20} />
            </button>

            {/* Thumbs up -- hover reveal */}
            <button
              onClick={() => handleFeedback('up')}
              className={`transition-colors ${
                feedback === 'up'
                  ? 'text-green-500 opacity-100'
                  : 'text-[var(--neutral-60)] hover:text-[var(--neutral-100)] opacity-0 group-hover:opacity-100'
              }`}
              title="Phản hồi tốt"
            >
              <ThumbsUp
                size={20}
                weight={feedback === 'up' ? 'fill' : 'regular'}
              />
            </button>

            {/* Thumbs down -- hover reveal */}
            <button
              onClick={() => handleFeedback('down')}
              className={`transition-colors ${
                feedback === 'down'
                  ? 'text-red-500 opacity-100'
                  : 'text-[var(--neutral-60)] hover:text-[var(--neutral-100)] opacity-0 group-hover:opacity-100'
              }`}
              title="Phản hồi chưa tốt"
            >
              <ThumbsDown
                size={20}
                weight={feedback === 'down' ? 'fill' : 'regular'}
              />
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  },
);

AssistantMessage.displayName = 'AssistantMessage';

export default AssistantMessage;
