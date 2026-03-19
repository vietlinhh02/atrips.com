/**
 * AI Controller
 * Handles HTTP requests for AI conversation, chat, and tool endpoints.
 * Supports the 5-layer pipeline architecture with clarification flow.
 */

import { sendSuccess } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import aiConversationRepository from '../../infrastructure/repositories/AIConversationRepository.js';
import aiService from '../../infrastructure/services/AIService.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import aiDraftRepository from '../../../trip/infrastructure/repositories/AIItineraryDraftRepository.js';
import travelProfileRepository from '../../../profile/infrastructure/repositories/TravelProfileRepository.js';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

async function getUserContextForAI(userId) {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        UserPreference: {
          select: {
            language: true,
            currency: true,
            timezone: true,
            travelStyle: true,
            budgetRange: true,
            dietaryRestrictions: true,
            accessibilityNeeds: true,
          },
        },
      },
    });

    const travelProfile = await travelProfileRepository.findByUserId(userId);

    if (!user && !travelProfile) return null;

    return {
      name: user?.displayName || user?.name,
      location: travelProfile?.location || null,
      preferences: user?.UserPreference || null,
      travelProfile: travelProfile ? {
        travelerTypes: travelProfile.travelerTypes,
        spendingHabits: travelProfile.spendingHabits,
        dailyRhythm: travelProfile.dailyRhythm,
        travelCompanions: travelProfile.travelCompanions,
        socialPreference: travelProfile.socialPreference,
        personaAnswers: travelProfile.personaAnswers || null,
        onboardingCompleted: !!travelProfile.completedAt,
      } : null,
    };
  } catch (error) {
    logger.error('Failed to fetch user context:', { error: error.message });
    return null;
  }
}

// ─── Conversation CRUD ───

export const getConversations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const result = await aiConversationRepository.getConversations(req.user.id, limit, offset);
  return sendSuccess(res, result);
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await aiConversationRepository.getConversationById(req.params.id, req.user.id);
  if (!conversation) throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  return sendSuccess(res, { conversation });
});

export const createConversation = asyncHandler(async (req, res) => {
  const { tripId, title } = req.body;
  const conversation = await aiConversationRepository.createConversation(
    req.user?.id || null,
    tripId || null,
    title || null,
  );
  return sendSuccess(res, { conversation }, 'Conversation created successfully', 201);
});

export const updateConversation = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (title === undefined || title === null) {
    throw new AppError('Title is required', 400, 'INVALID_REQUEST');
  }
  const conversation = await aiConversationRepository.getConversationById(req.params.id, req.user.id);
  if (!conversation) throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  const updated = await aiConversationRepository.updateTitle(req.params.id, title);
  return sendSuccess(res, { conversation: updated });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  await aiConversationRepository.deleteConversation(req.params.id, req.user.id);
  return sendSuccess(res, null, 'Conversation deleted successfully');
});

// ─── Chat (non-streaming) ───

export const chat = asyncHandler(async (req, res) => {
  const {
    message, conversationId, tripId, context = {},
    enableTools = true, clientMessageId,
  } = req.body;
  const userId = req.user?.id || null;

  logger.info('[Chat] Request:', {
    userId: userId || 'Guest',
    messagePreview: message?.substring(0, 60),
  });

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message is required', 400, 'INVALID_REQUEST');
  }

  // Get or create conversation
  let conversation;
  let messages = [];
  let activeConversationId = conversationId;

  if (conversationId) {
    conversation = await aiConversationRepository.getConversationById(conversationId, userId);
    if (!conversation && userId) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }
    if (conversation?.ai_messages) {
      messages = buildMessageHistory(conversation.ai_messages);
    }
  } else if (userId) {
    conversation = await aiConversationRepository.createConversation(
      userId, tripId || null, generateTitleFromMessage(message),
    );
    activeConversationId = conversation.id;
  }

  messages.push({ role: 'user', content: message.trim() });

  const userProfile = userId ? await getUserContextForAI(userId) : null;
  const enrichedContext = {
    ...context,
    userProfile,
    tripInfo: conversation?.trips || null,
  };

  const aiResponse = await aiService.chat(messages, {
    context: enrichedContext,
    enableTools,
    userId,
    conversationId: activeConversationId,
  });

  if ((!aiResponse.content || aiResponse.content.trim().length === 0) && Array.isArray(aiResponse.toolCalls)) {
    aiResponse.content = buildFallbackContentFromToolCalls(aiResponse.toolCalls);
  }

  const { clean: cleanContent, suggestions } = extractSuggestions(aiResponse.content);
  aiResponse.content = cleanContent;

  const structuredData = extractItineraryFromContent(aiResponse.content);
  const sources = extractSourcesFromToolCalls(aiResponse.toolCalls);

  // Save messages
  let assistantMessageId = null;
  if (activeConversationId) {
    await aiConversationRepository.addMessage(activeConversationId, 'user', message.trim(), {
      tokensUsed: aiResponse.usage?.prompt_tokens || Math.ceil(message.trim().length / 4),
      clientMessageId: clientMessageId || null,
    });
    const assistantMsg = await aiConversationRepository.addMessage(
      activeConversationId, 'assistant', aiResponse.content, {
        tokensUsed: aiResponse.usage?.completion_tokens || Math.ceil(aiResponse.content.length / 4),
        structuredData: aiResponse.toolCalls ? { toolCalls: aiResponse.toolCalls } : null,
        sources: sources.length > 0 ? sources : null,
      },
    );
    assistantMessageId = assistantMsg.id;
  }

  // Create draft if itinerary data found
  let draftId = aiResponse.draftId || null;
  if (userId && structuredData && !draftId) {
    try {
      const draft = await aiDraftRepository.createDraft(
        activeConversationId || null, message.trim(), structuredData,
      );
      draftId = draft.id;
    } catch (error) {
      logger.error('Failed to create draft:', { error: error.message });
    }
  }

  return sendSuccess(res, {
    message: aiResponse.content,
    conversationId: activeConversationId,
    messageId: assistantMessageId,
    usage: aiResponse.usage,
    model: aiResponse.model,
    toolCalls: aiResponse.toolCalls,
    draftId,
    hasItinerary: !!structuredData,
    suggestions,
    clarification: aiResponse.clarification || undefined,
  });
});

// ─── Chat (streaming) ───

export const chatStream = asyncHandler(async (req, res) => {
  const {
    message, conversationId, tripId,
    context: contextParam, enableTools, clientMessageId,
  } = req.query;
  const userId = req.user?.id || null;
  const context = contextParam ? JSON.parse(contextParam) : {};

  logger.info('[ChatStream] Request:', {
    userId: userId || 'Guest',
    messagePreview: message?.substring(0, 60),
  });

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message is required', 400, 'INVALID_REQUEST');
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let conversation;
    let messages = [];
    let fullContent = '';
    let toolCalls = [];
    let draftId = null;
    let activeConversationId = conversationId;
    let sources = [];
    let usage = null;

    if (conversationId) {
      conversation = await aiConversationRepository.getConversationById(conversationId, userId);
      if (conversation?.ai_messages) {
        messages = buildMessageHistory(conversation.ai_messages);
      }
    } else if (userId) {
      conversation = await aiConversationRepository.createConversation(
        userId, tripId || null, generateTitleFromMessage(message),
      );
      activeConversationId = conversation.id;
    }

    messages.push({ role: 'user', content: message.trim() });

    const userProfile = userId ? await getUserContextForAI(userId) : null;
    const enrichedContext = { ...context, userProfile, tripInfo: conversation?.trips || null };

    const stream = aiService.chatStream(messages, {
      context: enrichedContext,
      enableTools: enableTools !== 'false',
      userId,
      conversationId: activeConversationId,
    });

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content':
          fullContent += chunk.content;
          sendEvent({ type: 'content', content: chunk.content });
          break;
        case 'clarification':
          sendEvent({
            type: 'clarification',
            question: chunk.question,
            missing: chunk.missing,
            gathered: chunk.gathered,
          });
          break;
        case 'planning_started':
          sendEvent({ type: 'planning_started', tasks: chunk.tasks });
          break;
        case 'worker_started':
          sendEvent({ type: 'worker_started', taskId: chunk.taskId, taskType: chunk.taskType });
          break;
        case 'worker_completed':
          sendEvent({ type: 'worker_completed', taskId: chunk.taskId, preview: chunk.preview });
          break;
        case 'worker_failed':
          sendEvent({ type: 'worker_failed', taskId: chunk.taskId, error: chunk.error });
          break;
        case 'synthesizing':
          sendEvent({ type: 'synthesizing' });
          break;
        case 'tool_call_start':
          sendEvent({ type: 'tool_call_start', name: chunk.name });
          break;
        case 'tool_result':
          toolCalls.push({ name: chunk.name, result: chunk.result });
          sendEvent({ type: 'tool_result', name: chunk.name, result: chunk.result });

          if (chunk.name === 'web_search') {
            const searchResults = extractWebSearchResults(chunk.result);
            for (const r of searchResults) {
              if (r?.url && r?.title) sources.push({ url: r.url, title: r.title });
            }
          }

          if (chunk.name === 'create_trip_plan') {
            if (chunk.result?.success && chunk.result?.data?.draftId) {
              draftId = chunk.result.data.draftId;
              sendEvent({
                type: 'draft_created',
                draftId: chunk.result.data.draftId,
                message: 'Draft created! You can apply it to a trip.',
              });
            }
          }
          break;
        case 'draft_created':
          draftId = chunk.draftId;
          sendEvent(chunk);
          break;
        case 'tool_error':
          sendEvent({ type: 'tool_error', name: chunk.name, error: chunk.error });
          break;
        case 'usage':
          usage = chunk.usage;
          break;
        case 'finish':
          sendEvent({ type: 'finish', reason: chunk.reason });
          break;
      }
    }

    const { clean: cleanContent, suggestions } = extractSuggestions(fullContent);
    fullContent = cleanContent;

    if ((!fullContent || fullContent.trim().length === 0) && toolCalls.length > 0) {
      fullContent = buildFallbackContentFromToolCalls(toolCalls);
      if (fullContent) sendEvent({ type: 'content', content: fullContent });
    }

    let structuredData = extractItineraryFromContent(fullContent);

    // Save messages
    if (activeConversationId) {
      await aiConversationRepository.addMessage(activeConversationId, 'user', message.trim(), {
        tokensUsed: usage?.prompt_tokens || Math.ceil(message.trim().length / 4),
        clientMessageId: clientMessageId || null,
      });
      await aiConversationRepository.addMessage(activeConversationId, 'assistant', fullContent, {
        tokensUsed: usage?.completion_tokens || Math.ceil(fullContent.length / 4),
        structuredData: toolCalls.length > 0 ? { toolCalls } : null,
        sources: sources.length > 0 ? sources : null,
      });
    }

    // Create draft if needed
    if (userId && structuredData && !draftId) {
      try {
        const draft = await aiDraftRepository.createDraft(
          activeConversationId || null, message.trim(), structuredData,
        );
        draftId = draft.id;
        sendEvent({ type: 'draft_created', draftId: draft.id, message: 'Draft created!' });
      } catch (error) {
        logger.error('Failed to create draft:', { error: error.message });
      }
    }

    if (suggestions.length > 0) {
      sendEvent({ type: 'suggestions', suggestions });
    }

    sendEvent({
      type: 'done',
      conversationId: activeConversationId,
      fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      draftId,
      hasItinerary: !!structuredData,
      suggestions,
      usage: usage || undefined,
    });

    res.end();
  } catch (error) {
    logger.error('[chatStream] Error:', { error: error.message });
    sendEvent({ type: 'error', error: error.message });
    res.end();
  }
});

// ─── Other endpoints ───

export const getTools = asyncHandler(async (req, res) => {
  const tools = aiService.getAvailableTools({ taskType: req.query.taskType });
  return sendSuccess(res, {
    tools: tools.map(t => t.function ? {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    } : { name: t.type, description: 'Native Google Search grounding', parameters: {} }),
  });
});

export const executeTool = asyncHandler(async (req, res) => {
  const result = await aiService.executeTool(req.params.name, req.body);
  if (!result.success) throw new AppError(result.error, 400, 'TOOL_EXECUTION_ERROR');
  return sendSuccess(res, result.data);
});

export const getRecommendations = asyncHandler(async (req, res) => {
  const { location, type, budget, interests } = req.body;
  if (!location) throw new AppError('Location is required', 400, 'INVALID_REQUEST');
  const result = await aiService.getRecommendations({ location, type, budget, interests });
  return sendSuccess(res, { content: result.content, toolCalls: result.toolCalls, usage: result.usage });
});

export const estimateBudget = asyncHandler(async (req, res) => {
  const { destination, duration, travelers, style } = req.body;
  if (!destination || !duration) throw new AppError('Destination and duration are required', 400, 'INVALID_REQUEST');
  const result = await aiService.estimateBudget({ destination, duration, travelers, style });
  return sendSuccess(res, { content: result.content, toolCalls: result.toolCalls, usage: result.usage });
});

export const getProviderStatus = asyncHandler(async (req, res) => {
  const status = await aiService.getStatus();
  return sendSuccess(res, status);
});

export const testTools = asyncHandler(async (req, res) => {
  const testMessage = req.body.message || 'Tìm kiếm nhà hàng ngon ở Đà Lạt';
  const result = await aiService.chat(
    [{ role: 'user', content: testMessage }],
    { enableTools: true, skipCache: true, temperature: 0.5 },
  );
  return sendSuccess(res, {
    message: result.content,
    toolCalls: result.toolCalls || [],
    hasToolCalls: !!result.toolCalls?.length,
    model: result.model,
    usage: result.usage,
  });
});

export const getQuota = asyncHandler(async (req, res) => {
  const subscription = req.user?.subscription || {
    tier: 'FREE', aiQuotaUsed: 0, aiQuotaLimit: 10,
  };
  return sendSuccess(res, {
    quota: {
      tier: subscription.tier,
      monthlyLimit: subscription.aiQuotaLimit,
      used: subscription.aiQuotaUsed,
      remaining: Math.max(0, subscription.aiQuotaLimit - subscription.aiQuotaUsed),
      resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    },
    usage: { thisMonth: subscription.aiQuotaUsed },
  });
});

export const clearCache = asyncHandler(async (req, res) => {
  await aiService.clearCache();
  return sendSuccess(res, null, 'AI cache cleared successfully');
});

export const listDrafts = asyncHandler(async (req, res) => {
  const { conversationId } = req.query;
  const drafts = conversationId
    ? await aiDraftRepository.getDraftsByConversation(conversationId)
    : await aiDraftRepository.getUnappliedDrafts(req.user.id);
  return sendSuccess(res, { drafts });
});

export const getDraft = asyncHandler(async (req, res) => {
  const draft = await aiDraftRepository.getDraftById(req.params.id);
  if (!draft) throw new AppError('Draft not found', 404, 'NOT_FOUND');
  if (draft.ai_conversations && draft.ai_conversations.userId !== req.user.id) {
    throw new AppError('You do not have access to this draft', 403, 'FORBIDDEN');
  }
  return sendSuccess(res, { draft });
});

export const getLogs = asyncHandler(async (req, res) => {
  const { type = 'ai-flow', lines = 100 } = req.query;
  const logFiles = logger.getLogFiles();

  if (type === 'list') return sendSuccess(res, { files: logFiles });

  const prefix = type === 'ai-flow' ? 'ai-flow-' : 'app-';
  const targetFile = logFiles.find(f => f.name.startsWith(prefix));
  if (!targetFile) return sendSuccess(res, { content: 'No logs found', file: null });

  const content = logger.readLogFile(targetFile.name, parseInt(lines, 10));
  return sendSuccess(res, { file: targetFile.name, date: targetFile.date, content });
});

// ─── Helper functions ───

function buildMessageHistory(aiMessages) {
  return aiMessages.map(m => {
    if (m.role === 'assistant' && m.structuredData?.toolCalls?.length > 0) {
      const toolSummary = m.structuredData.toolCalls
        .map(tc => `[Previous tool: ${tc.name}] ${JSON.stringify(tc.result?.data || tc.result).substring(0, 2000)}`)
        .join('\n');
      return {
        role: m.role,
        content: m.content + '\n\n<previous_tool_results>\n' + toolSummary + '\n</previous_tool_results>',
      };
    }
    return { role: m.role, content: m.content };
  });
}

function getToolResultPayload(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.data && typeof result.data === 'object') return result.data;
  return result;
}

function extractWebSearchResults(result) {
  const payload = getToolResultPayload(result);
  if (!payload || payload.success === false) return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data?.results)) return payload.data.results;
  return [];
}

function extractSourcesFromToolCalls(toolCalls) {
  const sources = [];
  if (!Array.isArray(toolCalls)) return sources;
  for (const tc of toolCalls) {
    if (tc.name === 'web_search') {
      for (const r of extractWebSearchResults(tc.result)) {
        if (r?.url && r?.title) sources.push({ url: r.url, title: r.title });
      }
    }
  }
  return sources;
}

function buildFallbackContentFromToolCalls(toolCalls = []) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return '';

  const lastCreate = [...toolCalls].reverse().find(tc => tc.name === 'create_trip_plan');
  const payload = getToolResultPayload(lastCreate?.result);

  if (payload?.success && (payload.tripId || payload.draftId)) {
    const title = payload.trip?.title || payload.title || 'lịch trình';
    const dest = payload.trip?.destination || payload.destination;
    if (payload.tripId) {
      return `Mình đã tạo xong chuyến đi "${title}"${dest ? ` tại ${dest}` : ''}. Bạn có thể mở trip để xem chi tiết.`;
    }
    if (payload.draftId) {
      return `Mình đã tạo xong draft lịch trình "${title}"${dest ? ` cho ${dest}` : ''}. Bạn có thể áp dụng thành trip.`;
    }
  }

  const lastOptimize = [...toolCalls].reverse().find(tc => tc.name === 'optimize_itinerary');
  const optPayload = getToolResultPayload(lastOptimize?.result);
  if (optPayload?.success && Array.isArray(optPayload.days) && optPayload.days.length > 0) {
    return `Mình đã tối ưu xong lịch trình ${optPayload.days.length} ngày. Bạn muốn mình trình bày chi tiết không?`;
  }

  return 'Mình đã xử lý xong yêu cầu. Bạn muốn mình tóm tắt kết quả không?';
}

function extractSuggestions(content) {
  if (!content || typeof content !== 'string') return { clean: content, suggestions: [] };
  const match = content.match(/<suggestions>\s*(\[[\s\S]*?\])\s*<\/suggestions>/);
  if (!match) return { clean: content, suggestions: [] };
  try {
    const suggestions = JSON.parse(match[1]);
    const clean = content.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trimEnd();
    return { clean, suggestions: Array.isArray(suggestions) ? suggestions : [] };
  } catch {
    return { clean: content, suggestions: [] };
  }
}

function extractItineraryFromContent(content) {
  if (!content || typeof content !== 'string') return null;
  try {
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.days && Array.isArray(parsed.days) && parsed.days.length > 0) return parsed;
    }
    const objMatch = content.match(/\{[\s\S]*"days"[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed.days && Array.isArray(parsed.days) && parsed.days.length > 0) return parsed;
    }
  } catch {
    // Not an itinerary
  }
  return null;
}

function generateTitleFromMessage(message) {
  const truncated = message.trim().slice(0, 50);
  return truncated.length < message.trim().length ? `${truncated}...` : truncated;
}

export default {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  chat,
  chatStream,
  getTools,
  executeTool,
  getRecommendations,
  estimateBudget,
  getProviderStatus,
  getQuota,
  clearCache,
  testTools,
  listDrafts,
  getDraft,
  getLogs,
};
