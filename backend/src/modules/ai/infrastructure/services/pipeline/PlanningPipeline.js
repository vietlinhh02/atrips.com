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
import { getDiverseRecommendations, mapTravelerTypesToInterests } from '../../../domain/algorithms/POIRecommender.js';
import { logger } from '../../../../../shared/services/LoggerService.js';

const SPENDING_TO_STYLE = {
  budget: 'budget',
  moderate: 'comfort',
  luxury: 'luxury',
};

/**
 * Extract all places from funnel results into a flat array.
 * Normalizes type to uppercase for POIRecommender compatibility.
 */
function flattenPlaces(funnelResult) {
  const allPlaces = [];
  for (const r of funnelResult.results) {
    if (r.status !== 'success' || !r.data?.places) continue;
    for (const p of r.data.places) {
      const normalizedType = (p.type || 'ATTRACTION').toUpperCase();
      allPlaces.push({
        ...p,
        type: normalizedType,
        _originalTaskType: r.taskType,
      });
    }
  }
  return allPlaces;
}

/**
 * Put diversity-selected places back into funnel result structure.
 * Preserves non-place data (webContext, weather, events, images).
 */
function rebuildFunnelResult(diversePlaces, originalResult) {
  const byTask = {};
  for (const p of diversePlaces) {
    const taskType = p._originalTaskType;
    if (!byTask[taskType]) byTask[taskType] = [];
    byTask[taskType].push(p);
  }
  return {
    ...originalResult,
    results: originalResult.results.map(r => {
      if (r.status !== 'success' || !r.data) return r;
      return {
        ...r,
        data: {
          ...r.data,
          places: byTask[r.taskType] || r.data.places,
        },
      };
    }),
  };
}

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

    // Layer 2.75: Diversity selection via POIRecommender
    logger.info('[Pipeline] Layer 2.75 — Diversity selection');
    stepStart = Date.now();
    const allPlaces = flattenPlaces(funnelResult);
    let diversifiedResult = funnelResult;

    if (allPlaces.length > 0) {
      const onboarding = this.executionContext.userProfile || {};
      const travelProfile = onboarding.travelProfile || {};
      const userProfile = {
        interests: mapTravelerTypesToInterests(
          travelProfile.travelerTypes || [],
          context.interests || [],
        ),
        travelStyle: SPENDING_TO_STYLE[travelProfile.spendingHabits]
          || context.travelStyle || 'comfort',
        dietaryRestrictions:
          onboarding.preferences?.dietaryRestrictions || [],
        prioritizeDiversity: true,
        prioritizeRating: true,
      };
      const TARGET_PLACES = 35;
      const diversePlaces = getDiverseRecommendations(
        allPlaces, userProfile, Math.min(TARGET_PLACES, allPlaces.length),
      );
      diversifiedResult = rebuildFunnelResult(diversePlaces, funnelResult);
      logger.info('[Pipeline] Layer 2.75 done', {
        durationMs: Date.now() - stepStart,
        inputPlaces: allPlaces.length,
        outputPlaces: diversePlaces.length,
      });
    } else {
      logger.warn('[Pipeline] Layer 2.75 skipped — no places to diversify');
    }

    // Layer 3B: Synthesize
    logger.info('[Pipeline] Layer 3 — Synthesizing results');
    emit({ type: 'synthesizing' });
    stepStart = Date.now();

    const result = await this.synthesizer.synthesize(
      context,
      diversifiedResult,
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
   * Streaming version of plan(). Yields events as they happen.
   * Use with `yield*` in AIService.chatStream().
   *
   * @param {import('./ClarificationAgent.js').ClarifiedContext} context
   * @param {Object} [opts]
   * @param {AbortSignal} [opts.signal]
   * @returns {AsyncGenerator<Object>}
   */
  async *planStream(context, opts = {}) {
    const { signal } = opts;
    const pipelineStart = Date.now();

    // Layer 2: Create work plan (batch, fast)
    logger.info('[Pipeline] Layer 2 — Creating work plan');
    const workPlan = await this.orchestrator.createWorkPlan(context);

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

    yield {
      type: 'planning_started',
      tasks: tasksWithContext.map(t => ({
        taskId: t.taskId,
        taskType: t.taskType,
        query: t.query,
      })),
    };

    if (signal?.aborted) return;

    // Layer 2.5: Workers — yield events as each completes
    logger.info(
      '[Pipeline] Layer 2.5 — Dispatching tool workers (streaming)',
    );
    let funnelResult = null;

    for await (
      const event of this.funnel.collectStream(
        tasksWithContext, { signal },
      )
    ) {
      if (event.type === '_funnel_done') {
        funnelResult = event.funnelResult;
      } else {
        yield event;
      }
    }

    if (!funnelResult || signal?.aborted) return;

    // Layer 2.75: Diversity selection (sync, fast)
    logger.info('[Pipeline] Layer 2.75 — Diversity selection');
    const allPlaces = flattenPlaces(funnelResult);
    let diversifiedResult = funnelResult;

    if (allPlaces.length > 0) {
      const onboarding = this.executionContext.userProfile || {};
      const travelProfile = onboarding.travelProfile || {};
      const userProfile = {
        interests: mapTravelerTypesToInterests(
          travelProfile.travelerTypes || [],
          context.interests || [],
        ),
        travelStyle: SPENDING_TO_STYLE[travelProfile.spendingHabits]
          || context.travelStyle || 'comfort',
        dietaryRestrictions:
          onboarding.preferences?.dietaryRestrictions || [],
        prioritizeDiversity: true,
        prioritizeRating: true,
      };
      const TARGET_PLACES = 35;
      const diversePlaces = getDiverseRecommendations(
        allPlaces,
        userProfile,
        Math.min(TARGET_PLACES, allPlaces.length),
      );
      diversifiedResult = rebuildFunnelResult(
        diversePlaces, funnelResult,
      );
    }

    if (signal?.aborted) return;

    // Layer 3: Synthesizer — split stream
    yield { type: 'synthesizing' };
    logger.info('[Pipeline] Layer 3 — Synthesizing (streaming)');

    let itineraryData = null;
    for await (
      const event of this.synthesizer.synthesizeStream(
        context, diversifiedResult, { signal },
      )
    ) {
      if (event.type === 'draft_created') {
        itineraryData = event.itineraryData;
      }
      yield event;
    }

    // Layer 4: Verify itinerary (sync, fast)
    if (itineraryData) {
      logger.info('[Pipeline] Layer 4 — Verifying itinerary');
      const verification = verifyItinerary(itineraryData, {
        budget: context.budget ?? null,
        currency: context.currency ?? 'VND',
      });
      if (!verification.isValid) {
        yield { type: 'verification', result: verification };
      }
    }

    logger.info('[Pipeline] Streaming pipeline complete', {
      durationMs: Date.now() - pipelineStart,
    });
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
