'use client';

import { useEffect } from 'react';

import TripPlannerCard from '@/src/components/common/cards/TripPlannerCard';
import { toast } from '@/src/components/ui/use-toast';
import { useSuggestions } from '@/src/hooks/useSuggestions';
import useChatStore from '@/src/stores/chatStore';

export default function ChatEmptyState() {
  const inputValue = useChatStore((state) => state.inputValue);
  const error = useChatStore((state) => state.error);
  const isSubmitting = useChatStore((state) => state.isSubmitting);
  const setInputValue = useChatStore((state) => state.setInputValue);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setError = useChatStore((state) => state.setError);

  const { suggestions } = useSuggestions();

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError(null);
    }
  }, [error, setError]);

  return (
    <div className="w-full h-full flex flex-col md:items-center md:justify-center pt-2 md:pt-0 overflow-y-auto scrollbar-hide">
      <TripPlannerCard
        className="w-full h-full rounded-none border-none shadow-none p-4 md:h-auto md:rounded-[12px] md:border md:border-[var(--neutral-30)] md:shadow-[6px_6px_32px_rgba(0,0,0,0.06)] md:p-8"
        value={inputValue}
        onValueChange={setInputValue}
        onSubmit={sendMessage}
        onSuggestionSelect={sendMessage}
        richSuggestions={suggestions}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
