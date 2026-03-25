'use client';

import { useState, useRef, useCallback, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import {
  ArrowElbowDownRight,
  MapPinLine,
  Microphone,
  Paperclip,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react';

import useChatStore from '@/src/stores/chatStore';
import FileAttachmentPreview from '@/src/components/features/chat/conversation/FileAttachmentPreview';

import AtripsAiMark from '@/src/components/common/brand/AtripsAiMark';
import { cn } from '@/src/lib/utils';

export interface RichSuggestion {
  id: string;
  text: string;
  icon: Icon;
}

interface TripPlannerCardProps {
  className?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  suggestions?: string[];
  richSuggestions?: RichSuggestion[];
  brandName?: string;
  disclaimerText?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (message: string) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  isSubmitting?: boolean;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
} as const;

const chipVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
  },
};

function FloatingPrompt({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)]/90 px-3 py-2 shadow-[6px_6px_32px_rgba(0,0,0,0.06)] backdrop-blur',
        className
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-[10px] border border-[var(--neutral-30)] bg-[var(--primary-surface)] text-[var(--primary-main)]">
        <MapPinLine size={18} weight="fill" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="h-[8px] w-[96px] rounded-[4px] bg-gradient-to-r from-[var(--neutral-30)] to-transparent" />
        <span className="h-[8px] w-[68px] rounded-[4px] bg-gradient-to-r from-[var(--neutral-30)] to-transparent" />
      </div>
    </div>
  );
}

export default function TripPlannerCard({
  className,
  title = 'Where do you want to go?',
  subtitle = 'Plan your Trips, get recomedation and explore personalized travel insights - all in one place',
  placeholder = 'Ask anything destinations, tips, or trip plans',
  suggestions = ['Adventure Nepal', 'Budget Tokyo stay', '2-day trip to Bali'],
  richSuggestions,
  brandName = 'Atripsme',
  disclaimerText = 'can make mistake. Check inportant info.',
  value,
  onValueChange,
  onSubmit,
  onSuggestionSelect,
  isSubmitting = false,
}: TripPlannerCardProps) {
  const [internalValue, setInternalValue] = useState('');
  const resolvedValue = value ?? internalValue;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        addAttachment(file);
      }
      e.target.value = '';
    },
    [addAttachment]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) addAttachment(file);
        }
      }
    },
    [addAttachment]
  );

  const hasAttachments = pendingAttachments.length > 0;
  const canSend = resolvedValue.trim() || hasAttachments;

  const applyValue = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const trimmed = resolvedValue.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    if (value === undefined) {
      setInternalValue('');
    }
  };

  const handleSuggestionClick = (text: string) => {
    if (isSubmitting) return;
    // Call onSubmit directly (same as form submit) — don't set input value first
    // to avoid race condition with controlled state re-renders
    onSubmit?.(text);
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-8 text-[var(--neutral-100)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      <div className="flex flex-col items-center gap-6 md:gap-10 text-center">
        <div className="relative h-[140px] md:h-[260px] w-full">
          <FloatingPrompt className="absolute left-4 top-4 md:top-10 scale-75 md:scale-100 origin-top-left" />
          <FloatingPrompt className="absolute right-4 md:right-8 top-[70px] md:top-[120px] scale-75 md:scale-100 origin-top-right" />
          <div className="absolute inset-0 flex items-center justify-center scale-[0.6] md:scale-100">
            <AtripsAiMark size={170} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 md:gap-3">
          <h2 className="text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)] md:text-[40px]">
            {title}
          </h2>
          <p className="max-w-[372px] text-[13px] md:text-[14px] leading-[1.5] text-[var(--neutral-60)]">
            {subtitle}
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* File attachment preview */}
          {hasAttachments && (
            <div className="w-full">
              <FileAttachmentPreview
                attachments={pendingAttachments}
                onRemove={removeAttachment}
              />
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex w-full items-end gap-3 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-4 py-3 text-[14px]"
          >
            <span className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--neutral-10)] text-[var(--neutral-100)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)] mb-0.5">
              <Plus size={16} weight="bold" aria-hidden="true" />
            </span>
            <textarea
              value={resolvedValue}
              onChange={(event) => {
                applyValue(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = `${event.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSubmitting && canSend) {
                    onSubmit?.(resolvedValue.trim());
                    if (value === undefined) setInternalValue('');
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                  }
                }
              }}
              onPaste={handlePaste}
              placeholder={placeholder}
              rows={1}
              className="flex-1 bg-transparent text-left text-[14px] text-[var(--neutral-100)] placeholder:text-[var(--neutral-50)] outline-none resize-none scrollbar-thin min-h-[24px] max-h-[120px] py-1"
              disabled={isSubmitting}
            />
            <span className="flex items-center gap-1 text-[var(--neutral-70)] mb-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center size-8 rounded-[6px] hover:bg-[var(--neutral-30)] transition-colors"
                aria-label="Attach file"
                disabled={isSubmitting}
              >
                <Paperclip size={18} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="flex items-center justify-center size-8 rounded-[6px] hover:bg-[var(--neutral-30)] transition-colors"
                aria-label="Voice input"
                disabled={isSubmitting}
              >
                <Microphone size={18} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="submit"
                className="flex items-center justify-center size-8 rounded-[6px] hover:bg-[var(--neutral-30)] transition-colors disabled:opacity-40"
                aria-label="Send message"
                disabled={isSubmitting || !canSend}
              >
                <ArrowElbowDownRight
                  size={18}
                  weight="bold"
                  aria-hidden="true"
                />
              </button>
            </span>
          </form>

          {richSuggestions && richSuggestions.length > 0 ? (
            <motion.div
              className="flex w-full flex-wrap items-center justify-center gap-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {richSuggestions.map((suggestion) => {
                const IconComponent = suggestion.icon;
                return (
                  <motion.button
                    key={suggestion.id}
                    type="button"
                    variants={chipVariants}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 rounded-full border border-[var(--neutral-40)] bg-[var(--neutral-10)] px-3.5 py-2 text-[13px] leading-[1.4] text-[var(--neutral-100)] transition-colors hover:border-[var(--primary-main)] hover:bg-[var(--primary-surface)] hover:text-[var(--primary-main)]"
                    onClick={() => handleSuggestionClick(suggestion.text)}
                  >
                    <IconComponent
                      size={16}
                      weight="duotone"
                      aria-hidden="true"
                      className="shrink-0 text-[var(--primary-main)]"
                    />
                    <span>{suggestion.text}</span>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <div className="flex w-full flex-wrap items-center justify-center gap-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="flex items-center justify-center rounded-[6px] border border-[var(--neutral-40)] px-4 py-2 text-[14px] leading-[1.5] text-[var(--neutral-100)] transition-colors hover:border-[var(--primary-main)] hover:text-[var(--primary-main)]"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] leading-[1.5] text-[var(--neutral-50)]">
          <WarningCircle size={16} weight="regular" aria-hidden="true" />
          <span>
            <span className="font-logo">{brandName}</span> {disclaimerText}
          </span>
        </div>
      </div>
    </section>
  );
}
