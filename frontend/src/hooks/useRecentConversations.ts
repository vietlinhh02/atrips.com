import { useMemo } from 'react';
import aiConversationService, {
  type ConversationItem,
  type ConversationsListResponse,
} from '@/src/services/aiConversationService';
import { useCacheQuery } from './useCacheQuery';

interface UseRecentConversationsOptions {
  limit?: number;
  offset?: number;
  tripId?: string;
  enabled?: boolean;
  refreshInterval?: number;
}

interface UseRecentConversationsReturn {
  conversations: ConversationItem[];
  pagination: ConversationsListResponse['pagination'] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch recent AI conversations with caching support
 *
 * @example
 * const { conversations, isLoading, refetch } = useRecentConversations({ limit: 10 });
 */
export function useRecentConversations(
  options: UseRecentConversationsOptions = {}
): UseRecentConversationsReturn {
  const {
    limit = 20,
    offset = 0,
    tripId,
    enabled = true,
    refreshInterval,
  } = options;

  // Create cache key based on parameters
  const cacheKey = useMemo(() => {
    const params = new URLSearchParams();
    params.append('offset', offset.toString());
    params.append('limit', limit.toString());
    if (tripId) params.append('tripId', tripId);
    return `ai-conversations:${params.toString()}`;
  }, [offset, limit, tripId]);

  const {
    data,
    isLoading,
    error,
    revalidate,
  } = useCacheQuery<ConversationsListResponse>(
    cacheKey,
    () => aiConversationService.listConversations({ offset, limit, tripId }),
    {
      enabled,
      ttl: 300, // Cache for 5 minutes (in seconds)
      revalidateOnFocus: true,
      refreshInterval,
      retryCount: 2,
    }
  );

  return {
    conversations: data?.data || [],
    pagination: data?.pagination || null,
    isLoading,
    error,
    refetch: revalidate,
  };
}

/**
 * Hook to fetch recent conversations for a specific trip
 */
export function useTripConversations(tripId: string, limit = 10) {
  return useRecentConversations({
    tripId,
    limit,
    enabled: !!tripId,
  });
}

/**
 * Hook to get the most recent conversation
 */
export function useLatestConversation() {
  const { conversations, isLoading, error } = useRecentConversations({
    limit: 1,
    offset: 0,
  });

  return {
    latestConversation: conversations[0] || null,
    isLoading,
    error,
  };
}
