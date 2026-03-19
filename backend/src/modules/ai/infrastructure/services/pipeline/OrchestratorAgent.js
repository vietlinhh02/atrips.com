/**
 * Orchestrator Agent (Layer 2)
 * Analyzes clarified context and creates a work plan
 * with tasks to distribute to browser workers.
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'node:crypto';
import { getModel } from '../provider.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '../../../domain/prompts/orchestratorPrompt.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

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
  constructor(modelId) {
    this.model = getModel(modelId);
  }

  /**
   * Create a work plan from clarified context.
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @returns {Promise<WorkPlan>}
   */
  async createWorkPlan(context) {
    const lcMessages = [
      new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
      new HumanMessage(
        `Create a research work plan for this trip:\n${JSON.stringify(context, null, 2)}`
      ),
    ];

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
