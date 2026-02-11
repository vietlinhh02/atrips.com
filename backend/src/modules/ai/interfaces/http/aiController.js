/**
 * AI Controller
 * Handles HTTP requests for AI conversation, chat, and tool endpoints
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

/**
 * Fetch user context for AI (profile, preferences, travel profile)
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User context for AI
 */
async function getUserContextForAI(userId) {
  if (!userId) return null;

  try {
    // Fetch user with preferences
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

    // Fetch travel profile
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
      } : null,
    };
  } catch (error) {
    console.error('Failed to fetch user context for AI:', error.message);
    return null;
  }
}

/**
 * @route GET /api/ai/conversations
 * @desc Get AI conversations for user
 * @access Private
 */
export const getConversations = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  const result = await aiConversationRepository.getConversations(req.user.id, limit, offset);

  return sendSuccess(res, result);
});

/**
 * @route GET /api/ai/conversations/:id
 * @desc Get single AI conversation with messages
 * @access Private
 */
export const getConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const conversation = await aiConversationRepository.getConversationById(id, req.user.id);

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }

  return sendSuccess(res, { conversation });
});

/**
 * @route POST /api/ai/conversations
 * @desc Create new AI conversation
 * @access Optional Auth (supports guest mode)
 */
export const createConversation = asyncHandler(async (req, res) => {
  const { tripId, title } = req.body;
  const userId = req.user?.id || null;

  const conversation = await aiConversationRepository.createConversation(
    userId,
    tripId || null,
    title || null
  );

  return sendSuccess(res, { conversation }, 'Conversation created successfully', 201);
});

/**
 * @route DELETE /api/ai/conversations/:id
 * @desc Delete AI conversation
 * @access Private
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await aiConversationRepository.deleteConversation(id, req.user.id);

  return sendSuccess(res, null, 'Conversation deleted successfully');
});

/**
 * @route POST /api/ai/chat
 * @desc Chat with AI (supports tool calling)
 * @access Optional Auth (supports guest mode)
 * 
 * FLOW: AI Trip Planning - Step 1-8
 */
export const chat = asyncHandler(async (req, res) => {
  const {
    message,
    conversationId,
    tripId,
    context = {},
    enableTools = true,
    taskType,
    clientMessageId,
  } = req.body;
  const userId = req.user?.id || null;

  logger.aiFlowStart('AI Chat Request', { userId: userId || 'Guest', messageLength: message.length });
  logger.info(`User message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`);
  logger.info(`User: ${userId || 'Guest'}`);

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message is required', 400, 'INVALID_REQUEST');
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: INTENT PARSING
  // ═══════════════════════════════════════════════════════════════
  logger.aiFlowStep('1', 'INTENT PARSING');
  logger.info('Extracting intent from natural language...');

  // Get or create conversation
  let conversation;
  let messages = [];
  let activeConversationId = conversationId;

  if (conversationId) {
    conversation = await aiConversationRepository.getConversationById(
      conversationId,
      userId
    );
    if (!conversation && userId) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Build messages history (include previous tool results for context reuse)
    if (conversation?.ai_messages) {
      messages = conversation.ai_messages.map(m => {
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
  } else if (userId) {
    // Create conversation BEFORE calling AI so tools have conversationId
    conversation = await aiConversationRepository.createConversation(
      userId,
      tripId || null,
      generateTitleFromMessage(message)
    );
    activeConversationId = conversation.id;
  }

  // Add user message to history
  messages.push({ role: 'user', content: message.trim() });

  // Fetch user context for personalized AI responses
  const userProfile = userId ? await getUserContextForAI(userId) : null;

  // Merge user profile into context
  const enrichedContext = {
    ...context,
    userProfile,
    tripInfo: conversation?.trips || null,
  };

  let aiResponse;
  let structuredData = null;

  // Regular chat with tool support (AI decides when to use optimize_itinerary)
  aiResponse = await aiService.chat(messages, {
    context: enrichedContext,
    enableTools,
    userId,
    conversationId: activeConversationId,
  });

  // Try to extract structured data from chat response
  structuredData = extractItineraryFromContent(aiResponse.content);

  // Extract sources from web_search tool calls if any
  let sources = [];
  if (aiResponse.toolCalls) {
    aiResponse.toolCalls.forEach(tc => {
      if (tc.name === 'web_search' && tc.result?.success && tc.result?.data?.results) {
        tc.result.data.results.forEach(r => {
          if (r.url && r.title) {
            sources.push({ url: r.url, title: r.title });
          }
        });
      }
    });
  }

  // Save messages to database (conversation was already created at the beginning if needed)
  let userMessageId = null;
  let assistantMessageId = null;

  if (activeConversationId) {
    const userMsg = await aiConversationRepository.addMessage(
      activeConversationId,
      'user',
      message.trim(),
      {
        tokensUsed: aiResponse.usage?.prompt_tokens || Math.ceil(message.trim().length / 4),
        clientMessageId: clientMessageId || null,
      }
    );
    userMessageId = userMsg.id;

    // Save assistant message with tool calls info
    const assistantMsg = await aiConversationRepository.addMessage(
      activeConversationId,
      'assistant',
      aiResponse.content,
      {
        tokensUsed: aiResponse.usage?.completion_tokens || Math.ceil(aiResponse.content.length / 4),
        structuredData: aiResponse.toolCalls ? { toolCalls: aiResponse.toolCalls } : null,
        sources: sources.length > 0 ? sources : null,
      }
    );
    assistantMessageId = assistantMsg.id;
  }

  // Log message IDs for debugging
  if (process.env.DEBUG_AI && userMessageId) {
    console.debug('Saved user message ID:', userMessageId, 'Assistant message ID:', assistantMessageId);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: DRAFT STORAGE
  // ═══════════════════════════════════════════════════════════════
  logger.aiFlowStep('5', 'DRAFT STORAGE');
  
  // Create draft if we have itinerary data
  let draftId = null;
  if (userId && structuredData) {
    logger.info('Saving draft to database...');
    try {
      const draft = await aiDraftRepository.createDraft(
        activeConversationId || null,
        message.trim(),
        structuredData
      );
      draftId = draft.id;
      logger.info(`Draft created with ID: ${draft.id}`);
    } catch (error) {
      logger.error('Failed to create draft:', { error: error.message });
    }
  } else if (!userId) {
    logger.warn('User not authenticated - draft not saved');
  } else if (!structuredData) {
    logger.warn('No structured itinerary data - draft not created');
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: USER REVIEW (Handled by Frontend)
  // ═══════════════════════════════════════════════════════════════
  logger.aiFlowStep('6', 'USER REVIEW & APPROVAL (Frontend)');
  logger.info('Draft ready for user review');
  logger.info(`Draft ID: ${draftId || 'N/A'}`);
  logger.info('Waiting for user to approve, modify, or reject...');

  logger.aiFlowEnd('RESPONSE SENT TO CLIENT');

  return sendSuccess(res, {
    message: aiResponse.content,
    conversationId: activeConversationId,
    messageId: assistantMessageId,
    usage: aiResponse.usage,
    model: aiResponse.model,
    toolCalls: aiResponse.toolCalls,
    draftId,
    hasItinerary: !!structuredData,
    algorithm: aiResponse.algorithm,
    placesUsed: aiResponse.placesUsed,
    weatherInfo: aiResponse.weatherInfo,
  });
});

/**
 * @route GET /api/ai/chat/stream
 * @desc Stream chat response with SSE (supports tool calling)
 * @access Optional Auth (supports guest mode)
 * 
 * FLOW: AI Trip Planning - Step 1-8 (Streaming version)
 */
export const chatStream = asyncHandler(async (req, res) => {
  const {
    message,
    conversationId,
    tripId,
    context: contextParam,
    enableTools,
    taskType,
    clientMessageId,
  } = req.query;
  const userId = req.user?.id || null;
  const context = contextParam ? JSON.parse(contextParam) : {};

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    AI TRIP PLANNING FLOW (STREAM) - STARTED                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`User message: "${message.substring(0, 60)}${message.length > 60 ? '...' : ''}"`);

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError('Message is required', 400, 'INVALID_REQUEST');
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Declare all variables at the top to avoid TDZ issues
    let conversation;
    let messages = [];
    let fullContent = '';
    let toolCalls = [];
    let structuredData = null;
    let draftId = null;
    let activeConversationId = conversationId;
    let sources = []; // Collect sources from web_search

    if (conversationId) {
      conversation = await aiConversationRepository.getConversationById(
        conversationId,
        userId
      );
      if (conversation?.ai_messages) {
        messages = conversation.ai_messages.map(m => {
          // For assistant messages with tool call results, append a summary
          // so the AI can reuse previous data without calling tools again
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
    } else if (userId) {
      // Create conversation BEFORE calling AI so tools have conversationId
      conversation = await aiConversationRepository.createConversation(
        userId,
        tripId || null,
        generateTitleFromMessage(message)
      );
      activeConversationId = conversation.id;
    }

    messages.push({ role: 'user', content: message.trim() });

    // Fetch user context for personalized AI responses
    const userProfile = userId ? await getUserContextForAI(userId) : null;

    // Merge user profile into context
    const enrichedContext = {
      ...context,
      userProfile,
      tripInfo: conversation?.trips || null,
    };

    // Regular chat with streaming (AI decides when to use optimize_itinerary)
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
        case 'tool_call':
          sendEvent({ type: 'tool_call', name: chunk.name, arguments: chunk.arguments });
          break;
        case 'tool_result':
          toolCalls.push({ name: chunk.name, result: chunk.result });
          sendEvent({ type: 'tool_result', name: chunk.name, result: chunk.result });

          // Extract sources from web_search results
          if (chunk.name === 'web_search' && chunk.result?.success && chunk.result?.data?.results) {
            const searchResults = chunk.result.data.results;
            searchResults.forEach(r => {
              if (r.url && r.title) {
                sources.push({ url: r.url, title: r.title });
              }
            });
          }

          // Special handling for create_trip_plan tool
          if (chunk.name === 'create_trip_plan') {
            console.log('[Tool] create_trip_plan result:', JSON.stringify(chunk.result, null, 2));
            if (chunk.result?.success && chunk.result?.data?.draftId) {
              draftId = chunk.result.data.draftId;
              structuredData = chunk.result.data; // Mark that we have structured data
              sendEvent({
                type: 'draft_created',
                draftId: chunk.result.data.draftId,
                message: chunk.result.data.message || 'Draft created! You can apply it to a trip.',
              });
            }
          }
          break;
        case 'finish':
          sendEvent({ type: 'finish', reason: chunk.reason });
          break;
      }
    }

    // Extract structured data from regular chat if it contains itinerary (and not already from tool)
    if (!structuredData) {
      structuredData = extractItineraryFromContent(fullContent);
    }

    // Save messages to database after streaming completes
    // (conversation was already created at the beginning if needed)
    if (activeConversationId) {
      // Estimate token usage (rough estimation: ~4 chars per token for mixed content)
      const userTokens = Math.ceil(message.trim().length / 4);
      const assistantTokens = Math.ceil(fullContent.length / 4);

      await aiConversationRepository.addMessage(activeConversationId, 'user', message.trim(), {
        tokensUsed: userTokens,
        clientMessageId: clientMessageId || null,
      });
      await aiConversationRepository.addMessage(activeConversationId, 'assistant', fullContent, {
        tokensUsed: assistantTokens,
        structuredData: toolCalls.length > 0 ? { toolCalls } : null,
        sources: sources.length > 0 ? sources : null,
      });
    }

    // Create draft if we have itinerary data (and not already created by create_trip_plan tool)
    if (userId && structuredData && !draftId) {
      try {
        const draft = await aiDraftRepository.createDraft(
          activeConversationId || null,
          message.trim(),
          structuredData
        );
        draftId = draft.id;
        console.log('Created draft from chat stream:', draft.id);

        sendEvent({
          type: 'draft_created',
          draftId: draft.id,
          message: 'Draft created! You can apply it to a trip.',
        });
      } catch (error) {
        console.error('Failed to create draft from chat:', error.message);
      }
    }

    sendEvent({
      type: 'done',
      conversationId: activeConversationId,
      fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      draftId,
      hasItinerary: !!structuredData,
    });

    res.end();
  } catch (error) {
    sendEvent({ type: 'error', error: error.message });
    res.end();
  }
});

/**
 * @route GET /api/ai/tools
 * @desc Get available AI tools
 * @access Public
 */
export const getTools = asyncHandler(async (req, res) => {
  const { taskType } = req.query;
  const tools = aiService.getAvailableTools({ taskType });

  return sendSuccess(res, {
    tools: tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    })),
  });
});

/**
 * @route POST /api/ai/tools/:name/execute
 * @desc Execute a specific AI tool
 * @access Optional Auth
 */
export const executeTool = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const args = req.body;

  const result = await aiService.executeTool(name, args);

  if (!result.success) {
    throw new AppError(result.error, 400, 'TOOL_EXECUTION_ERROR');
  }

  return sendSuccess(res, result.data);
});

/**
 * @route POST /api/ai/recommend
 * @desc Get AI recommendations
 * @access Optional Auth
 */
export const getRecommendations = asyncHandler(async (req, res) => {
  const { location, type, budget, interests } = req.body;

  if (!location) {
    throw new AppError('Location is required', 400, 'INVALID_REQUEST');
  }

  const result = await aiService.getRecommendations({
    location,
    type,
    budget,
    interests,
  });

  return sendSuccess(res, {
    content: result.content,
    toolCalls: result.toolCalls,
    usage: result.usage,
  });
});

/**
 * @route POST /api/ai/estimate-budget
 * @desc Estimate trip budget with AI
 * @access Optional Auth
 */
export const estimateBudget = asyncHandler(async (req, res) => {
  const { destination, duration, travelers, style } = req.body;

  if (!destination || !duration) {
    throw new AppError('Destination and duration are required', 400, 'INVALID_REQUEST');
  }

  const result = await aiService.estimateBudget({
    destination,
    duration,
    travelers,
    style,
  });

  return sendSuccess(res, {
    content: result.content,
    toolCalls: result.toolCalls,
    usage: result.usage,
  });
});

/**
 * @route GET /api/ai/provider/status
 * @desc Get AI provider status
 * @access Public
 */
export const getProviderStatus = asyncHandler(async (req, res) => {
  const status = await aiService.getStatus();
  return sendSuccess(res, status);
});

/**
 * @route POST /api/ai/test-tools
 * @desc Test tool calling with a simple query
 * @access Public (for debugging)
 */
export const testTools = asyncHandler(async (req, res) => {
  const testMessage = req.body.message || 'Tìm kiếm nhà hàng ngon ở Đà Lạt';

  console.log('[Test] Testing tool calling with:', testMessage);

  const result = await aiService.chat(
    [{ role: 'user', content: testMessage }],
    {
      enableTools: true,
      skipCache: true,
      temperature: 0.5,
    }
  );

  return sendSuccess(res, {
    message: result.content,
    toolCalls: result.toolCalls || [],
    hasToolCalls: !!result.toolCalls && result.toolCalls.length > 0,
    model: result.model,
    usage: result.usage,
    debug: {
      toolsEnabled: process.env.AI_TOOLS_ENABLED !== 'false',
      aiModel: process.env.OAI_MODEL || process.env.AI_MODEL || 'gpt-4-turbo',
      baseUrl: process.env.OAI_BASE_URL || 'http://localhost:8317',
    },
  });
});

/**
 * @route GET /api/ai/quota
 * @desc Get user AI quota
 * @access Optional Auth
 */
export const getQuota = asyncHandler(async (req, res) => {
  const subscription = req.user?.subscription || {
    tier: 'FREE',
    aiQuotaUsed: 0,
    aiQuotaLimit: 10,
  };

  return sendSuccess(res, {
    quota: {
      tier: subscription.tier,
      monthlyLimit: subscription.aiQuotaLimit,
      used: subscription.aiQuotaUsed,
      remaining: Math.max(0, subscription.aiQuotaLimit - subscription.aiQuotaUsed),
      resetDate: getNextMonthStart().toISOString(),
    },
    usage: {
      thisMonth: subscription.aiQuotaUsed,
    },
  });
});

/**
 * @route DELETE /api/ai/cache
 * @desc Clear AI cache
 * @access Private
 */
export const clearCache = asyncHandler(async (req, res) => {
  await aiService.clearCache();
  return sendSuccess(res, null, 'AI cache cleared successfully');
});

/**
 * @route GET /api/ai/drafts
 * @desc Get AI itinerary drafts
 * @access Private
 */
export const listDrafts = asyncHandler(async (req, res) => {
  const { conversationId } = req.query;

  let drafts;
  if (conversationId) {
    drafts = await aiDraftRepository.getDraftsByConversation(conversationId);
  } else {
    drafts = await aiDraftRepository.getUnappliedDrafts(req.user.id);
  }

  return sendSuccess(res, { drafts });
});

/**
 * @route GET /api/ai/drafts/:id
 * @desc Get single AI itinerary draft
 * @access Private
 */
export const getDraft = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const draft = await aiDraftRepository.getDraftById(id);

  if (!draft) {
    throw new AppError('Draft not found', 404, 'NOT_FOUND');
  }

  if (draft.conversation && draft.conversation.user_id !== req.user.id) {
    throw new AppError('You do not have access to this draft', 403, 'FORBIDDEN');
  }

  return sendSuccess(res, { draft });
});

/**
 * Extract itinerary structured data from AI response
 */
function extractItineraryFromContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  try {
    // Try to find JSON block in markdown code fence
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);

      // Validate that it looks like an itinerary
      if (parsed.days && Array.isArray(parsed.days) && parsed.days.length > 0) {
        return parsed;
      }
    }

    // Try to find plain JSON object
    const jsonObjectMatch = content.match(/\{[\s\S]*"days"[\s\S]*\}/);
    if (jsonObjectMatch) {
      const parsed = JSON.parse(jsonObjectMatch[0]);
      if (parsed.days && Array.isArray(parsed.days) && parsed.days.length > 0) {
        return parsed;
      }
    }
  } catch (_error) {
    // JSON parsing failed, not an itinerary
    if (process.env.DEBUG_AI) {
      console.debug('No valid itinerary JSON found in response');
    }
  }

  return null;
}

/**
 * Generate title from first message
 */
function generateTitleFromMessage(message) {
  const truncated = message.trim().slice(0, 50);
  return truncated.length < message.trim().length ? `${truncated}...` : truncated;
}

/**
 * Get next month start date
 */
function getNextMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * @route GET /api/ai/logs
 * @desc Get AI flow logs
 * @access Private
 */
export const getLogs = asyncHandler(async (req, res) => {
  const { type = 'ai-flow', lines = 100 } = req.query;
  
  const logFiles = logger.getLogFiles();
  
  if (type === 'list') {
    return sendSuccess(res, { files: logFiles });
  }
  
  // Find the most recent log file of the requested type
  const prefix = type === 'ai-flow' ? 'ai-flow-' : 'app-';
  const targetFile = logFiles.find(f => f.name.startsWith(prefix));
  
  if (!targetFile) {
    return sendSuccess(res, { content: 'No logs found', file: null });
  }
  
  const content = logger.readLogFile(targetFile.name, parseInt(lines, 10));
  
  return sendSuccess(res, {
    file: targetFile.name,
    date: targetFile.date,
    content,
  });
});

export default {
  getConversations,
  getConversation,
  createConversation,
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
