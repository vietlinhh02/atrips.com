/**
 * AI Itinerary Draft Repository
 * Handles database operations for AI-generated itinerary drafts
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

const CACHE_TTL = {
  DRAFT_DETAIL: 1800,    // 30 minutes
  DRAFT_LIST: 900,       // 15 minutes
};

const CACHE_KEYS = {
  DRAFT_DETAIL: (id) => `draft:detail:${id}`,
  DRAFT_LIST: (conversationId) => `draft:list:conv:${conversationId}`,
  DRAFT_USER: (userId) => `draft:user:${userId}`,
};

export class AIItineraryDraftRepository {
  async createDraft(conversationId, sourcePrompt, generatedData) {
    // Build data object - only include conversationId if it's not null
    const data = {
      sourcePrompt: sourcePrompt,
      generatedData: generatedData,
    };

    // Only add conversationId if it exists (not null/undefined)
    if (conversationId) {
      data.conversationId = conversationId;
    }

    const draft = await prisma.ai_itinerary_drafts.create({
      data,
    });

    if (conversationId) {
      // Invalidate both draft list cache AND conversation detail cache
      // so that fetching conversation will return the new draft
      await Promise.all([
        cacheService.del(CACHE_KEYS.DRAFT_LIST(conversationId)),
        cacheService.del(`ai:conversation:detail:${conversationId}`),
      ]);
    }

    return draft;
  }

  async getDraftById(draftId) {
    const cacheKey = CACHE_KEYS.DRAFT_DETAIL(draftId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const draft = await prisma.ai_itinerary_drafts.findUnique({
      where: { id: draftId },
      include: {
        ai_conversations: {
          select: {
            id: true,
            userId: true,
            title: true,
          },
        },
      },
    });

    if (draft) {
      await cacheService.set(cacheKey, draft, CACHE_TTL.DRAFT_DETAIL);
    }

    return draft;
  }

  async getDraftsByConversation(conversationId) {
    const cacheKey = CACHE_KEYS.DRAFT_LIST(conversationId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const drafts = await prisma.ai_itinerary_drafts.findMany({
      where: { conversationId: conversationId },
      orderBy: { createdAt: 'desc' },
    });

    await cacheService.set(cacheKey, drafts, CACHE_TTL.DRAFT_LIST);
    return drafts;
  }

  async markDraftAsApplied(draftId, tripId) {
    const draft = await prisma.ai_itinerary_drafts.update({
      where: { id: draftId },
      data: {
        appliedAt: new Date(),
        appliedToTripId: tripId,
      },
    });

    await cacheService.del(CACHE_KEYS.DRAFT_DETAIL(draftId));
    if (draft.conversationId) {
      await Promise.all([
        cacheService.del(CACHE_KEYS.DRAFT_LIST(draft.conversationId)),
        cacheService.del(`ai:conversation:detail:${draft.conversationId}`),
      ]);
    }

    return draft;
  }

  async getUnappliedDrafts(userId) {
    const drafts = await prisma.ai_itinerary_drafts.findMany({
      where: {
        appliedAt: null,
        ai_conversations: {
          userId: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        ai_conversations: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return drafts;
  }

  async deleteDraft(draftId) {
    const draft = await prisma.ai_itinerary_drafts.delete({
      where: { id: draftId },
    });

    await cacheService.del(CACHE_KEYS.DRAFT_DETAIL(draftId));
    if (draft.conversationId) {
      await Promise.all([
        cacheService.del(CACHE_KEYS.DRAFT_LIST(draft.conversationId)),
        cacheService.del(`ai:conversation:detail:${draft.conversationId}`),
      ]);
    }

    return draft;
  }
}

export default new AIItineraryDraftRepository();
