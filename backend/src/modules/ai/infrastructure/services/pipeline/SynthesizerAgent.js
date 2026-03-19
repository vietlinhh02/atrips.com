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

    const numDays = (() => {
      if (context.startDate && context.endDate) {
        const s = new Date(context.startDate);
        const e = new Date(context.endDate);
        return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
      }
      const m = String(context.duration || '').match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 3;
    })();

    const userPrompt = `
# Trip Context
- Destination: ${context.destination}
- Dates: ${context.startDate || 'flexible'} to ${context.endDate || 'flexible'}
- Duration: ${numDays} days
- Group size: ${context.groupSize || 1}
- Budget: ${context.budget || 'mid-range'}
- Interests: ${(context.interests || []).join(', ') || 'general sightseeing'}
- Travel style: ${context.travelStyle || 'comfort'}
- Notes: ${context.freeformNotes || 'none'}

# Research Results (${funnelResult.summary.succeeded}/${funnelResult.summary.total} workers succeeded)
${workerSummary}

# Instructions
Create a COMPLETE ${numDays}-day itinerary using the research data above.

PART 1 — JSON itinerary inside a \`\`\`json code block. Required structure:
{
  "title": "Trip title in user's language",
  "destination": "${context.destination}",
  "startDate": "${context.startDate || ''}",
  "endDate": "${context.endDate || ''}",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "theme": "Day theme",
      "activities": [
        {
          "name": "Exact place name from research data",
          "type": "ATTRACTION|RESTAURANT|HOTEL|CAFE|ACTIVITY|SHOPPING",
          "time": "09:00",
          "duration": 90,
          "description": "What to do here",
          "address": "Full address",
          "location": "Venue, Area, City",
          "estimatedCost": 150000,
          "notes": "Tips, opening hours",
          "latitude": 16.46,
          "longitude": 107.59,
          "openingHours": "08:00-17:00",
          "transportFromPrevious": {
            "distance": 1.2, "duration": 15,
            "mode": "WALK|BIKE|TAXI|BUS",
            "cost": 0,
            "instructions": "Walk south along X street"
          }
        }
      ],
      "meals": {
        "breakfast": "Specific place",
        "lunch": "Specific place",
        "dinner": "Specific place"
      },
      "dailyCost": 850000
    }
  ],
  "totalEstimatedCost": 5000000,
  "currency": "VND",
  "budgetBreakdown": {
    "accommodation": {"total": 0, "perDay": 0},
    "food": {"total": 0, "perDay": 0},
    "transportation": {"total": 0, "perDay": 0},
    "activities": {"total": 0, "perDay": 0},
    "miscellaneous": {"total": 0, "perDay": 0}
  },
  "travelTips": ["tip1", "tip2"]
}

SCHEDULING RULES (violations are detected automatically):
- Every activity needs a specific "time" in HH:MM format
- No overlaps: activity must END before the next one STARTS
- Include travel time between activities (WALK <=1.2km, BIKE <=6km, TAXI <=25km)
- Day span: 8-14 hours (07:00-21:00 range)
- Cluster nearby places on the same day, total daily travel < 40km
- Include meals as RESTAURANT activities in the timeline
- MUST output exactly ${numDays} days — no truncation

PART 2 — Natural-language summary in the user's language.
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
