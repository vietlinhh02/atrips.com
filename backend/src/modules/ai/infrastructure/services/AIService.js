/**
 * AI Service
 * Handles communication with OpenAI-compatible AI providers
 * Includes caching support and tool calling
 */

import cacheService from '../../../../shared/services/CacheService.js';
import { buildSystemPrompt, buildTaskPrompt } from '../../domain/prompts/index.js';
import { TOOL_DEFINITIONS, getToolsForContext } from '../../domain/tools/index.js';
import toolExecutor from './ToolExecutor.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  CHAT: 3600,        // 1 hour for chat responses
  MODELS: 86400,     // 24 hours for models list
  STATUS: 300,       // 5 minutes for status
};

// Maximum tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 5;

class AIService {
  constructor() {
    this.baseUrl = process.env.OAI_BASE_URL || 'http://localhost:8317';
    this.apiKey = process.env.OAI_API_KEY || '';
    this.model = process.env.OAI_MODEL || process.env.AI_MODEL || 'gpt-4-turbo';
    this.fallbackModel = process.env.OAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
    this.cacheEnabled = process.env.AI_CACHE_ENABLED !== 'false';
    this.toolsEnabled = process.env.AI_TOOLS_ENABLED !== 'false';
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Build system prompt for the AI
   */
  getSystemPrompt(context = {}, taskType = null) {
    if (taskType) {
      return buildTaskPrompt(taskType, context);
    }
    return buildSystemPrompt(context);
  }

  /**
   * Generate cache key for chat request
   */
  generateCacheKey(messages, options = {}) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const cacheData = {
      message: lastUserMessage?.content || '',
      model: options.model || this.model,
      contextKeys: Object.keys(options.context || {}),
    };
    return cacheService.generateChatKey([cacheData], options);
  }

  /**
   * Chat with AI (non-streaming) with tool support
   */
  async chat(messages, options = {}) {
    const {
      model = this.model,
      temperature = 0.7,
      maxTokens = 16384,
      context = {},
      taskType = null,
      skipCache = false,
      enableTools = this.toolsEnabled,
      tools = null,
      userId = null,
      conversationId = null,
    } = options;

    // Set user context for tool executor (needed for trip management tools)
    if (userId) {
      toolExecutor.setUserContext(userId);
    }

    // Set user profile for tool executor (needed for personalized planning)
    toolExecutor.setUserProfile(context.userProfile || null);

    // Set conversation context for tool executor (needed for draft creation)
    toolExecutor.setConversationContext(conversationId);

    // Prepend system message if not already present
    const systemMessage = {
      role: 'system',
      content: this.getSystemPrompt(context, taskType),
    };

    const hasSystemMessage = messages.some(m => m.role === 'system');
    let finalMessages = hasSystemMessage ? [...messages] : [systemMessage, ...messages];

    // Check cache first
    const cacheKey = this.generateCacheKey(messages, { model, context });

    if (this.cacheEnabled && !skipCache && temperature <= 0.3 && !enableTools) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log('[Cache] AI cache hit:', cacheKey.substring(0, 30));
        return { ...cached, fromCache: true };
      }
    }

    // Get tools for this context
    const toolDefinitions = enableTools
      ? (tools || getToolsForContext({ taskType }))
      : undefined;

    console.log('[AI] Tool calling config:', {
      enableTools,
      toolsEnabled: this.toolsEnabled,
      toolCount: toolDefinitions?.length || 0,
      toolNames: toolDefinitions?.map(t => t.function.name) || [],
    });

    try {
      let iterations = 0;
      let toolCalls = [];
      let finalResult = null;

      // Tool calling loop
      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        const requestBody = {
          model,
          messages: finalMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        };

        // Add tools if enabled
        if (toolDefinitions && toolDefinitions.length > 0) {
          requestBody.tools = toolDefinitions;
          requestBody.tool_choice = 'auto';
        }

        console.log('[AI] Sending request:', {
          url: `${this.baseUrl}/v1/chat/completions`,
          model: requestBody.model,
          hasTools: !!requestBody.tools,
          toolChoice: requestBody.tool_choice,
          messageCount: requestBody.messages.length,
        });

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`AI request failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];

        console.log('[AI] Response:', {
          hasToolCalls: !!choice?.message?.tool_calls,
          toolCallsCount: choice?.message?.tool_calls?.length || 0,
          finishReason: choice?.finish_reason,
          contentPreview: choice?.message?.content?.substring(0, 100),
        });

        // Check if AI wants to call tools
        if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
          // Add assistant message with tool calls
          finalMessages.push({
            role: 'assistant',
            content: choice.message.content || null,
            tool_calls: choice.message.tool_calls,
          });

          // Execute each tool call
          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

            console.log(`[Tool] Executing: ${toolName}`, toolArgs);

            const toolResult = await toolExecutor.execute(toolName, toolArgs);

            toolCalls.push({
              name: toolName,
              arguments: toolArgs,
              result: toolResult,
            });

            // Add tool result to messages
            finalMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });
          }

          // Continue loop to get final response
          continue;
        }

        // No more tool calls, we have final response
        finalResult = {
          content: choice?.message?.content || '',
          usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: data.model || model,
          finishReason: choice?.finish_reason || 'stop',
          fromCache: false,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };

        break;
      }

      // Cache the result if no tools were used
      if (this.cacheEnabled && !skipCache && temperature <= 0.3 && toolCalls.length === 0) {
        await cacheService.set(cacheKey, finalResult, CACHE_TTL.CHAT);
        console.log('[Cache] AI response cached:', cacheKey.substring(0, 30));
      }

      return finalResult;
    } catch (error) {
      // Try fallback model
      if (model !== this.fallbackModel) {
        console.warn(`Primary model failed, trying fallback: ${this.fallbackModel}`);
        return this.chat(messages, { ...options, model: this.fallbackModel });
      }
      throw error;
    }
  }

  /**
   * Chat with AI (streaming) with tool support
   */
  async *chatStream(messages, options = {}) {
    const {
      model = this.model,
      temperature = 0.7,
      maxTokens = 16384,
      context = {},
      taskType = null,
      enableTools = this.toolsEnabled,
      tools = null,
      userId = null,
      conversationId = null,
    } = options;

    // Set user context for tool executor (needed for trip management tools)
    if (userId) {
      toolExecutor.setUserContext(userId);
    }

    // Set user profile for tool executor (needed for personalized planning)
    toolExecutor.setUserProfile(context.userProfile || null);

    // Set conversation context for tool executor (needed for draft creation)
    toolExecutor.setConversationContext(conversationId);

    const systemMessage = {
      role: 'system',
      content: this.getSystemPrompt(context, taskType),
    };

    const hasSystemMessage = messages.some(m => m.role === 'system');
    let finalMessages = hasSystemMessage ? [...messages] : [systemMessage, ...messages];

    const toolDefinitions = enableTools
      ? (tools || getToolsForContext({ taskType }))
      : undefined;

    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const requestBody = {
        model,
        messages: finalMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      if (toolDefinitions && toolDefinitions.length > 0) {
        requestBody.tools = toolDefinitions;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI stream request failed: ${response.status} - ${error}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolCalls = [];
      let hasToolCalls = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // Handle tool calls in stream
              if (delta?.tool_calls) {
                hasToolCalls = true;
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;
                  if (!currentToolCalls[index]) {
                    currentToolCalls[index] = {
                      id: toolCallDelta.id || `call_${index}`,
                      type: 'function',
                      function: { name: '', arguments: '' },
                    };
                  }
                  if (toolCallDelta.function?.name) {
                    currentToolCalls[index].function.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    currentToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                  }
                }
              }

              // Handle content
              const content = delta?.content;
              if (content) {
                yield { type: 'content', content };
              }

              if (parsed.choices?.[0]?.finish_reason) {
                yield { type: 'finish', reason: parsed.choices[0].finish_reason };
              }
            } catch (parseError) {
              // Skip invalid JSON lines - log in debug mode
              if (process.env.DEBUG_AI) {
                console.debug('Failed to parse SSE line:', parseError.message);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Process tool calls if any
      if (hasToolCalls && currentToolCalls.length > 0) {
        // Add assistant message with tool calls
        finalMessages.push({
          role: 'assistant',
          content: null,
          tool_calls: currentToolCalls,
        });

        // Execute tools and add results
        for (const toolCall of currentToolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

          yield { type: 'tool_call', name: toolName, arguments: toolArgs };

          const toolResult = await toolExecutor.execute(toolName, toolArgs);

          yield { type: 'tool_result', name: toolName, result: toolResult };

          finalMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Continue to get final response
        continue;
      }

      // No more tool calls, exit loop
      break;
    }
  }

  /**
   * Get place recommendations with tools
   */
  async getRecommendations(params) {
    const { location, type, budget, interests = [] } = params;

    const context = {
      destination: location,
      budget,
      interests,
    };

    const userMessage = `Recommend the best ${type || 'places'} in ${location}.
${budget ? `Budget: ${budget}` : ''}
${interests.length > 0 ? `Interests: ${interests.join(', ')}` : ''}

Use the search_places tool to find real venues with verified data.`;

    return this.chat(
      [{ role: 'user', content: userMessage }],
      {
        context,
        taskType: 'recommend',
        temperature: 0.6,
        enableTools: true,
      }
    );
  }

  /**
   * Estimate trip budget with tools
   */
  async estimateBudget(params) {
    const { destination, duration, travelers = 1, style = 'comfort' } = params;

    const context = {
      destination,
      duration,
      travelers,
      travelStyle: style,
    };

    const userMessage = `Estimate the total cost for a trip to ${destination} for ${duration}.
Travelers: ${travelers}
Style: ${style}

Use tools to look up flight prices, hotel rates, and exchange rates.
Break down by category.`;

    return this.chat(
      [{ role: 'user', content: userMessage }],
      {
        context,
        taskType: 'budget',
        temperature: 0.4,
        enableTools: true,
      }
    );
  }

  /**
   * Execute a single tool manually
   */
  async executeTool(toolName, args) {
    return toolExecutor.execute(toolName, args);
  }

  /**
   * Get available tools
   */
  getAvailableTools(context = {}) {
    return getToolsForContext(context);
  }

  /**
   * Get all tool definitions
   */
  getAllToolDefinitions() {
    return TOOL_DEFINITIONS;
  }

  /**
   * Get available models (cached)
   */
  async getModels() {
    const cacheKey = 'ai:models:list';

    if (this.cacheEnabled) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return this.getDefaultModels();
      }

      const data = await response.json();

      if (this.cacheEnabled) {
        await cacheService.set(cacheKey, data, CACHE_TTL.MODELS);
      }

      return data;
    } catch (error) {
      console.warn('Failed to fetch models list:', error.message);
      return this.getDefaultModels();
    }
  }

  /**
   * Get default models list
   */
  getDefaultModels() {
    return {
      object: 'list',
      data: [
        {
          id: this.model,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'atrips',
        },
        {
          id: this.fallbackModel,
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'atrips',
        },
      ],
    };
  }

  /**
   * Get provider status (cached)
   */
  async getStatus() {
    const cacheKey = 'ai:provider:status';

    if (this.cacheEnabled) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    try {
      const models = await this.getModels();
      const cacheStats = await cacheService.getStats();
      const availableTools = this.getAvailableTools();

      const status = {
        provider: 'openai-compatible',
        status: 'operational',
        baseUrl: this.baseUrl,
        primaryModel: this.model,
        fallbackModel: this.fallbackModel,
        availableModels: models.data || [],
        tools: {
          enabled: this.toolsEnabled,
          available: availableTools.map(t => t.function.name),
        },
        cache: {
          enabled: this.cacheEnabled,
          ...cacheStats,
        },
      };

      if (this.cacheEnabled) {
        await cacheService.set(cacheKey, status, CACHE_TTL.STATUS);
      }

      return status;
    } catch (error) {
      return {
        provider: 'openai-compatible',
        status: 'error',
        error: error.message,
        tools: { enabled: this.toolsEnabled },
        cache: { enabled: this.cacheEnabled },
      };
    }
  }

  /**
   * Clear AI cache
   */
  async clearCache() {
    await cacheService.delPattern('ai:*');
    console.log('[Cache] AI cache cleared');
  }
}

export default new AIService();
