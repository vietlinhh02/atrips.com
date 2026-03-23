/**
 * Orchestrator Agent (Layer 2)
 * Analyzes clarified context and creates a work plan
 * with tasks to distribute to browser workers.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'node:crypto';
import { getFastModel } from '../provider.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '../../../domain/prompts/orchestratorPrompt.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

const PLAN_ANGLES = [
  'hidden gems and local favorites',
  'popular landmarks and must-see spots',
  'seasonal specialties and current events',
  'off-the-beaten-path and unique experiences',
  'food-focused and culinary exploration',
  'nature and outdoor activities',
  'culture, history, and architecture',
];

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* continue */ } }
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) { try { return JSON.parse(braces[0]); } catch { /* continue */ } }
  return null;
}

/**
 * @typedef {Object} WorkerTask
 * @property {string} taskId
 * @property {string} taskType
 * @property {string} query
 * @property {number} priority
 */

/**
 * @typedef {Object} WorkPlan
 * @property {WorkerTask[]} tasks
 */

export class OrchestratorAgent {
  constructor() {
    this.model = getFastModel();
  }

  /**
   * Create a work plan from clarified context.
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @param {Object} [userProfile] - Onboarding profile for personalization
   * @returns {Promise<WorkPlan>}
   */
  async createWorkPlan(context, userProfile) {
    const angle = PLAN_ANGLES[Math.floor(Math.random() * PLAN_ANGLES.length)];

    // Build user profile summary for query personalization
    let profileBlock = '';
    if (userProfile?.travelProfile) {
      const tp = userProfile.travelProfile;
      const parts = [];
      if (tp.travelerTypes?.length) {
        parts.push(`travelerTypes: ${JSON.stringify(tp.travelerTypes)}`);
      }
      if (tp.spendingHabits) {
        parts.push(`spendingHabits: "${tp.spendingHabits}"`);
      }
      if (tp.dailyRhythm) {
        parts.push(`dailyRhythm: "${tp.dailyRhythm}"`);
      }
      if (userProfile.preferences?.dietaryRestrictions?.length) {
        parts.push(
          `dietaryRestrictions: ${JSON.stringify(userProfile.preferences.dietaryRestrictions)}`,
        );
      }
      if (parts.length > 0) {
        profileBlock = `\n\nUser profile: { ${parts.join(', ')} }`;
      }
    }

    const lcMessages = [
      new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
      new HumanMessage(
        `Create a research work plan for this trip:\n${JSON.stringify(context, null, 2)}${profileBlock}\n\nFocus angle for this plan: ${angle}. Bias your search queries toward this theme while still covering essentials.`
      ),
    ];

    logger.info('[OrchestratorAgent] Using angle:', { angle });

    try {
      const response = await this.model.invoke(lcMessages);
      const content = typeof response.content === 'string'
        ? response.content : '';

      logger.info('[OrchestratorAgent] Raw response:', {
        preview: content.substring(0, 200),
      });

      const parsed = extractJSON(content);
      if (!parsed) throw new Error('No valid JSON in response');

      // Ensure each task has a unique taskId
      const tasks = (parsed.tasks || []).map(task => ({
        ...task,
        taskId: task.taskId || randomUUID(),
      }));

      logger.info('[OrchestratorAgent] Work plan created:', {
        taskCount: tasks.length,
        types: tasks.map(t => t.taskType),
      });

      return { tasks };
    } catch (error) {
      logger.error('[OrchestratorAgent] Failed:', {
        error: error.message,
      });
      // Fallback: create basic tasks from context
      return this._fallbackPlan(context);
    }
  }

  /**
   * Generate a minimal fallback plan when LLM fails.
   */
  _fallbackPlan(context) {
    const dest = context.destination || 'the destination';
    return {
      tasks: [
        {
          taskId: randomUUID(),
          taskType: 'hotels',
          query: `best hotels in ${dest}`,
          priority: 1,
        },
        {
          taskId: randomUUID(),
          taskType: 'attractions',
          query: `top attractions in ${dest}`,
          priority: 1,
        },
        {
          taskId: randomUUID(),
          taskType: 'restaurants',
          query: `best restaurants in ${dest}`,
          priority: 2,
        },
      ],
    };
  }
}
