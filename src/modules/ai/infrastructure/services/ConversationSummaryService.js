import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getFastModel } from './provider.js';
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const SUMMARY_RATE_LIMIT_KEY = (userId) => `summary_rate:${userId}`;
const SUMMARY_RATE_LIMIT_MAX = 10;
const SUMMARY_RATE_LIMIT_WINDOW = 3600; // 1 hour

export async function generateConversationSummary(
  conversationId,
  userId,
) {
  const rateKey = SUMMARY_RATE_LIMIT_KEY(userId);
  const currentCount = await cacheService.get(rateKey) || 0;
  if (currentCount >= SUMMARY_RATE_LIMIT_MAX) {
    logger.warn('[Summary] Rate limit hit', {
      userId,
      count: currentCount,
    });
    return null;
  }

  try {
    const messages = await prisma.ai_messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 100,
    });

    if (messages.length === 0) return null;

    const transcript = messages
      .map((m) => {
        const text = m.content?.substring(0, 500) || '';
        return `${m.role}: ${text}`;
      })
      .join('\n');

    const model = getFastModel();
    const response = await model.invoke([
      new SystemMessage(
        'Summarize this conversation in under 200 words. '
        + 'Focus on: key decisions, destinations discussed, '
        + 'preferences expressed, and any plans made. '
        + 'Write in the same language as the conversation.',
      ),
      new HumanMessage(transcript),
    ]);

    const summary = response.content?.trim();
    if (!summary) return null;

    await prisma.ai_conversations.update({
      where: { id: conversationId },
      data: { summary },
    });

    await cacheService.set(
      rateKey,
      currentCount + 1,
      SUMMARY_RATE_LIMIT_WINDOW,
    );

    logger.info('[Summary] Generated', {
      conversationId,
      length: summary.length,
    });
    return summary;
  } catch (error) {
    logger.error('[Summary] Generation failed', {
      conversationId,
      error: error.message,
    });
    return null;
  }
}
