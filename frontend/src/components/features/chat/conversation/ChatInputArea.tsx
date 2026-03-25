'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour,
  X,
  Microphone,
  Paperclip,
  PaperPlaneRight,
  WarningCircle,
  MapTrifold,
  ChatCircleDots,
  Sparkle,
  PlusCircle,
} from '@phosphor-icons/react';

import useChatStore from '@/src/stores/chatStore';
import FileAttachmentPreview from '@/src/components/features/chat/conversation/FileAttachmentPreview';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';

interface ChatInputAreaProps {
  inputValue: string;
  isSubmitting: boolean;
  suggestions?: string[];
  onValueChange: (value: string) => void;
  onSend: () => void;
  onNewChat: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSuggestionClick?: (suggestion: string) => void;
  // Mobile actions
  activeMobileTab?: 'chat' | 'map';
  onMobileTabChange?: (tab: 'chat' | 'map') => void;
  showTripPlan?: boolean;
  onTripPlanOpen?: () => void;
}

export default function ChatInputArea({
  inputValue,
  isSubmitting,
  suggestions,
  onValueChange,
  onSend,
  onNewChat,
  onKeyDown,
  onSuggestionClick,
  activeMobileTab,
  onMobileTabChange,
  showTripPlan = false,
  onTripPlanOpen,
}: ChatInputAreaProps) {
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  const handleOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        addAttachment(file);
      }
      // Reset so the same file can be selected again
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
          if (file) {
            addAttachment(file);
          }
        }
      }
    },
    [addAttachment]
  );

  const hasAttachments = pendingAttachments.length > 0;
  const canSend = inputValue.trim() || hasAttachments;

  return (
    <div className="bg-gradient-to-t from-[var(--neutral-10)] via-[var(--neutral-10)] to-transparent p-3 py-7 md:p-6 pt-2">
      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && !isSubmitting && (
        <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className="shrink-0 rounded-full border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-[13px] text-[var(--neutral-70)] shadow-sm transition-all hover:border-[var(--primary-main)] hover:bg-[var(--primary-surface)] hover:text-[var(--primary-main)] active:scale-[0.97]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {/* File attachment preview chips */}
      {hasAttachments && (
        <div className="mb-2">
          <FileAttachmentPreview
            attachments={pendingAttachments}
            onRemove={removeAttachment}
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-2 rounded-[6px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 py-2">
        <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--neutral-10)] text-[var(--neutral-100)] shadow-sm hover:bg-[var(--neutral-20)]">
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X size={16} weight="bold" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <SquaresFour size={16} weight="fill" />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Pulse indicator when trip plan is available (mobile) */}
              {showTripPlan && !menuOpen && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 md:hidden"
                >
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary-main)] opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-[var(--primary-main)]" />
                  </span>
                </motion.span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={12}
            className="min-w-[180px] rounded-[10px] border-[var(--neutral-30)] bg-[var(--neutral-10)] p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
          >
            {/* Mobile-only: Map/Chat toggle */}
            {onMobileTabChange && (
              <DropdownMenuItem
                onClick={() => onMobileTabChange(activeMobileTab === 'chat' ? 'map' : 'chat')}
                className="md:hidden flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-medium text-[var(--neutral-80)] cursor-pointer hover:bg-[var(--neutral-20)] focus:bg-[var(--neutral-20)]"
              >
                {activeMobileTab === 'chat' ? (
                  <>
                    <MapTrifold size={16} weight="fill" className="text-[var(--neutral-60)]" />
                    View Map
                  </>
                ) : (
                  <>
                    <ChatCircleDots size={16} weight="fill" className="text-[var(--neutral-60)]" />
                    Back to Chat
                  </>
                )}
              </DropdownMenuItem>
            )}
            {/* Mobile-only: Trip Plan */}
            {showTripPlan && onTripPlanOpen && (
              <DropdownMenuItem
                onClick={onTripPlanOpen}
                className="md:hidden flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-medium text-[var(--neutral-80)] cursor-pointer hover:bg-[var(--neutral-20)] focus:bg-[var(--neutral-20)]"
              >
                <Sparkle size={16} weight="fill" className="text-[var(--primary-main)]" />
                Trip Plan
              </DropdownMenuItem>
            )}
            {/* Separator between mobile actions and new chat */}
            {onMobileTabChange && (
              <DropdownMenuSeparator className="md:hidden my-1 bg-[var(--neutral-30)]" />
            )}
            {/* New Chat */}
            <DropdownMenuItem
              onClick={() => setShowNewChatDialog(true)}
              className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13px] font-medium text-[var(--neutral-80)] cursor-pointer hover:bg-[var(--neutral-20)] focus:bg-[var(--neutral-20)]"
            >
              <PlusCircle size={16} weight="fill" className="text-[var(--neutral-60)]" />
              New Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* New Chat confirmation dialog */}
        <AlertDialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start a new conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will start a fresh chat session. Your current conversation is automatically saved and can be accessed from the history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onNewChat}
                className="bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] text-white"
              >
                Start New Chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <textarea
          data-chat-input
          value={inputValue}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder="Ask anything destinations, tips, or trip plans"
          className="flex-1 resize-none bg-transparent py-1.5 text-[14px] text-[var(--neutral-100)] placeholder:text-[var(--neutral-50)] focus:outline-none"
          rows={1}
          style={{ minHeight: '24px', maxHeight: '100px' }}
          disabled={isSubmitting}
        />
        <div className="flex items-center gap-2 pl-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)]"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <button className="text-[var(--neutral-60)] hover:text-[var(--neutral-100)]">
            <Microphone size={20} />
          </button>
          {canSend && (
            <button
              onClick={onSend}
              disabled={isSubmitting}
              className="text-[var(--neutral-100)] hover:text-[var(--primary-main)]"
            >
              <PaperPlaneRight size={20} weight="fill" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 mb-2 flex items-center justify-center gap-1.5 text-[12px] text-[var(--neutral-50)]">
        <WarningCircle size={14} />
        <span>
          <span className="font-logo">Atripsme</span> can make mistake. Check important info.
        </span>
      </div>
    </div>
  );
}
