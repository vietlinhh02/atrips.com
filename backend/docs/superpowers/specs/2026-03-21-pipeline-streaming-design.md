# Pipeline SSE Streaming Design

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Convert batch pipeline to real-time token streaming for all user-facing layers

## Problem

All LLM calls use `.invoke()` (wait for full response). The Synthesizer — the biggest bottleneck (15-60s) — sends nothing to the user until the entire itinerary is generated. Worker progress events are buffered in an array and replayed all at once. DirectAgent and TripManageAgent also block until full completion.

The frontend already handles incremental SSE events (`fetchEventSource`, `content` chunks, RAF buffering). The problem is 100% backend.

## Approach: Hybrid Streaming

Stream token-by-token for user-facing layers only. Internal layers (Clarification, Orchestrator) stay `.invoke()` because they're fast (1-3s) and output structured JSON.

**What streams:**
- Synthesizer Markdown output (token-by-token)
- DirectAgent responses (token-by-token via `streamEvents`)
- TripManageAgent responses (token-by-token via `streamEvents`)
- Worker progress events (real-time as each worker resolves)

**What stays batch:**
- ClarificationAgent (fast, JSON output)
- OrchestratorAgent (fast, JSON output)
- Synthesizer JSON block (buffered silently, parsed when complete to save draft)

## Design

### 1. Model Streaming

LangChain `ChatOpenAI` supports `.stream()` on any model instance — no `streaming: true` constructor flag needed. Calling `model.stream([messages])` automatically uses streaming regardless of how the model was created.

Therefore, **no new factory function needed**. Use existing `getSynthesisModel()` with `.stream()` for Synthesizer, and existing `getModel()` with `agent.streamEvents()` for DirectAgent/TripManageAgent.

Existing `getFastModel()`, `getSynthesisModel()`, `getModel()` unchanged.

### 2. PlanningPipeline Async Generator

Convert `plan(context, onProgress)` to `async *plan(context)`:

```
async *plan(context) {
  // Layer 2: Orchestrator (batch, fast)
  workPlan = await orchestrator.createWorkPlan(context)
  yield { type: 'planning_started', tasks: workPlan.tasks }

  // Layer 2.5: Workers — yield events as each completes
  for await (event of funnel.executeStream(workPlan, context)) {
    yield event   // worker_started, worker_completed real-time
  }

  // Layer 2.75: POI diversity (sync, fast)
  diverseResult = applyDiversity(funnelResult)

  // Layer 3: Synthesizer — split stream
  yield { type: 'synthesizing' }
  let itineraryData = null;
  for await (event of synthesizer.synthesizeStream(context, diverseResult)) {
    if (event.type === 'draft_created') itineraryData = event.itineraryData;
    yield event   // content tokens + draft_created
  }

  // Layer 4: Itinerary Verification (sync, fast)
  if (itineraryData) {
    const verification = ItineraryVerifier.verifyItinerary(itineraryData, context);
    if (verification.violations?.length > 0) {
      yield { type: 'verification', result: verification }
    }
  }
}
```

The `onProgress` callback parameter is removed. Events flow through the generator chain.

### 3. Funnel Streaming

Add `async *executeStream()` alongside existing `collect()` method. Uses async queue pattern to yield events as each worker resolves:

```js
async *executeStream(workPlan, context) {
  const queue = [];       // resolved events waiting to be yielded
  let pending = 0;        // workers still running
  let resolve;            // wake up the consumer
  let waiting = new Promise(r => { resolve = r; });

  for (const task of workPlan.tasks) {
    pending++;
    yield { type: 'worker_started', taskId: task.taskId, taskType: task.taskType };

    worker.executeTask({ ...task, context }).then(result => {
      queue.push({
        type: result.status === 'success' ? 'worker_completed' : 'worker_failed',
        taskId: task.taskId, taskType: task.taskType, data: result.data,
      });
      pending--;
      resolve();  // wake consumer
    });
  }

  // Consume results as they arrive
  while (pending > 0 || queue.length > 0) {
    if (queue.length === 0) {
      await waiting;
      waiting = new Promise(r => { resolve = r; });
    }
    while (queue.length > 0) yield queue.shift();
  }
}
```

Existing `collect()` kept for non-streaming `plan()` if needed. `executeStream()` yields `worker_started` immediately on dispatch, then `worker_completed`/`worker_failed` as each promise resolves — no `Promise.allSettled()` wait.

### 4. Synthesizer Split-Stream

The Synthesizer output has two parts: JSON itinerary + Markdown overview.

**Strategy:** Buffer JSON silently, stream Markdown token-by-token.

```
LLM stream starts
    │
    ├─ Tokens inside ```json...``` block → BUFFER (accumulate JSON string)
    │
    ├─ JSON block ends (```) → parse JSON, call create_trip_plan, yield draft_created
    │
    └─ Tokens outside JSON block (Markdown) → YIELD as content events immediately
```

Implementation: `async *synthesizeStream(context, funnelResult)`:
- Uses `getSynthesisModel()` with `model.stream()` instead of `model.invoke()`
- State machine tracks `inJsonBlock` flag
- JSON buffer parsed on block close, draft saved, `draft_created` event yielded
- Markdown tokens yielded immediately as `{ type: 'content', content: token }`

**State machine transitions** (handles token boundary splitting):
- `MARKDOWN` — yield tokens as content. If token contains `` ` `` accumulating toward ```` ```json ````, transition to `FENCE_DETECT`
- `FENCE_DETECT` — buffer chars, check if they form ```` ```json ````. If yes → `IN_JSON`. If no → flush buffer as content, back to `MARKDOWN`
- `IN_JSON` — buffer tokens. If token contains `` ` `` accumulating toward ```` ``` ````, transition to `FENCE_END_DETECT`
- `FENCE_END_DETECT` — check if closing fence. If yes → parse JSON, save draft, yield `draft_created`, back to `MARKDOWN`. If no → continue `IN_JSON`

**Edge cases:**
- JSON parse failure: fall back to regex extraction from accumulated full content
- LLM outputs Markdown before JSON: both orders handled by state machine
- Empty tokens: filtered out (no empty content events)
- Token splits across fence marker: handled by `FENCE_DETECT` / `FENCE_END_DETECT` states with small lookahead buffer

### 5. DirectAgent Streaming

Add `streamDirectAgent()` alongside existing `runDirectAgent()`:

```js
export async function* streamDirectAgent(messages, options) {
  const model = getSynthesisModel();  // .stream() works on any ChatOpenAI instance
  const agent = createReactAgent({ llm: model, tools, stateModifier: systemPrompt });
  // LangGraph agents expect { messages } input, not raw array
  const stream = await agent.streamEvents({ messages }, { version: 'v2' });

  for await (const event of stream) {
    if (event.event === 'on_chat_model_stream') {
      const token = event.data?.chunk?.content || '';
      if (token) yield { type: 'content', content: token };
    }
    if (event.event === 'on_tool_start') {
      yield { type: 'tool_call_start', name: event.name };
    }
    if (event.event === 'on_tool_end') {
      yield { type: 'tool_result', name: event.name, result: event.data?.output };
    }
  }
}
```

`runDirectAgent()` kept for non-streaming `chat()` path — no breaking change.

### 6. TripManageAgent Streaming

Same pattern as DirectAgent: add `streamTripManageAgent()` using `agent.streamEvents()`.

### 7. AIService.chatStream() Simplification

Convert from buffer-replay to pipe-through:

```js
async *chatStream(messages, options) {
  // ... guard, intent classification ...

  if (intent === 'complex') {
    const pipeline = new PlanningPipeline({ ... });
    const clarification = await pipeline.clarify(userMessages);

    if (!clarification.complete) {
      yield { type: 'content', content: clarification.question };
      yield { type: 'finish', reason: 'clarification' };
      return;
    }

    yield* pipeline.plan(clarification.context);

  } else if (intent === 'trip_manage') {
    yield* streamTripManageAgent(lcMessages, { ... });

  } else {
    yield* streamDirectAgent(lcMessages, { ... });
  }

  yield { type: 'finish', reason: 'stop' };
}
```

Key change: `yield*` pipes directly from generators — no buffering, no replaying.

### 8. Client Disconnect / Abort Handling

Streams can run 15-60+ seconds. If the client disconnects mid-stream, the generator chain must stop to avoid wasted LLM tokens and `ERR_STREAM_WRITE_AFTER_END` errors.

**Implementation:**

1. In `aiController.js` SSE handler, create an `AbortController` and listen for `req.on('close')`:
```js
const abortController = new AbortController();
req.on('close', () => abortController.abort());
```

2. Pass `abortController.signal` through to `chatStream()` via options.

3. In `chatStream()`, pass `signal` to each generator:
```js
yield* pipeline.plan(clarification.context, { signal });
yield* streamDirectAgent(lcMessages, { ...opts, signal });
```

4. Each generator checks `signal.aborted` before expensive operations and passes `signal` to LLM calls:
```js
// In synthesizeStream:
const stream = await model.stream([...messages], { signal });

// In streamDirectAgent:
const stream = await agent.streamEvents({ messages }, { version: 'v2', signal });
```

5. When `signal.aborted`, generators return early (no more yields).

### 9. Usage Tracking

`.stream()` provides `usage_metadata` on the final chunk only (if supported by the provider). Strategy:

- Accumulate `usage_metadata` from the final chunk when available
- If absent (provider doesn't support it), estimate using character count: `Math.ceil(totalChars / 4)` (already used in `aiController.js:174`)
- Yield `{ type: 'usage', usage: { inputTokens, outputTokens } }` after stream completes
- `aiController.js` collects this event for conversation history storage

## Files Changed

| File | Change |
|------|--------|
| `infrastructure/services/pipeline/PlanningPipeline.js` | `plan()` → `async *plan()` generator, add Layer 4 verification |
| `infrastructure/services/pipeline/Funnel.js` | Add `async *executeStream()` alongside existing `collect()` |
| `infrastructure/services/pipeline/SynthesizerAgent.js` | Add `async *synthesizeStream()` with JSON buffer + Markdown stream |
| `infrastructure/services/agents/directAgent.js` | Add `streamDirectAgent()` |
| `infrastructure/services/agents/tripManageAgent.js` | Add `streamTripManageAgent()` |
| `infrastructure/services/AIService.js` | Simplify `chatStream()` to pipe-through, pass abort signal |
| `interfaces/http/aiController.js` | Add `AbortController` + `req.on('close')` for disconnect handling |

## Files NOT Changed

- Frontend — already handles incremental SSE events
- `aiController.js` — listed in Files Changed for abort signal only; SSE event loop unchanged
- `ClarificationAgent.js` — fast batch, JSON output
- `OrchestratorAgent.js` — fast batch, JSON output
- Non-streaming `chat()` path — keeps `.invoke()` for API consumers

## Non-Goals

- Token streaming for Clarification/Orchestrator (fast enough, JSON output)
- Frontend changes (already SSE-ready)
- SSE endpoint restructuring (already compatible)
- Streaming for the non-streaming `chat()` method

## Risks

- **LangChain `streamEvents` API stability**: v2 API used — verify compatibility with current `@langchain/langgraph` version
- **JSON parse failure in split-stream**: Mitigated by fallback regex extraction from accumulated content
- **Token boundary splitting**: ````json` marker could be split across tokens — state machine must handle partial markers
- **Proxy compatibility**: `OAI_BASE_URL` proxy must support streaming responses — verify with current llm-mux setup
- **Usage tracking**: `.stream()` may not provide `usage_metadata` per-chunk — accumulate from final chunk or estimate
