/**
 * Synthesizer Agent (Layer 3 — Synthesis)
 * Analyzes all worker results and creates the final trip plan.
 * Uses LLM to organize data, then calls create_trip_plan to save draft.
 * Does NOT call optimize_itinerary — browser workers already did the research.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getSynthesisModel } from '../provider.js';
import { SYNTHESIZER_SYSTEM_PROMPT } from '../../../domain/prompts/synthesizerPrompt.js';
import toolExecutor from '../ToolExecutor.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

export class SynthesizerAgent {
  constructor(executionContext = {}) {
    this.executionContext = executionContext;
  }

  /**
   * Synthesize worker results into a trip plan.
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @param {import('./Funnel.js').FunnelResult} funnelResult
   * @returns {Promise<{content: string, toolCalls: Array, usage: Object, draftId?: string}>}
   */
  async synthesize(context, funnelResult) {
    const model = getSynthesisModel();

    // Format worker results for LLM — compact, essential fields only
    const workerSummary = funnelResult.results.map(r => {
      if (r.status === 'success') {
        const compacted = compactWorkerData(r.data);
        return `## ${r.taskType} (SUCCESS)\n${compacted}`;
      }
      return `## ${r.taskType} (${r.status.toUpperCase()})\nError: ${r.error || 'No data'}`;
    }).join('\n\n');

    const numDays = (() => {
      if (context.startDate && context.endDate) {
        const s = new Date(context.startDate);
        const e = new Date(context.endDate);
        return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
      }
      const m = String(context.duration || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 3;
    })();

    const userPrompt = `# Trip: ${context.destination}, ${numDays} days
Dates: ${context.startDate || 'flexible'} → ${context.endDate || 'flexible'}
Group: ${context.groupSize || 1} | Budget: ${context.budget || 'mid-range'} | Style: ${context.travelStyle || 'comfort'}
Interests: ${(context.interests || []).join(', ') || 'general sightseeing'}

# Research (${funnelResult.summary.succeeded}/${funnelResult.summary.total} OK)
${workerSummary}

Create a ${numDays}-day itinerary JSON (see system prompt for schema) + brief summary. Include enough activities to fill each day (typically 4-7 per day including meals). Use ONLY real places from research data above — copy their rating, ratingCount, coordinates exactly. Output ALL ${numDays} days.`.trim();

    try {
      const inputChars = SYNTHESIZER_SYSTEM_PROMPT.length + userPrompt.length;
      logger.info('[SynthesizerAgent] Starting synthesis:', {
        workerResults: funnelResult.summary,
        destination: context.destination,
        inputChars,
        estimatedInputTokens: Math.ceil(inputChars / 4),
      });

      const startTime = Date.now();
      logger.info('[SynthesizerAgent] Calling LLM...', {
        model: model.model,
        estimatedInputTokens: Math.ceil(inputChars / 4),
      });
      const response = await model.invoke([
        new SystemMessage(SYNTHESIZER_SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      const content = typeof response.content === 'string'
        ? response.content : '';

      const usage = {
        inputTokens: response.usage_metadata?.input_tokens || 0,
        outputTokens: response.usage_metadata?.output_tokens || 0,
      };

      logger.info('[SynthesizerAgent] LLM call complete:', {
        durationMs: Date.now() - startTime,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        outputChars: content.length,
        responsePreview: content.substring(0, 500),
      });

      // Extract itinerary JSON from response
      const itineraryData = extractItineraryJSON(content);
      const toolCalls = [];
      let draftId = null;

      if (itineraryData) {
        // Call create_trip_plan to save draft with ALL Phase 1 fields
        const { userId, conversationId, userProfile } = this.executionContext;
        toolExecutor.setUserContext(userId);
        toolExecutor.setConversationContext(conversationId);
        toolExecutor.setUserProfile(userProfile);

        const createResult = await toolExecutor.execute('create_trip_plan', {
          title: itineraryData.title,
          destination: itineraryData.destination || context.destination,
          startDate: itineraryData.startDate || context.startDate,
          endDate: itineraryData.endDate || context.endDate,
          travelersCount: context.groupSize || 1,
          itineraryData,
          overview: itineraryData.overview || null,
          travelTips: itineraryData.travelTips || null,
          budgetBreakdown: itineraryData.budgetBreakdown || null,
          bookingSuggestions: itineraryData.bookingSuggestions || null,
          userMessage: context.freeformNotes || `Trip to ${context.destination}`,
        });

        toolCalls.push({ name: 'create_trip_plan', result: createResult });

        if (createResult.success && createResult.data?.draftId) {
          draftId = createResult.data.draftId;
        }

        logger.info('[SynthesizerAgent] Draft created:', { draftId });
      }

      // Clean the content — remove JSON block for user-facing text
      const cleanContent = content
        .replace(/```json[\s\S]*?```/g, '')
        .trim();

      logger.info('[SynthesizerAgent] Synthesis complete:', {
        contentLength: cleanContent.length,
        hasDraft: !!draftId,
      });

      return {
        content: cleanContent,
        toolCalls,
        usage,
        draftId,
        itineraryData,
      };
    } catch (error) {
      logger.error('[SynthesizerAgent] Failed:', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Stream synthesis: buffer JSON silently, stream Markdown token-by-token.
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @param {import('./Funnel.js').FunnelResult} funnelResult
   * @param {Object} [opts]
   * @param {AbortSignal} [opts.signal]
   * @returns {AsyncGenerator<{type: string, content?: string, draftId?: string}>}
   */
  async *synthesizeStream(context, funnelResult, opts = {}) {
    const { signal } = opts;
    const model = getSynthesisModel();

    const workerSummary = funnelResult.results.map(r => {
      if (r.status === 'success') {
        const compacted = compactWorkerData(r.data);
        return `## ${r.taskType} (SUCCESS)\n${compacted}`;
      }
      return `## ${r.taskType} (${r.status.toUpperCase()})\nError: ${r.error || 'No data'}`;
    }).join('\n\n');

    const numDays = (() => {
      if (context.startDate && context.endDate) {
        const s = new Date(context.startDate);
        const e = new Date(context.endDate);
        return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
      }
      const m = String(context.duration || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 3;
    })();

    const userPrompt = `# Trip: ${context.destination}, ${numDays} days
Dates: ${context.startDate || 'flexible'} → ${context.endDate || 'flexible'}
Group: ${context.groupSize || 1} | Budget: ${context.budget || 'mid-range'} | Style: ${context.travelStyle || 'comfort'}
Interests: ${(context.interests || []).join(', ') || 'general sightseeing'}

# Research (${funnelResult.summary.succeeded}/${funnelResult.summary.total} OK)
${workerSummary}

Create a ${numDays}-day itinerary JSON (see system prompt for schema) + brief summary. Include enough activities to fill each day (typically 4-7 per day including meals). Use ONLY real places from research data above — copy their rating, ratingCount, coordinates exactly. Output ALL ${numDays} days.`.trim();

    try {
      logger.info('[SynthesizerAgent] Starting streaming synthesis');
      const startTime = Date.now();

      const stream = await model.stream([
        new SystemMessage(SYNTHESIZER_SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ], { signal });

      // State machine for split-stream
      let fullContent = '';
      let jsonBuffer = '';
      let inJsonBlock = false;
      let fenceBuffer = '';
      let itineraryData = null;
      let draftId = null;
      let usage = { inputTokens: 0, outputTokens: 0 };

      for await (const chunk of stream) {
        if (signal?.aborted) return;

        const token = typeof chunk.content === 'string'
          ? chunk.content : '';
        if (!token) {
          // Capture usage from final chunk
          if (chunk.usage_metadata) {
            usage.inputTokens =
              chunk.usage_metadata.input_tokens || 0;
            usage.outputTokens =
              chunk.usage_metadata.output_tokens || 0;
          }
          continue;
        }
        fullContent += token;

        if (inJsonBlock) {
          // Check for closing fence
          const combined = fenceBuffer + token;
          fenceBuffer = '';
          const closeIdx = combined.indexOf('```');
          if (closeIdx !== -1) {
            // JSON block ends
            jsonBuffer += combined.substring(0, closeIdx);
            inJsonBlock = false;
            itineraryData =
              this._parseItinerary(jsonBuffer, fullContent);
            if (itineraryData) {
              draftId = await this._saveDraft(
                itineraryData, context,
              );
              yield {
                type: 'draft_created', draftId, itineraryData,
              };
            }
            // Stream any remaining text after the fence
            const after = combined.substring(closeIdx + 3);
            if (after.trim()) {
              yield { type: 'content', content: after };
            }
          } else if (
            combined.endsWith('`') || combined.endsWith('``')
          ) {
            // Possible partial fence — buffer it
            const safeEnd = combined.length
              - (combined.endsWith('``') ? 2 : 1);
            jsonBuffer += combined.substring(0, safeEnd);
            fenceBuffer = combined.substring(safeEnd);
          } else {
            jsonBuffer += combined;
          }
          continue;
        }

        // Combine with any buffered partial fence
        const combined = fenceBuffer + token;
        fenceBuffer = '';

        // Check for opening fence
        const openIdx = combined.indexOf('```json');
        if (openIdx !== -1) {
          // Stream any text before the fence
          const before = combined.substring(0, openIdx);
          if (before.trim()) {
            yield { type: 'content', content: before };
          }
          inJsonBlock = true;
          jsonBuffer = '';
          // Capture content after ```json\n
          const afterFence = combined
            .substring(openIdx + 7).replace(/^\n/, '');
          if (afterFence) jsonBuffer = afterFence;
          continue;
        }

        // Check for partial opening fence at end
        if (
          combined.endsWith('`')
          || combined.endsWith('``')
          || combined.endsWith('```')
        ) {
          fenceBuffer = combined;
          continue;
        }

        // Normal Markdown content — stream immediately
        if (combined) {
          yield { type: 'content', content: combined };
        }
      }

      // Flush any remaining fence buffer
      if (fenceBuffer) {
        yield { type: 'content', content: fenceBuffer };
      }

      // Fallback: extract JSON from full content if missed
      if (!itineraryData) {
        itineraryData = extractItineraryJSON(fullContent);
        if (itineraryData) {
          draftId = await this._saveDraft(
            itineraryData, context,
          );
          yield {
            type: 'draft_created', draftId, itineraryData,
          };
        }
      }

      logger.info('[SynthesizerAgent] Streaming complete:', {
        durationMs: Date.now() - startTime,
        usage,
        hasDraft: !!draftId,
      });

      yield { type: 'usage', usage };
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('[SynthesizerAgent] Stream aborted by client');
        return;
      }
      logger.error('[SynthesizerAgent] Stream failed:', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Parse itinerary JSON from buffer, with fallback.
   */
  _parseItinerary(jsonStr, fullContent) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.days && Array.isArray(parsed.days)) return parsed;
    } catch { /* fallback */ }
    return extractItineraryJSON(fullContent);
  }

  /**
   * Save draft via toolExecutor. Returns draftId or null.
   */
  async _saveDraft(itineraryData, context) {
    try {
      const { userId, conversationId, userProfile } =
        this.executionContext;
      toolExecutor.setUserContext(userId);
      toolExecutor.setConversationContext(conversationId);
      toolExecutor.setUserProfile(userProfile);

      const result = await toolExecutor.execute(
        'create_trip_plan', {
          title: itineraryData.title,
          destination:
            itineraryData.destination || context.destination,
          startDate:
            itineraryData.startDate || context.startDate,
          endDate:
            itineraryData.endDate || context.endDate,
          travelersCount: context.groupSize || 1,
          itineraryData,
          overview: itineraryData.overview || null,
          travelTips: itineraryData.travelTips || null,
          budgetBreakdown:
            itineraryData.budgetBreakdown || null,
          bookingSuggestions:
            itineraryData.bookingSuggestions || null,
          userMessage:
            context.freeformNotes
            || `Trip to ${context.destination}`,
        },
      );

      if (result.success && result.data?.draftId) {
        return result.data.draftId;
      }
    } catch (err) {
      logger.error('[SynthesizerAgent] Draft save failed:', {
        error: err.message,
      });
    }
    return null;
  }
}

/**
 * Compact worker data to reduce LLM input tokens.
 * Keeps only fields essential for itinerary creation.
 */
function compactWorkerData(data) {
  if (!data) return 'No data';
  if (typeof data === 'string') return data.substring(0, 3000);

  const MAX_ITEMS = 15;
  const KEEP_FIELDS = [
    'name', 'type', 'address', 'latitude', 'longitude',
    'rating', 'ratingCount', 'price', 'cost', 'estimatedCost',
    'description', 'openingHours', 'category', 'url', 'distance',
    'phone', 'website', 'title', 'snippet', 'cid',
  ];

  function slim(obj) {
    if (Array.isArray(obj)) {
      return obj.slice(0, MAX_ITEMS).map(slim);
    }
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const key of Object.keys(obj)) {
        if (KEEP_FIELDS.includes(key) || key === 'results' || key === 'places' || key === 'webContext' || key === 'hotels') {
          out[key] = slim(obj[key]);
        }
      }
      return Object.keys(out).length > 0 ? out : obj;
    }
    return obj;
  }

  const compacted = slim(data);
  const json = JSON.stringify(compacted);
  return json.length > 4000 ? json.substring(0, 4000) + '...' : json;
}

function extractItineraryJSON(content) {
  if (!content) return null;
  try {
    const match = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      if (parsed.days && Array.isArray(parsed.days)) return parsed;
    }
  } catch { /* continue */ }
  try {
    const match = content.match(/\{[\s\S]*"days"[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.days && Array.isArray(parsed.days)) return parsed;
    }
  } catch { /* not valid */ }
  return null;
}
