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

const DRAFT_BASE_SELECT = {
  id: true,
  conversationId: true,
  sourcePrompt: true,
  generatedData: true,
  appliedAt: true,
  appliedToTripId: true,
  createdAt: true,
};

const DRAFT_SELECT_WITH_COMPILE = {
  ...DRAFT_BASE_SELECT,
  compiledData: true,
  compileReport: true,
  compileStatus: true,
  compiledAt: true,
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

    let draft;
    try {
      draft = await prisma.ai_itinerary_drafts.findUnique({
        where: { id: draftId },
        select: {
          ...DRAFT_SELECT_WITH_COMPILE,
          ai_conversations: {
            select: {
              id: true,
              userId: true,
              title: true,
            },
          },
        },
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      draft = await prisma.ai_itinerary_drafts.findUnique({
        where: { id: draftId },
        select: {
          ...DRAFT_BASE_SELECT,
          ai_conversations: {
            select: {
              id: true,
              userId: true,
              title: true,
            },
          },
        },
      });
      draft = this.#withLegacyCompileDefaults(draft);
    }

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

    let drafts;
    try {
      drafts = await prisma.ai_itinerary_drafts.findMany({
        where: { conversationId: conversationId },
        orderBy: { createdAt: 'desc' },
        select: DRAFT_SELECT_WITH_COMPILE,
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      const legacyDrafts = await prisma.ai_itinerary_drafts.findMany({
        where: { conversationId: conversationId },
        orderBy: { createdAt: 'desc' },
        select: DRAFT_BASE_SELECT,
      });
      drafts = legacyDrafts.map((draft) => this.#withLegacyCompileDefaults(draft));
    }

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

  async markCompileProcessing(draftId) {
    let draft;
    try {
      draft = await prisma.ai_itinerary_drafts.update({
        where: { id: draftId },
        data: {
          compileStatus: 'PROCESSING',
        },
        select: { id: true, conversationId: true },
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      draft = await prisma.ai_itinerary_drafts.findUnique({
        where: { id: draftId },
        select: { id: true, conversationId: true },
      });
      if (!draft) throw error;
    }

    await this.#invalidateDraftCache(draft.id, draft.conversationId);
    return draft;
  }

  async markCompileCompleted(draftId, compiledData, compileReport = null) {
    let draft;
    try {
      draft = await prisma.ai_itinerary_drafts.update({
        where: { id: draftId },
        data: {
          compiledData,
          compileReport,
          compileStatus: 'COMPLETED',
          compiledAt: new Date(),
        },
        select: { id: true, conversationId: true },
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      draft = await prisma.ai_itinerary_drafts.findUnique({
        where: { id: draftId },
        select: { id: true, conversationId: true },
      });
      if (!draft) throw error;
    }

    await this.#invalidateDraftCache(draft.id, draft.conversationId);
    return draft;
  }

  async markCompileFailed(draftId, compileReport = null) {
    let draft;
    try {
      draft = await prisma.ai_itinerary_drafts.update({
        where: { id: draftId },
        data: {
          compileStatus: 'FAILED',
          compileReport,
        },
        select: { id: true, conversationId: true },
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      draft = await prisma.ai_itinerary_drafts.findUnique({
        where: { id: draftId },
        select: { id: true, conversationId: true },
      });
      if (!draft) throw error;
    }

    await this.#invalidateDraftCache(draft.id, draft.conversationId);
    return draft;
  }

  async getUnappliedDrafts(userId) {
    let drafts;
    try {
      drafts = await prisma.ai_itinerary_drafts.findMany({
        where: {
          appliedAt: null,
          ai_conversations: {
            is: {
              userId: userId,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          ...DRAFT_SELECT_WITH_COMPILE,
          ai_conversations: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    } catch (error) {
      if (!this.#isMissingCompileColumnsError(error)) {
        throw error;
      }

      const legacyDrafts = await prisma.ai_itinerary_drafts.findMany({
        where: {
          appliedAt: null,
          ai_conversations: {
            is: {
              userId: userId,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          ...DRAFT_BASE_SELECT,
          ai_conversations: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
      drafts = legacyDrafts.map((draft) => this.#withLegacyCompileDefaults(draft));
    }

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

  async #invalidateDraftCache(draftId, conversationId = null) {
    await cacheService.del(CACHE_KEYS.DRAFT_DETAIL(draftId));
    if (conversationId) {
      await Promise.all([
        cacheService.del(CACHE_KEYS.DRAFT_LIST(conversationId)),
        cacheService.del(`ai:conversation:detail:${conversationId}`),
      ]);
    }
  }

  #isMissingCompileColumnsError(error) {
    if (error?.code !== 'P2022') return false;
    const details = `${error?.message || ''} ${error?.meta?.column || ''}`;
    return /(compileStatus|compiledData|compileReport|compiledAt)/i.test(details);
  }

  #withLegacyCompileDefaults(draft) {
    if (!draft) return draft;
    return {
      compileStatus: 'PENDING',
      compiledAt: null,
      compiledData: null,
      compileReport: null,
      ...draft,
    };
  }
}

export default new AIItineraryDraftRepository();
