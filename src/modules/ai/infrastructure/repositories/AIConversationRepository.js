/**
 * AI Conversation Repository
 * Database operations for AI conversations with caching
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  CONVERSATIONS_LIST: 900,    // 15 minutes
  CONVERSATION_DETAIL: 900,   // 15 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  CONVERSATIONS_LIST: (userId, limit, offset) => `ai:conversations:list:${userId}:${limit}:${offset}`,
  CONVERSATION_DETAIL: (id) => `ai:conversation:detail:${id}`,
};

class AIConversationRepository {
  /**
   * Get conversations for user (cached)
   */
  async getConversations(userId, limit = 50, offset = 0) {
    const cacheKey = CACHE_KEYS.CONVERSATIONS_LIST(userId, limit, offset);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [conversations, total] = await Promise.all([
      prisma.ai_conversations.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          trips: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          ai_messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
            },
          },
          ai_itinerary_drafts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              appliedAt: true,
              appliedToTripId: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.ai_conversations.count({
        where: { userId },
      }),
    ]);

    const result = {
      conversations: conversations.map(conv => {
        const latestDraft = conv.ai_itinerary_drafts[0] || null;
        return {
          id: conv.id,
          title: conv.title,
          tripId: conv.tripId,
          trip: conv.trips,
          totalTokensUsed: conv.totalTokensUsed,
          lastMessage: conv.ai_messages[0] || null,
          // Draft info for quick access
          latestDraft: latestDraft ? {
            id: latestDraft.id,
            isApplied: !!latestDraft.appliedAt,
            appliedToTripId: latestDraft.appliedToTripId,
            createdAt: latestDraft.createdAt,
          } : null,
          hasDraft: !!latestDraft,
          hasAppliedDraft: !!latestDraft?.appliedAt,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      }),
      total,
    };

    // Cache the result
    await cacheService.set(cacheKey, result, CACHE_TTL.CONVERSATIONS_LIST);

    return result;
  }

  /**
   * Get conversation by ID (cached)
   */
  async getConversationById(id, userId) {
    const cacheKey = CACHE_KEYS.CONVERSATION_DETAIL(id);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      // Verify ownership
      if (cached.userId === userId || userId === null) {
        return cached;
      }
      return null;
    }

    const result = await prisma.ai_conversations.findFirst({
      where: {
        id,
        ...(userId && { userId }),
      },
      include: {
        trips: {
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        ai_messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            file_uploads: {
              where: { status: { not: 'DELETED' } },
              select: {
                id: true,
                fileName: true,
                fileType: true,
                mimeType: true,
                publicUrl: true,
                variants: true,
              },
            },
          },
        },
        ai_itinerary_drafts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            sourcePrompt: true,
            appliedAt: true,
            appliedToTripId: true,
            createdAt: true,
          },
        },
        continuedFrom: {
          select: { summary: true },
        },
      },
    });

    if (result) {
      await cacheService.set(cacheKey, result, CACHE_TTL.CONVERSATION_DETAIL);
    }

    return result;
  }

  /**
   * Create conversation
   */
  async createConversation(userId, tripId = null, title = null, options = {}) {
    const { continueFromId = null } = options;

    const conversation = await prisma.ai_conversations.create({
      data: {
        userId,
        tripId,
        title,
        continuedFromId: continueFromId,
      },
    });

    if (userId) {
      await this.invalidateConversationsListCache(userId);
    }

    return conversation;
  }

  /**
   * Add message to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} role - Message role ('user' or 'assistant')
   * @param {string} content - Message content
   * @param {object} options - Additional options
   * @param {number} options.tokensUsed - Number of tokens used
   * @param {object} options.structuredData - Structured data (tool calls, etc.)
   * @param {string} options.clientMessageId - Client-side message ID for deduplication
   * @param {array} options.sources - Sources/citations from web search
   */
  async addMessage(conversationId, role, content, options = {}) {
    const {
      tokensUsed = 0,
      structuredData = null,
      clientMessageId = null,
      sources = null,
    } = typeof options === 'number' ? { tokensUsed: options } : options;

    const isUserMessage = role === 'user';

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.ai_messages.create({
        data: {
          conversationId,
          role,
          content,
          tokensUsed,
          structuredData,
          clientMessageId,
          sources,
        },
      });

      const updateData = {
        totalTokensUsed: { increment: tokensUsed },
        updatedAt: new Date(),
      };

      if (isUserMessage) {
        updateData.messageCount = { increment: 1 };
      }

      const conversation = await tx.ai_conversations.update({
        where: { id: conversationId },
        data: updateData,
        select: {
          userId: true,
          messageCount: true,
          totalTokensUsed: true,
        },
      });

      return { message, conversation };
    });

    // Invalidate caches
    await Promise.all([
      cacheService.del(CACHE_KEYS.CONVERSATION_DETAIL(conversationId)),
      result.conversation.userId && this.invalidateConversationsListCache(result.conversation.userId),
    ]);

    return result.message;
  }

  /**
   * Update conversation title
   */
  async updateTitle(id, title) {
    const conversation = await prisma.ai_conversations.update({
      where: { id },
      data: { title },
    });

    // Invalidate caches
    await cacheService.del(CACHE_KEYS.CONVERSATION_DETAIL(id));
    if (conversation.userId) {
      await this.invalidateConversationsListCache(conversation.userId);
    }

    return conversation;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(id, userId) {
    const result = await prisma.ai_conversations.deleteMany({
      where: {
        id,
        userId,
      },
    });

    // Invalidate caches
    await cacheService.del(CACHE_KEYS.CONVERSATION_DETAIL(id));
    await this.invalidateConversationsListCache(userId);

    return result;
  }

  /**
   * Invalidate conversations list cache for user
   */
  async invalidateConversationsListCache(userId) {
    // Invalidate common pagination patterns
    const paginationPatterns = [
      { limit: 50, offset: 0 },
      { limit: 20, offset: 0 },
      { limit: 10, offset: 0 },
    ];

    await Promise.all(
      paginationPatterns.map(({ limit, offset }) =>
        cacheService.del(CACHE_KEYS.CONVERSATIONS_LIST(userId, limit, offset))
      )
    );
  }

  /**
   * Get fresh conversation counters (messageCount, totalTokensUsed)
   */
  async getConversationCounters(conversationId) {
    return prisma.ai_conversations.findUnique({
      where: { id: conversationId },
      select: { messageCount: true, totalTokensUsed: true },
    });
  }

  /**
   * Get conversation count for user
   */
  async getConversationCount(userId) {
    return prisma.ai_conversations.count({
      where: { userId },
    });
  }
}

export default new AIConversationRepository();
