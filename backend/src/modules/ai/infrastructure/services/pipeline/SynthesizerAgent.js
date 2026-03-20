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

Create a ${numDays}-day itinerary JSON (see system prompt for schema) + brief summary. Include 4-6 activities per day with meals as RESTAURANT type. Output ALL ${numDays} days.`.trim();

    try {
      const inputChars = SYNTHESIZER_SYSTEM_PROMPT.length + userPrompt.length;
      logger.info('[SynthesizerAgent] Starting synthesis:', {
        workerResults: funnelResult.summary,
        destination: context.destination,
        inputChars,
        estimatedInputTokens: Math.ceil(inputChars / 4),
      });

      const startTime = Date.now();
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
      });

      // Extract itinerary JSON from response
      const itineraryData = extractItineraryJSON(content);
      const toolCalls = [];
      let draftId = null;

      if (itineraryData) {
        // Call create_trip_plan to save draft
        const { userId, conversationId, userProfile } = this.executionContext;
        toolExecutor.setUserContext(userId);
        toolExecutor.setConversationContext(conversationId);
        toolExecutor.setUserProfile(userProfile);

        const createResult = await toolExecutor.execute('create_trip_plan', {
          itineraryData,
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
    'rating', 'price', 'cost', 'estimatedCost', 'description',
    'openingHours', 'category', 'url', 'distance',
  ];

  function slim(obj) {
    if (Array.isArray(obj)) {
      return obj.slice(0, MAX_ITEMS).map(slim);
    }
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const key of Object.keys(obj)) {
        if (KEEP_FIELDS.includes(key) || key === 'results' || key === 'places') {
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
