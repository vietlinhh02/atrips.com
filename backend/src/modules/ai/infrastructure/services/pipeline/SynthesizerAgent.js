/**
 * Synthesizer Agent (Layer 3 — Synthesis)
 * Analyzes all worker results and creates the final trip plan.
 * Uses LLM to organize data, then calls create_trip_plan to save draft.
 * Does NOT call optimize_itinerary — browser workers already did the research.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getModel } from '../provider.js';
import { SYNTHESIZER_SYSTEM_PROMPT } from '../../../domain/prompts/synthesizerPrompt.js';
import toolExecutor from '../ToolExecutor.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

export class SynthesizerAgent {
  constructor(modelId, executionContext = {}) {
    this.modelId = modelId;
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
    const model = getModel(this.modelId);

    // Format worker results for LLM
    const workerSummary = funnelResult.results.map(r => {
      if (r.status === 'success') {
        return `## ${r.taskType} (SUCCESS)\n${JSON.stringify(r.data, null, 2)}`;
      }
      return `## ${r.taskType} (${r.status.toUpperCase()})\nError: ${r.error || 'No data'}`;
    }).join('\n\n');

    const userPrompt = `
# Trip Context
${JSON.stringify(context, null, 2)}

# Research Results (${funnelResult.summary.succeeded}/${funnelResult.summary.total} workers succeeded)
${workerSummary}

# Instructions
Based on the research data above, create a complete day-by-day itinerary.
Respond with TWO parts:

PART 1 - JSON itinerary (inside \`\`\`json code block):
{
  "title": "Trip title",
  "destination": "...",
  "startDate": "...",
  "endDate": "...",
  "overview": "Brief trip overview",
  "days": [
    {
      "dayNumber": 1,
      "title": "Day title",
      "activities": [
        {
          "name": "Place name",
          "type": "ATTRACTION|RESTAURANT|HOTEL|CAFE|ACTIVITY",
          "time": "08:00",
          "duration": 90,
          "description": "What to do here",
          "address": "...",
          "estimatedCost": 100000,
          "notes": "Tips"
        }
      ]
    }
  ],
  "budgetBreakdown": { "accommodation": 0, "food": 0, "transport": 0, "activities": 0, "total": 0 },
  "travelTips": ["tip1", "tip2"]
}

PART 2 - A friendly summary in the user's language describing the plan.
`.trim();

    try {
      logger.info('[SynthesizerAgent] Starting synthesis:', {
        workerResults: funnelResult.summary,
        destination: context.destination,
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
