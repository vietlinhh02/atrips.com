/**
 * Planning Pipeline
 * Orchestrates the full 5-layer flow:
 *   Layer 1.5 (Clarification) → Layer 2 (Orchestrator) →
 *   Layer 2.5 (Workers) → Layer 3 (Funnel + Synthesizer)
 */

import { ClarificationAgent } from './ClarificationAgent.js';
import { OrchestratorAgent } from './OrchestratorAgent.js';
import { ToolWorker } from './ToolWorker.js';
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
    const { userId, conversationId, userProfile } = options;
    this.executionContext = { userId, conversationId, userProfile };

    this.clarifier = new ClarificationAgent();
    this.orchestrator = new OrchestratorAgent();
    this.toolWorker = new ToolWorker();
    this.funnel = new Funnel(this.toolWorker);
    this.synthesizer = new SynthesizerAgent(this.executionContext);
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
    const pipelineStart = Date.now();

    // Layer 2: Create work plan
    logger.info('[Pipeline] Layer 2 — Creating work plan');
    let stepStart = Date.now();
    const workPlan = await this.orchestrator.createWorkPlan(context);
    logger.info('[Pipeline] Layer 2 done', {
      durationMs: Date.now() - stepStart,
    });

    // Inject trip context into each task for ToolWorker
    const tasksWithContext = workPlan.tasks.map(t => ({
      ...t,
      context: {
        destination: context.destination,
        startDate: context.startDate,
        endDate: context.endDate,
        groupSize: context.groupSize,
        budget: context.budget,
        interests: context.interests,
        travelStyle: context.travelStyle,
      },
    }));

    emit({
      type: 'planning_started',
      tasks: tasksWithContext.map(t => ({
        taskId: t.taskId,
        taskType: t.taskType,
        query: t.query,
      })),
    });

    // Layer 2.5 + 3A: Execute tool workers and collect results
    logger.info('[Pipeline] Layer 2.5 — Dispatching tool workers');
    stepStart = Date.now();
    const funnelResult = await this.funnel.collect(
      tasksWithContext,
      emit,
    );
    logger.info('[Pipeline] Layer 2.5 done', {
      durationMs: Date.now() - stepStart,
    });

    // Layer 3B: Synthesize
    logger.info('[Pipeline] Layer 3 — Synthesizing results');
    emit({ type: 'synthesizing' });
    stepStart = Date.now();

    const result = await this.synthesizer.synthesize(
      context,
      funnelResult,
    );
    logger.info('[Pipeline] Layer 3 done', {
      durationMs: Date.now() - stepStart,
    });

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

    logger.info('[Pipeline] Total pipeline duration', {
      durationMs: Date.now() - pipelineStart,
    });

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
    const stepStart = Date.now();
    const clarification = await this.clarify(messages);
    logger.info('[Pipeline] Layer 1.5 (Clarification) done', {
      durationMs: Date.now() - stepStart,
      complete: clarification.complete,
    });

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
