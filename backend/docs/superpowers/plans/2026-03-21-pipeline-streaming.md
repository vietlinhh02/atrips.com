# Pipeline SSE Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the batch AI pipeline to real-time token streaming so users see text appearing immediately instead of waiting 15-60s for full responses.

**Architecture:** Hybrid streaming — token-by-token for user-facing layers (Synthesizer, DirectAgent, TripManageAgent) via LangChain `.stream()` / `streamEvents()`. Internal layers (Clarification, Orchestrator) stay batch. Pipeline converted from callback pattern to async generator chain with `yield*` pipe-through. Client disconnect handled via AbortController signal propagation.

**Tech Stack:** LangChain `@langchain/openai` ChatOpenAI `.stream()`, `@langchain/langgraph` `streamEvents` v2, Node.js async generators, SSE

**Spec:** `docs/superpowers/specs/2026-03-21-pipeline-streaming-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `infrastructure/services/pipeline/Funnel.js` | Add `async *collectStream()` — yield worker events as each resolves |
| `infrastructure/services/pipeline/SynthesizerAgent.js` | Add `async *synthesizeStream()` — buffer JSON, stream Markdown |
| `infrastructure/services/pipeline/PlanningPipeline.js` | Convert `plan()` → `async *plan()` generator |
| `infrastructure/services/agents/directAgent.js` | Add `streamDirectAgent()` generator |
| `infrastructure/services/agents/tripManageAgent.js` | Add `streamTripManageAgent()` generator |
| `infrastructure/services/AIService.js` | Simplify `chatStream()` to pipe-through with abort signal |
| `interfaces/http/aiController.js` | Add AbortController + `req.on('close')` |

---

### Task 1: Funnel — Async Generator for Worker Events

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/Funnel.js`

- [ ] **Step 1: Add `collectStream()` async generator method to Funnel class**

Add this method after the existing `collect()` method (after line 93). Keep `collect()` intact — `collectStream()` is the streaming alternative.

```js
  /**
   * Stream worker events as each resolves (no Promise.allSettled wait).
   * Yields: worker_started, worker_completed, worker_failed events.
   * Returns accumulated FunnelResult via the final yield.
   *
   * @param {import('./OrchestratorAgent.js').WorkerTask[]} tasks
   * @param {Object} [opts]
   * @param {AbortSignal} [opts.signal]
   * @returns {AsyncGenerator<Object>}
   */
  async *collectStream(tasks, opts = {}) {
    const { signal } = opts;
    const results = [];
    const queue = [];
    let pending = tasks.length;
    let wakeUp;
    let waiting = new Promise(r => { wakeUp = r; });

    // Dispatch all workers in parallel, push results to queue
    for (const task of tasks) {
      if (signal?.aborted) return;

      yield {
        type: 'worker_started',
        taskId: task.taskId,
        taskType: task.taskType,
      };

      this.worker.executeTask(task).then(result => {
        const enriched = { ...result, taskType: task.taskType };
        results.push(enriched);

        if (enriched.status === 'success') {
          queue.push({
            type: 'worker_completed',
            taskId: task.taskId,
            taskType: task.taskType,
            preview: summarizeResult(enriched.data),
          });
        } else {
          queue.push({
            type: 'worker_failed',
            taskId: task.taskId,
            taskType: task.taskType,
            error: enriched.error,
          });
        }
        pending--;
        wakeUp();
      }).catch(err => {
        results.push({
          taskId: task.taskId,
          taskType: task.taskType,
          status: 'error',
          data: null,
          error: err.message,
        });
        queue.push({
          type: 'worker_failed',
          taskId: task.taskId,
          taskType: task.taskType,
          error: err.message,
        });
        pending--;
        wakeUp();
      });
    }

    // Consume results as they arrive (drain queue first, then await)
    while (pending > 0 || queue.length > 0) {
      if (signal?.aborted) return;
      // Drain any already-resolved results
      while (queue.length > 0) {
        yield queue.shift();
      }
      // Only await if workers still running and queue is empty
      if (pending > 0) {
        await waiting;
        waiting = new Promise(r => { wakeUp = r; });
      }
    }

    // Yield final aggregated result for downstream consumers
    const summary = {
      total: results.length,
      succeeded: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
    };

    logger.info('[Funnel] Stream collection complete:', summary);

    yield {
      type: '_funnel_done',
      funnelResult: { results, summary },
    };
  }
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/Funnel.js').then(m => console.log('OK, has collectStream:', typeof m.Funnel.prototype.collectStream))"`
Expected: `OK, has collectStream: function`

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/Funnel.js
git commit -m "feat(stream): add Funnel.collectStream() async generator for real-time worker events"
```

---

### Task 2: SynthesizerAgent — Split-Stream (Buffer JSON, Stream Markdown)

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js`

- [ ] **Step 1: Add `synthesizeStream()` async generator method**

Add this method to the `SynthesizerAgent` class after the existing `synthesize()` method (after line 151). Keep `synthesize()` intact.

```js
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

        const token = typeof chunk.content === 'string' ? chunk.content : '';
        if (!token) {
          // Capture usage from final chunk
          if (chunk.usage_metadata) {
            usage.inputTokens = chunk.usage_metadata.input_tokens || 0;
            usage.outputTokens = chunk.usage_metadata.output_tokens || 0;
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
            itineraryData = this._parseItinerary(jsonBuffer, fullContent);
            if (itineraryData) {
              draftId = await this._saveDraft(itineraryData, context);
              yield { type: 'draft_created', draftId, itineraryData };
            }
            // Stream any remaining text after the fence
            const after = combined.substring(closeIdx + 3);
            if (after.trim()) {
              yield { type: 'content', content: after };
            }
          } else if (combined.endsWith('`') || combined.endsWith('``')) {
            // Possible partial fence — buffer it
            const safeEnd = combined.length - (combined.endsWith('``') ? 2 : 1);
            jsonBuffer += combined.substring(0, safeEnd);
            fenceBuffer = combined.substring(safeEnd);
          } else {
            jsonBuffer += combined;
          }
          continue;
        }

        // Combine with any buffered partial fence from previous token
        const combined = fenceBuffer + token;
        fenceBuffer = '';

        // Check for opening fence (handles split across tokens)
        const openIdx = combined.indexOf('```json');
        if (openIdx !== -1) {
          // Stream any text before the fence
          const before = combined.substring(0, openIdx);
          if (before.trim()) {
            yield { type: 'content', content: before };
          }
          inJsonBlock = true;
          jsonBuffer = '';
          // Capture any content after ```json\n
          const afterFence = combined.substring(openIdx + 7).replace(/^\n/, '');
          if (afterFence) jsonBuffer = afterFence;
          continue;
        }

        // Check for partial opening fence at end of combined
        if (combined.endsWith('`') || combined.endsWith('``') || combined.endsWith('```')) {
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

      // Fallback: if JSON wasn't extracted during streaming, try from full content
      if (!itineraryData) {
        itineraryData = extractItineraryJSON(fullContent);
        if (itineraryData) {
          draftId = await this._saveDraft(itineraryData, context);
          yield { type: 'draft_created', draftId, itineraryData };
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
      logger.error('[SynthesizerAgent] Stream failed:', { error: error.message });
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
      const { userId, conversationId, userProfile } = this.executionContext;
      toolExecutor.setUserContext(userId);
      toolExecutor.setConversationContext(conversationId);
      toolExecutor.setUserProfile(userProfile);

      const result = await toolExecutor.execute('create_trip_plan', {
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

      if (result.success && result.data?.draftId) {
        return result.data.draftId;
      }
    } catch (err) {
      logger.error('[SynthesizerAgent] Draft save failed:', { error: err.message });
    }
    return null;
  }
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js').then(m => console.log('OK, has synthesizeStream:', typeof m.SynthesizerAgent.prototype.synthesizeStream))"`
Expected: `OK, has synthesizeStream: function`

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js
git commit -m "feat(stream): add SynthesizerAgent.synthesizeStream() with JSON buffer + Markdown streaming"
```

---

### Task 3: PlanningPipeline — Async Generator

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js`

- [ ] **Step 1: Add `async *planStream()` method**

Add after the existing `plan()` method (after line 219). Keep `plan()` intact for the non-streaming `chat()` path.

```js
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
    logger.info('[Pipeline] Layer 2.5 — Dispatching tool workers (streaming)');
    let funnelResult = null;

    for await (const event of this.funnel.collectStream(tasksWithContext, { signal })) {
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
      const userProfile = {
        interests: context.interests || [],
        travelStyle: context.travelStyle || 'comfort',
        prioritizeDiversity: true,
        prioritizeRating: true,
      };
      const TARGET_PLACES = 25;
      const diversePlaces = getDiverseRecommendations(
        allPlaces, userProfile, Math.min(TARGET_PLACES, allPlaces.length),
      );
      diversifiedResult = rebuildFunnelResult(diversePlaces, funnelResult);
    }

    if (signal?.aborted) return;

    // Layer 3: Synthesizer — split stream
    yield { type: 'synthesizing' };
    logger.info('[Pipeline] Layer 3 — Synthesizing (streaming)');

    let itineraryData = null;
    for await (const event of this.synthesizer.synthesizeStream(context, diversifiedResult, { signal })) {
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
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js').then(m => console.log('OK, has planStream:', typeof m.PlanningPipeline.prototype.planStream))"`
Expected: `OK, has planStream: function`

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js
git commit -m "feat(stream): add PlanningPipeline.planStream() async generator"
```

---

### Task 4: DirectAgent + TripManageAgent Streaming

**Files:**
- Modify: `src/modules/ai/infrastructure/services/agents/directAgent.js`
- Modify: `src/modules/ai/infrastructure/services/agents/tripManageAgent.js`

- [ ] **Step 1: Add `streamDirectAgent()` to directAgent.js**

Add after the existing `runDirectAgent()` function (after line 81):

```js
/**
 * Streaming version of runDirectAgent. Yields token-by-token events.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @returns {AsyncGenerator<{type: string, content?: string, name?: string, result?: any}>}
 */
export async function* streamDirectAgent(messages, options = {}) {
  const {
    context = {}, userId, conversationId, userProfile, signal,
  } = options;

  const model = getSynthesisModel();
  const tools = buildLangChainTools(
    { taskType: 'research' },
    { userId, conversationId, userProfile },
  );

  const systemPrompt = buildSystemPrompt({
    ...context,
    userProfile,
  });

  const agent = createReactAgent({
    llm: model,
    tools,
    stateModifier: systemPrompt,
  });

  try {
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2', signal },
    );

    let usage = { inputTokens: 0, outputTokens: 0 };

    for await (const event of eventStream) {
      if (signal?.aborted) return;

      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        const token = chunk?.content;
        if (typeof token === 'string' && token) {
          yield { type: 'content', content: token };
        }
        if (chunk?.usage_metadata) {
          usage.inputTokens += chunk.usage_metadata.input_tokens || 0;
          usage.outputTokens += chunk.usage_metadata.output_tokens || 0;
        }
      } else if (event.event === 'on_tool_start') {
        yield { type: 'tool_call_start', name: event.name };
      } else if (event.event === 'on_tool_end') {
        yield {
          type: 'tool_result',
          name: event.name,
          result: safeParseJSON(event.data?.output),
        };
      }
    }

    yield { type: 'usage', usage };
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.info('[DirectAgent] Stream aborted by client');
      return;
    }
    logger.error('[DirectAgent] Stream failed:', { error: error.message });
    throw error;
  }
}
```

- [ ] **Step 2: Add `streamTripManageAgent()` to tripManageAgent.js**

Add after the existing `runTripManageAgent()` function (after line 68):

```js
/**
 * Streaming version of runTripManageAgent. Yields token-by-token events.
 *
 * @param {Array<import('@langchain/core/messages').BaseMessage>} messages
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @returns {AsyncGenerator<{type: string, content?: string, name?: string, result?: any}>}
 */
export async function* streamTripManageAgent(messages, options = {}) {
  const {
    modelId, userId, conversationId, userProfile, signal,
  } = options;

  const model = getModel(modelId);
  const tools = buildLangChainTools(
    { taskType: 'trip_manage' },
    { userId, conversationId, userProfile },
  );

  const agent = createReactAgent({
    llm: model,
    tools,
    stateModifier: TRIP_MANAGE_SYSTEM_PROMPT,
  });

  try {
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2', signal },
    );

    let usage = { inputTokens: 0, outputTokens: 0 };

    for await (const event of eventStream) {
      if (signal?.aborted) return;

      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        const token = chunk?.content;
        if (typeof token === 'string' && token) {
          yield { type: 'content', content: token };
        }
        if (chunk?.usage_metadata) {
          usage.inputTokens += chunk.usage_metadata.input_tokens || 0;
          usage.outputTokens += chunk.usage_metadata.output_tokens || 0;
        }
      } else if (event.event === 'on_tool_start') {
        yield { type: 'tool_call_start', name: event.name };
      } else if (event.event === 'on_tool_end') {
        yield {
          type: 'tool_result',
          name: event.name,
          result: safeParseJSON(event.data?.output),
        };
      }
    }

    yield { type: 'usage', usage };
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.info('[TripManageAgent] Stream aborted by client');
      return;
    }
    logger.error('[TripManageAgent] Stream failed:', { error: error.message });
    throw error;
  }
}
```

- [ ] **Step 3: Verify both modules load**

Run:
```bash
node -e "
Promise.all([
  import('./src/modules/ai/infrastructure/services/agents/directAgent.js'),
  import('./src/modules/ai/infrastructure/services/agents/tripManageAgent.js'),
]).then(([d, t]) => {
  console.log('directAgent has stream:', typeof d.streamDirectAgent);
  console.log('tripManage has stream:', typeof t.streamTripManageAgent);
});
"
```
Expected: both `function`

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/infrastructure/services/agents/directAgent.js src/modules/ai/infrastructure/services/agents/tripManageAgent.js
git commit -m "feat(stream): add streaming generators for DirectAgent and TripManageAgent"
```

---

### Task 5: AIService.chatStream() — Pipe-Through + Abort Signal

**Files:**
- Modify: `src/modules/ai/infrastructure/services/AIService.js`

- [ ] **Step 1: Add imports for streaming agent functions**

After existing import of `runTripManageAgent` (line 15), add:

```js
import { streamDirectAgent } from './agents/directAgent.js';
import { streamTripManageAgent } from './agents/tripManageAgent.js';
```

- [ ] **Step 2: Replace `chatStream()` method body**

Replace the entire `chatStream()` method (lines 227-325) with the streaming pipe-through version. The method signature changes to accept `signal` in options:

```js
  /**
   * Chat with AI (streaming).
   * Yields SSE events via async generator pipe-through.
   *
   * @param {Array} messages
   * @param {Object} options
   * @param {AbortSignal} [options.signal]
   */
  async *chatStream(messages, options = {}) {
    const {
      model = this.model,
      context = {},
      enableTools = this.toolsEnabled,
      userId = null,
      conversationId = null,
      signal,
    } = options;

    const userMessages = messages.filter(m => m.role !== 'system');
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    const intent = classifyIntent(lastMessage);
    const userProfile = context.userProfile || null;

    logger.info('[AIService Stream] Intent:', { intent });

    // PromptGuard
    const guardResult = await guardMessage(lastMessage, {
      conversationId, userId,
    });
    if (guardResult.action !== 'pass') {
      yield { type: 'content', content: guardResult.content };
      yield { type: 'finish', reason: 'guarded' };
      return;
    }

    const compressedMessages = compressMessages(userMessages);
    const lcMessages = toLangChainMessages(compressedMessages);

    try {
      if (intent === 'complex') {
        const pipeline = new PlanningPipeline({
          modelId: model, userId, conversationId, userProfile,
        });

        const clarification = await pipeline.clarify(userMessages);

        if (clarification.notTravelQuery) {
          yield* streamDirectAgent(lcMessages, {
            context, userId, conversationId, userProfile, signal,
          });
          yield { type: 'finish', reason: 'stop' };
          return;
        }

        if (!clarification.complete) {
          yield {
            type: 'clarification',
            question: clarification.question,
            missing: clarification.missing,
            gathered: clarification.gathered,
          };
          yield { type: 'content', content: clarification.question };
          yield { type: 'finish', reason: 'clarification' };
          return;
        }

        // Stream the full planning pipeline
        yield* pipeline.planStream(clarification.context, { signal });
        yield { type: 'finish', reason: 'stop' };

      } else if (intent === 'trip_manage') {
        yield* streamTripManageAgent(lcMessages, {
          modelId: model, userId, conversationId, userProfile, signal,
        });
        yield { type: 'finish', reason: 'stop' };

      } else {
        yield* streamDirectAgent(lcMessages, {
          context, userId, conversationId, userProfile, signal,
        });
        yield { type: 'finish', reason: 'stop' };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.info('[AIService Stream] Aborted by client');
        return;
      }
      logger.error('[AIService Stream] Error:', { error: error.message });
      yield { type: 'error', error: error.message };
    }
  }
```

- [ ] **Step 3: Remove `_streamDirectAgent()` helper method**

Delete the `_streamDirectAgent()` method (around lines 330-357 in the original file) — it is replaced by the imported `streamDirectAgent()` generator.

- [ ] **Step 4: Verify module loads**

Run: `node -e "import('./src/modules/ai/infrastructure/services/AIService.js').then(() => console.log('OK')).catch(e => console.error('FAIL:', e.message))"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/infrastructure/services/AIService.js
git commit -m "feat(stream): simplify chatStream() to pipe-through with abort signal"
```

---

### Task 6: aiController.js — Abort Signal on Client Disconnect

**Files:**
- Modify: `src/modules/ai/interfaces/http/aiController.js`

- [ ] **Step 1: Add AbortController BEFORE sendEvent, and update sendEvent**

In the `chatStream` handler (starts at line 226), AFTER `res.flushHeaders()` (line 248) and BEFORE the existing `sendEvent` definition (line 250), insert the AbortController:

```js
    // Abort signal for client disconnect
    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
      logger.info('[ChatStream] Client disconnected, aborting pipeline');
    });
```

Then replace the existing `sendEvent` (line 250-252) with an abort-guarded version:

```js
    const sendEvent = (data) => {
      if (!abortController.signal.aborted) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };
```

Then modify the `aiService.chatStream()` call (line 281) to pass the signal:

```js
    const stream = aiService.chatStream(messages, {
      context: enrichedContext,
      enableTools: enableTools !== 'false',
      userId,
      conversationId: activeConversationId,
      signal: abortController.signal,
    });
```

- [ ] **Step 2: Add missing switch cases for `verification` and `error` events**

In the switch statement (line 289), add these cases before the existing `case 'finish'` (line 382):

```js
        case 'verification':
          sendEvent({ type: 'verification', result: chunk.result });
          break;
```

The `error` case is already partially handled by the catch block at line 440, but add an explicit case for generator-yielded errors:

```js
        case 'error':
          sendEvent({ type: 'error', error: chunk.error });
          break;
```

- [ ] **Step 3: Verify the controller file still has valid syntax**

Run: `node -e "import('./src/modules/ai/interfaces/http/aiController.js').then(() => console.log('OK'))"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/interfaces/http/aiController.js
git commit -m "feat(stream): add AbortController for client disconnect handling in SSE endpoint"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Verify all modules load without errors**

Run:
```bash
node -e "
Promise.all([
  import('./src/modules/ai/infrastructure/services/pipeline/Funnel.js'),
  import('./src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js'),
  import('./src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js'),
  import('./src/modules/ai/infrastructure/services/agents/directAgent.js'),
  import('./src/modules/ai/infrastructure/services/agents/tripManageAgent.js'),
  import('./src/modules/ai/infrastructure/services/AIService.js'),
  import('./src/modules/ai/interfaces/http/aiController.js'),
]).then(([funnel, synth, pipeline, direct, trip, ai, ctrl]) => {
  console.log('Funnel.collectStream:', typeof funnel.Funnel.prototype.collectStream);
  console.log('Synthesizer.synthesizeStream:', typeof synth.SynthesizerAgent.prototype.synthesizeStream);
  console.log('Pipeline.planStream:', typeof pipeline.PlanningPipeline.prototype.planStream);
  console.log('streamDirectAgent:', typeof direct.streamDirectAgent);
  console.log('streamTripManageAgent:', typeof trip.streamTripManageAgent);
  console.log('All imports OK');
}).catch(e => console.error('FAIL:', e.message));
"
```
Expected: All function types printed, `All imports OK`

- [ ] **Step 2: Verify batch paths still work (non-streaming `chat()` untouched)**

Run:
```bash
node -e "
import('./src/modules/ai/infrastructure/services/agents/directAgent.js').then(m => {
  console.log('runDirectAgent still exists:', typeof m.runDirectAgent);
});
import('./src/modules/ai/infrastructure/services/agents/tripManageAgent.js').then(m => {
  console.log('runTripManageAgent still exists:', typeof m.runTripManageAgent);
});
import('./src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js').then(m => {
  console.log('plan() still exists:', typeof m.PlanningPipeline.prototype.plan);
});
import('./src/modules/ai/infrastructure/services/pipeline/Funnel.js').then(m => {
  console.log('collect() still exists:', typeof m.Funnel.prototype.collect);
});
"
```
Expected: All `function` — batch path preserved

- [ ] **Step 3: Final commit if any fixes needed**

Only if smoke tests revealed issues:
```bash
git add -A && git commit -m "fix: address smoke test issues in pipeline streaming"
```
