/**
 * Clarification Agent (Layer 1.5)
 * Evaluates user input and asks follow-up questions until
 * enough context exists to plan a trip.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getFastModel } from '../provider.js';
import { CLARIFICATION_SYSTEM_PROMPT } from '../../../domain/prompts/clarificationPrompt.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * Extract JSON object from a string that may contain markdown fences or extra text.
 */
function extractJSON(text) {
  if (!text) return null;
  // Try direct parse first
  try { return JSON.parse(text); } catch { /* continue */ }
  // Try extracting from ```json ... ```
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* continue */ }
  }
  // Try extracting first { ... } block
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) {
    try { return JSON.parse(braces[0]); } catch { /* continue */ }
  }
  return null;
}

/**
 * @typedef {Object} ClarifiedContext
 * @property {string} destination
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [duration]
 * @property {number} groupSize
 * @property {string} [budget]
 * @property {string[]} interests
 * @property {string} [travelStyle]
 * @property {string} freeformNotes
 */

/**
 * @typedef {Object} ClarificationResult
 * @property {boolean} complete
 * @property {ClarifiedContext} [context]
 * @property {string} [question]
 * @property {boolean} [notTravelQuery]
 * @property {string[]} [missing]
 * @property {Object} [gathered]
 */

export class ClarificationAgent {
  constructor() {
    this.model = getFastModel();
  }

  /**
   * Evaluate conversation and determine if context is complete.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [existingContext] - Previously gathered context
   * @returns {Promise<ClarificationResult>}
   */
  async evaluate(messages, existingContext = null) {
    const currentDate = new Date().toISOString().split('T')[0];
    const systemPrompt = CLARIFICATION_SYSTEM_PROMPT
      .replace('{currentDate}', currentDate);

    const lcMessages = [
      new SystemMessage(systemPrompt),
    ];

    if (existingContext) {
      lcMessages.push(new HumanMessage(
        `Previously gathered context: ${JSON.stringify(existingContext)}`
      ));
    }

    for (const msg of messages) {
      lcMessages.push(new HumanMessage(msg.content));
    }

    try {
      const response = await this.model.invoke(lcMessages);
      const content = typeof response.content === 'string'
        ? response.content : '';

      logger.info('[ClarificationAgent] Raw response:', {
        preview: content.substring(0, 200),
      });

      const parsed = extractJSON(content);
      if (!parsed) {
        throw new Error(`No valid JSON in response: ${content.substring(0, 200)}`);
      }

      logger.info('[ClarificationAgent] Result:', {
        complete: parsed.complete,
        missing: parsed.missing,
      });
      return parsed;
    } catch (error) {
      logger.error('[ClarificationAgent] Failed:', {
        error: error.message,
      });
      return {
        complete: false,
        question: 'Could you tell me more about your trip plans?',
        missing: ['unknown'],
        gathered: existingContext || {},
      };
    }
  }
}
