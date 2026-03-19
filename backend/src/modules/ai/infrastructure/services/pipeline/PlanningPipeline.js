/**
 * Planning Pipeline
 * Orchestrates the full 5-layer flow:
 *   Layer 1.5 (Clarification) → Layer 2 (Orchestrator) →
 *   Layer 2.5 (Workers) → Layer 3 (Funnel + Synthesizer)
 */

import { ClarificationAgent } from './ClarificationAgent.js';
import { OrchestratorAgent } from './OrchestratorAgent.js';
import { WorkerClient } from './WorkerClient.js';
import { Funnel } from './Funnel.js';
import { SynthesizerAgent } from './SynthesizerAgent.js';
import { verifyItinerary } from '../../../domain/algorithms/ItineraryVerifier.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

/**
 * @typedef {Object} PipelineOptions
 * @property {string} [modelId]
 * @property {string} [userId]
 * @property {string} [conversationId]
 * @property {Object} [userProfile]
 */

export class PlanningPipeline {
  /**
   * @param {PipelineOptions} options
   */
  constructor(options = {}) {
    const { modelId, userId, conversationId, userProfile } = options;
    this.modelId = modelId;
    this.executionContext = { userId, conversationId, userProfile };

    this.clarifier = new ClarificationAgent(modelId);
    this.orchestrator = new OrchestratorAgent(modelId);
    this.workerClient = new WorkerClient();
    this.funnel = new Funnel(this.workerClient);
    this.synthesizer = new SynthesizerAgent(modelId, this.executionContext);
  }

  /**
   * Run the clarification step only.
   * Returns either a question or complete context.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [existingContext]
   * @returns {Promise<import('./ClarificationAgent.js').ClarificationResult>}
   */
  async clarify(messages, existingContext) {
    return this.clarifier.evaluate(messages, existingContext);
  }

  /**
   * Run the full planning pipeline (Layers 2 → 2.5 → 3).
   * Call this only after clarification is complete.
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @param {(event: Object) => void} [onProgress]
   * @returns {Promise<{content: string, toolCalls: Array, usage: Object, draftId?: string}>}
   */
  async plan(context, onProgress) {
    const emit = onProgress || (() => {});

    // Layer 2: Create work plan
    logger.info('[Pipeline] Layer 2 — Creating work plan');
    const workPlan = await this.orchestrator.createWorkPlan(context);

    emit({
      type: 'planning_started',
      tasks: workPlan.tasks.map(t => ({
        taskId: t.taskId,
        taskType: t.taskType,
        query: t.query,
      })),
    });

    // Layer 2.5 + 3A: Execute workers and collect results
    logger.info('[Pipeline] Layer 2.5 — Dispatching workers');
    const funnelResult = await this.funnel.collect(
      workPlan.tasks,
      emit,
    );

    // Layer 3B: Synthesize
    logger.info('[Pipeline] Layer 3 — Synthesizing results');
    emit({ type: 'synthesizing' });

    const result = await this.synthesizer.synthesize(
      context,
      funnelResult,
    );

    // Layer 4: Verify itinerary feasibility
    if (result.itineraryData) {
      logger.info('[Pipeline] Layer 4 — Verifying itinerary');
      const verification = verifyItinerary(result.itineraryData, {
        budget: context.budget ?? null,
        currency: context.currency ?? 'VND',
      });

      result.verification = verification;

      if (!verification.isValid) {
        logger.warn('[Pipeline] Itinerary has issues:', {
          score: verification.score,
          violationCount: verification.violations.length,
        });
      } else {
        logger.info('[Pipeline] Itinerary verified:', {
          score: verification.score,
        });
      }
    }

    return result;
  }

  /**
   * Run the complete flow: clarify → plan.
   * For multi-turn clarification, use clarify() separately.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {(event: Object) => void} [onProgress]
   * @returns {Promise<{type: 'clarification', question: string} | {type: 'plan', content: string, toolCalls: Array, usage: Object, draftId?: string}>}
   */
  async run(messages, onProgress) {
    // Step 1: Clarification
    const clarification = await this.clarify(messages);

    if (clarification.notTravelQuery) {
      return { type: 'not_travel', clarification };
    }

    if (!clarification.complete) {
      return {
        type: 'clarification',
        question: clarification.question,
        missing: clarification.missing,
        gathered: clarification.gathered,
      };
    }

    // Step 2-4: Full pipeline
    const result = await this.plan(clarification.context, onProgress);

    return { type: 'plan', ...result };
  }
}
