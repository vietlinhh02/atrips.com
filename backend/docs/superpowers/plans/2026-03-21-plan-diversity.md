# Plan Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix repetitive travel plans by widening the data pool, adding diversity mechanisms, and bypassing cache for planning.

**Architecture:** 8 changes across 8 files. Fix data sources first (Mapbox session_token, ToolWorker queries), then add diversity (POIRecommender, prompt, temperature), then cache bypass. Each task is independently deployable.

**Tech Stack:** Node.js ESM, LangChain ChatOpenAI, Serper API, Mapbox Search Box v1, POIRecommender (existing)

**Spec:** `docs/superpowers/specs/2026-03-21-plan-diversity-design.md`

---

### Task 1: Fix Mapbox Search Box — add session_token

**Files:**
- Modify: `src/modules/ai/infrastructure/services/handlers/searchHandlers.js:713-778`

This is the highest-value quickfix. Mapbox Search Box v1 requires a `session_token` param. Without it, every call returns 400 and the entire Mapbox data source is disabled.

- [ ] **Step 1: Add randomUUID import**

At the top of `searchHandlers.js`, add `randomUUID` to the existing `node:crypto` import. If none exists, add:

```js
import { randomUUID } from 'node:crypto';
```

Check existing imports first — `searchHandlers.js` may already import from `node:crypto`.

- [ ] **Step 2: Add session_token to searchViaMapboxSearchBox**

In `searchViaMapboxSearchBox()` (line ~717), add `session_token` to the URLSearchParams:

```js
// BEFORE (line 717-723):
const params = new URLSearchParams({
  q: searchQuery,
  access_token: token,
  limit: String(limit),
  language: 'vi',
  types: 'poi',
});

// AFTER:
const params = new URLSearchParams({
  q: searchQuery,
  access_token: token,
  limit: String(limit),
  language: 'vi',
  types: 'poi',
  session_token: randomUUID(),
});
```

- [ ] **Step 3: Remove Geocoding v5 fallback from searchPlaces**

In the `searchPlaces()` function (line ~545-568), remove the inner `searchViaMapboxGeocoding` fallback call. The Search Box v1 with session_token is sufficient.

```js
// BEFORE (line 546-567):
if (this.mapboxToken) {
  try {
    const searchTerm = query || getDefaultSearchTerm(type);
    const searchQuery = `${searchTerm} ${location}`;
    let rawPlaces = await searchViaMapboxSearchBox(
      searchQuery, this.mapboxToken, effectiveLimit, args, type,
    );
    if (rawPlaces.length === 0) {
      rawPlaces = await searchViaMapboxGeocoding(       // ← REMOVE this fallback
        searchQuery, this.mapboxToken, effectiveLimit, args, type,
      );
    }
    // ...
  }
}

// AFTER:
if (this.mapboxToken) {
  try {
    const searchTerm = query || getDefaultSearchTerm(type);
    const searchQuery = `${searchTerm} ${location}`;
    const rawPlaces = await searchViaMapboxSearchBox(
      searchQuery, this.mapboxToken, effectiveLimit, args, type,
    );
    if (rawPlaces.length > 0) {
      const places = await Promise.all(rawPlaces.map(p => addImagesToPlace(p, location)));
      const result = { success: true, source: 'mapbox', places, query: searchQuery };
      await cacheService.set(cacheKey, result, TOOL_CACHE_TTL.PLACES);
      savePlacesToDB(rawPlaces, location);
      return result;
    }
  } catch (error) {
    logger.warn('[searchPlaces] Mapbox failed', { error: error.message });
  }
}
```

Do NOT delete the `searchViaMapboxGeocoding` function itself — it may be used elsewhere. Only remove its call inside `searchPlaces()`.

- [ ] **Step 4: Verify Mapbox returns data**

Run a quick smoke test from the project root:

```bash
node -e "
import serv from './src/modules/ai/infrastructure/services/handlers/searchHandlers.js';
// If searchHandlers exports createSearchHandlers, test via ToolExecutor instead:
import toolExecutor from './src/modules/ai/infrastructure/services/ToolExecutor.js';
const r = await toolExecutor.execute('search_places', { query: 'cafe', location: 'Da Lat' });
console.log('Source:', r.data?.source, 'Places:', r.data?.places?.length);
console.log('First place:', r.data?.places?.[0]?.name);
"
```

Expected: `Source: serper` or `Source: mapbox`, `Places: > 0`.

If Serper is available, it will be used first. To specifically test Mapbox, temporarily disable Serper or test when Serper returns empty.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/infrastructure/services/handlers/searchHandlers.js
git commit -m "fix: add session_token to Mapbox Search Box, remove broken v5 fallback"
```

---

### Task 2: Add skipCache to SerperService

**Files:**
- Modify: `src/modules/ai/infrastructure/services/SerperService.js:33-166,246-283`

Add `skipCache` option to all three cached methods: `search()`, `searchPlaces()`, `searchImages()`. Still writes to cache after fetch (warms cache for standalone calls).

- [ ] **Step 1: Add skipCache to search() method**

```js
// BEFORE (line 33-49):
async search(options) {
  const {
    query,
    limit = 10,
    gl = 'vn',
    hl = 'vi',
  } = options;

  if (!this.apiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const cacheKey = `serper:web:${query}:${gl}:${hl}:${limit}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

// AFTER:
async search(options) {
  const {
    query,
    limit = 10,
    gl = 'vn',
    hl = 'vi',
    skipCache = false,
  } = options;

  if (!this.apiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const cacheKey = `serper:web:${query}:${gl}:${hl}:${limit}`;
  if (!skipCache) {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
  }
```

- [ ] **Step 2: Add skipCache to searchPlaces() method**

```js
// BEFORE (line 98-113):
async searchPlaces(options) {
  const {
    query,
    gl = 'vn',
    hl = 'vi',
  } = options;

  if (!this.apiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const cacheKey = `serper:places:${query}:${gl}:${hl}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

// AFTER:
async searchPlaces(options) {
  const {
    query,
    gl = 'vn',
    hl = 'vi',
    skipCache = false,
  } = options;

  if (!this.apiKey) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const cacheKey = `serper:places:${query}:${gl}:${hl}`;
  if (!skipCache) {
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
  }
```

- [ ] **Step 3: Add skipCache to searchImages() method**

```js
// BEFORE (line 246-253):
async searchImages(options) {
  const { query, limit = 5 } = options;

  if (!this.apiKey) return null;

  const cacheKey = `serper:images:${query}:${limit}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

// AFTER:
async searchImages(options) {
  const { query, limit = 5, skipCache = false } = options;

  if (!this.apiKey) return null;

  const cacheKey = `serper:images:${query}:${limit}`;
  if (!skipCache) {
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/infrastructure/services/SerperService.js
git commit -m "feat: add skipCache option to SerperService methods"
```

---

### Task 3: Add noCache option to ToolExecutor

**Files:**
- Modify: `src/modules/ai/infrastructure/services/ToolExecutor.js:212,267-270,288-291`
- Modify: `src/modules/ai/infrastructure/services/handlers/searchHandlers.js:135-141,492-516`

Change `execute()` signature to accept `options` and pass them through to handlers as a second argument. This avoids a concurrency bug — ToolExecutor is a singleton, so mutable `this._noCache` flags would race under parallel ToolWorker tasks.

- [ ] **Step 1: Change execute() signature**

```js
// BEFORE (line 212):
async execute(toolName, args) {

// AFTER:
async execute(toolName, args, options = {}) {
```

- [ ] **Step 2: Use noCache in cache check**

```js
// BEFORE (line 267):
const cacheable = isCacheable(toolName, args);

// AFTER:
const cacheable = !options.noCache && isCacheable(toolName, args);
```

- [ ] **Step 3: Pass options to handler as second argument**

```js
// BEFORE (line 291):
const result = await handler(args);

// AFTER:
const result = await handler(args, options);
```

- [ ] **Step 4: Update handler signatures in searchHandlers.js**

In `searchHandlers.js`, update the handler functions to accept the second `options` param and use `options.noCache` to forward `skipCache`:

```js
// searchPlaces (line ~492):
// BEFORE:
async function searchPlaces(args) {
  const { query, location, type, limit = 5 } = args;

// AFTER:
async function searchPlaces(args, options = {}) {
  const { query, location, type, limit = 5 } = args;
```

Then use `options.noCache` to bypass all caches inside the function:

```js
// Handler's own cache (line ~497-500):
// BEFORE:
const cached = await cacheService.get(cacheKey);
if (cached) {
  return { ...cached, source: 'cache' };
}

// AFTER:
if (!options.noCache) {
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }
}
```

```js
// Forward to Serper (line ~516):
// BEFORE:
const serperResult = await serperService.searchPlaces({ query: searchQuery });

// AFTER:
const serperResult = await serperService.searchPlaces({
  query: searchQuery,
  skipCache: options.noCache,
});
```

- [ ] **Step 5: Update webSearch handler similarly**

```js
// webSearch function signature:
// BEFORE:
async function webSearch(args) {

// AFTER:
async function webSearch(args, options = {}) {
```

Forward to Serper:
```js
// Where serperService.search() is called:
// BEFORE:
const serperResult = await serperService.search({ query, limit: numResults });

// AFTER:
const serperResult = await serperService.search({
  query, limit: numResults, skipCache: options.noCache,
});
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai/infrastructure/services/ToolExecutor.js \
        src/modules/ai/infrastructure/services/handlers/searchHandlers.js
git commit -m "feat: add noCache option to ToolExecutor, propagate via handler args"
```

---

### Task 4: ToolWorker uses Orchestrator queries + parallel Serper + Mapbox

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/ToolWorker.js:1-275`
- Modify: `src/modules/ai/infrastructure/services/handlers/searchHandlers.js` (export new wrapper)

Major rewrite: replace hardcoded `SERPER_PLACES_QUERIES` with `task.query`, run Serper and Mapbox in parallel for wider data pool.

- [ ] **Step 1: Export searchMapboxPlaces wrapper from searchHandlers**

Add a new exported function in `searchHandlers.js` that wraps the private `searchViaMapboxSearchBox`. Add near `createSearchHandlers`:

```js
/**
 * Direct Mapbox POI search — for use by ToolWorker in parallel with Serper.
 * @param {string} query - Search query
 * @param {string} token - Mapbox access token
 * @param {number} [limit=5] - Max results
 * @returns {Promise<Array>} Array of place objects
 */
export async function searchMapboxPlaces(query, token, limit = 5) {
  if (!token) return [];
  return searchViaMapboxSearchBox(query, token, limit, {}, null);
}
```

Update the export in `createSearchHandlers`:

```js
export function createSearchHandlers(executor) {
  return {
    webSearch: webSearch.bind(executor),
    scrapeUrl: scrapeUrl.bind(executor),
    searchPlaces: searchPlaces.bind(executor),
  };
}

// searchMapboxPlaces is already exported as named export above
```

- [ ] **Step 2: Replace SERPER_PLACES_QUERIES with getPlacesQueries()**

Delete the `SERPER_PLACES_QUERIES` constant (lines 17-32) and replace with:

```js
/**
 * Build Serper Places queries from Orchestrator task.
 * Uses task.query (specific, localized) as primary, generic as fallback.
 */
const GENERIC_FALLBACK = {
  attractions: (ctx) => `things to do ${ctx.destination}`,
  restaurants: (ctx) => `local food ${ctx.destination}`,
  activities: (ctx) => `tours experiences ${ctx.destination}`,
  nightlife: (ctx) => `nightlife ${ctx.destination}`,
};

function getPlacesQueries(task) {
  const ctx = task.context || {};
  const generic = GENERIC_FALLBACK[task.taskType]?.(ctx);
  const queries = [];
  if (task.query) queries.push(task.query);
  if (generic && generic !== task.query) queries.push(generic);
  if (queries.length === 0) queries.push(`points of interest ${ctx.destination}`);
  return queries;
}
```

- [ ] **Step 3: Replace Serper Places calls with parallel Serper + Mapbox**

In `executeTask()` (line ~63-75), replace the direct `serperService.searchPlaces()` calls with parallel Serper + Mapbox:

```js
// Add import at top of file:
import { searchMapboxPlaces } from '../handlers/searchHandlers.js';

// BEFORE (line 63-75):
const placeQueries = SERPER_PLACES_QUERIES[task.taskType];
if (placeQueries && serperService.isAvailable) {
  for (const q of placeQueries(ctx)) {
    promises.push(
      serperService.searchPlaces({ query: q })
        .then(r => ({ type: 'places', data: r }))
        .catch(() => null),
    );
  }
}

// AFTER:
const placeQueries = getPlacesQueries(task);
const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

for (const q of placeQueries) {
  // Serper Places — primary source, skip cache for planning
  if (serperService.isAvailable) {
    promises.push(
      serperService.searchPlaces({ query: q, skipCache: true })
        .then(r => ({ type: 'places', data: r }))
        .catch(() => null),
    );
  }

  // Mapbox Search Box — secondary source, runs in parallel
  if (mapboxToken) {
    promises.push(
      searchMapboxPlaces(q, mapboxToken, 5)
        .then(places => places.length > 0
          ? { type: 'places', data: { places, source: 'mapbox' } }
          : null)
        .catch(() => null),
    );
  }
}
```

This runs both Serper and Mapbox for each query in parallel. The existing dedup logic (seenNames set) handles merging.

- [ ] **Step 4: Route web_search through ToolExecutor with noCache**

The web_search call (line ~92-101) already uses `toolExecutor.execute`. Add `{ noCache: true }`:

```js
// BEFORE:
promises.push(
  toolExecutor.execute('web_search', {
    query: webQuery(task.query, ctx),
    numResults: 5,
  }).then(r => r?.success ? { type: 'web', data: r.data } : null)
    .catch(() => null),
);

// AFTER:
promises.push(
  toolExecutor.execute('web_search', {
    query: webQuery(task.query, ctx),
    numResults: 5,
  }, { noCache: true }).then(r => r?.success ? { type: 'web', data: r.data } : null)
    .catch(() => null),
);
```

- [ ] **Step 5: Add noCache to all other ToolExecutor calls**

Add `{ noCache: true }` as third argument to every `toolExecutor.execute()` call in `executeTask()`:
- `get_weather` (line ~106)
- `get_exchange_rate` (line ~119)
- `get_local_events` (line ~131)

- [ ] **Step 6: Add skipCache to Serper Images call**

The images call (line ~143-151) calls `serperService.searchImages()` directly. Add `skipCache: true`:

```js
// BEFORE:
serperService.searchImages?.({
  query: `${ctx.destination} travel photography`,
  limit: 5,
})

// AFTER:
serperService.searchImages?.({
  query: `${ctx.destination} travel photography`,
  limit: 5,
  skipCache: true,
})
```

- [ ] **Step 7: Verify dedup handles mixed Serper + Mapbox data**

The existing dedup logic (lines 182-232) checks `data?.places` and deduplicates by name. Both Serper and Mapbox results use the same `{ places: [...] }` shape. The seenNames set handles name-based dedup. Verify that Mapbox place objects have a `name` field (they do — set in `searchViaMapboxSearchBox` line 751: `name: props.name || s.name`).

No code change needed — just verify the shapes are compatible.

- [ ] **Step 8: Verify parallel execution in logs**

Start the dev server and trigger a plan request. Check logs for:
- `[Serper] Places OK` entries with Orchestrator queries (not hardcoded templates)
- `[searchPlaces] Mapbox Search Box returned results` entries (confirms Mapbox is called)
- Both should appear for each task since they run in parallel

- [ ] **Step 9: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/ToolWorker.js \
        src/modules/ai/infrastructure/services/handlers/searchHandlers.js
git commit -m "feat: ToolWorker uses Orchestrator queries, parallel Serper + Mapbox"
```

---

### Task 5: Add temperature to provider.js

**Files:**
- Modify: `src/modules/ai/infrastructure/services/provider.js:12-45`

- [ ] **Step 1: Add temperature parameter to createModel**

```js
// BEFORE (line 12-19):
function createModel(modelId, maxTokens = 16384) {
  return new ChatOpenAI({
    model: modelId,
    configuration: { baseURL },
    apiKey: proxyApiKey,
    maxTokens,
  });
}

// AFTER:
function createModel(modelId, maxTokens = 16384, temperature) {
  const opts = {
    model: modelId,
    configuration: { baseURL },
    apiKey: proxyApiKey,
    maxTokens,
  };
  if (temperature !== undefined) opts.temperature = temperature;
  return new ChatOpenAI(opts);
}
```

- [ ] **Step 2: Set temperature for getFastModel**

```js
// BEFORE (line 29-33):
export function getFastModel() {
  const id = process.env.OAI_FAST_MODEL
    || 'kiro-claude-haiku-4-5';
  return createModel(id, 4096);
}

// AFTER:
export function getFastModel() {
  const id = process.env.OAI_FAST_MODEL
    || 'kiro-claude-haiku-4-5';
  return createModel(id, 4096, 0.3);
}
```

- [ ] **Step 3: Set temperature for getSynthesisModel**

```js
// BEFORE (line 35-40):
export function getSynthesisModel() {
  const id = process.env.OAI_SYNTHESIS_MODEL
    || process.env.OAI_FALLBACK_MODEL
    || 'kiro-claude-sonnet-4-5';
  return createModel(id, 16384);
}

// AFTER:
export function getSynthesisModel() {
  const id = process.env.OAI_SYNTHESIS_MODEL
    || process.env.OAI_FALLBACK_MODEL
    || 'kiro-claude-sonnet-4-5';
  return createModel(id, 16384, 0.7);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/infrastructure/services/provider.js
git commit -m "feat: add temperature to LLM models — 0.3 fast, 0.7 synthesis"
```

---

### Task 6: Add diversity instruction to Synthesizer prompt

**Files:**
- Modify: `src/modules/ai/domain/prompts/synthesizerPrompt.js:8-18`

- [ ] **Step 1: Add diversity section to SYNTHESIZER_SYSTEM_PROMPT**

Insert after the existing `# Rules` section (after line 18, before `# JSON Schema`):

```js
// Add this block after "- EVERY field in the schema below MUST have a value — NO nulls allowed"
// and before "# JSON Schema":

# Diversity
- Do NOT always pick the highest-rated places. Mix popular landmarks with lesser-known local favorites.
- Vary your thematic angle: sometimes lean into food, sometimes culture, sometimes nature — based on what the research data offers, not always the same pattern.
- Shuffle activity ordering across days. Don't always follow the same morning-attraction → lunch → afternoon-attraction → dinner pattern.
- When multiple restaurants/cafes have similar ratings, prefer variety in cuisine type over rating.
```

This is inside a template literal, so add it as raw text within the backtick string.

- [ ] **Step 2: Commit**

```bash
git add src/modules/ai/domain/prompts/synthesizerPrompt.js
git commit -m "feat: add diversity instructions to Synthesizer prompt"
```

---

### Task 7: Orchestrator random angle hint

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/OrchestratorAgent.js:47-53`

- [ ] **Step 1: Add ANGLES constant and random selection**

Add before the `OrchestratorAgent` class (after imports, around line 11):

```js
const PLAN_ANGLES = [
  'hidden gems and local favorites',
  'popular landmarks and must-see spots',
  'seasonal specialties and current events',
  'off-the-beaten-path and unique experiences',
  'food-focused and culinary exploration',
  'nature and outdoor activities',
  'culture, history, and architecture',
];
```

- [ ] **Step 2: Inject angle into user prompt**

In `createWorkPlan()` (line ~48-53), modify the HumanMessage:

```js
// BEFORE (line 48-53):
const lcMessages = [
  new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
  new HumanMessage(
    `Create a research work plan for this trip:\n${JSON.stringify(context, null, 2)}`
  ),
];

// AFTER:
const angle = PLAN_ANGLES[Math.floor(Math.random() * PLAN_ANGLES.length)];
const lcMessages = [
  new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
  new HumanMessage(
    `Create a research work plan for this trip:\n${JSON.stringify(context, null, 2)}\n\nFocus angle for this plan: ${angle}. Bias your search queries toward this theme while still covering essentials.`
  ),
];

logger.info('[OrchestratorAgent] Using angle:', { angle });
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/OrchestratorAgent.js
git commit -m "feat: inject random angle hint into Orchestrator for query diversity"
```

---

### Task 8: Integrate POIRecommender into PlanningPipeline

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js:7-14,97-113`

This is the most impactful change — adds a diversity filtering step between Funnel and Synthesizer.

- [ ] **Step 1: Add POIRecommender import**

At the top of `PlanningPipeline.js` (after line 13):

```js
import { getDiverseRecommendations } from '../../../domain/algorithms/POIRecommender.js';
```

- [ ] **Step 2: Add flattenPlaces helper**

Add after the imports, before the class:

```js
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
```

- [ ] **Step 3: Add rebuildFunnelResult helper**

```js
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
```

- [ ] **Step 4: Add diversity step in plan() method**

In the `plan()` method (line ~94-113), insert between Funnel collect and Synthesizer:

```js
// BEFORE (line 94-113):
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

// AFTER:
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
```

- [ ] **Step 5: Verify end-to-end**

Start dev server and ask the same question twice (e.g., "plan 3 days in Da Lat"). Check logs for:

1. `[OrchestratorAgent] Using angle:` — should show different angles
2. `[STEP 2: Context] Executing: search_places` — queries should match Orchestrator output, not hardcoded templates
3. `[Pipeline] Layer 2.75 done` — should show `inputPlaces: 30+`, `outputPlaces: 25`
4. The two plans should have noticeably different places/ordering

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js
git commit -m "feat: integrate POIRecommender diversity step into planning pipeline"
```

---

### Task 9: Final verification — run 3 plans, compare overlap

- [ ] **Step 1: Generate 3 plans for the same destination**

Ask the system "Lên kế hoạch đi Đà Lạt 3 ngày" three separate times. Save each plan's place names.

- [ ] **Step 2: Compare overlap**

Count how many place names appear in all 3 plans vs unique. Target: < 70% overlap between any 2 plans.

- [ ] **Step 3: Check logs for diversity signals**

Verify in logs:
- Different Orchestrator angles for each run
- Different Serper queries
- POIRecommender reducing 30+ places to 25
- No `[ToolCache] HIT` for planning calls (cache bypassed)

- [ ] **Step 4: Final commit**

If any adjustments needed, commit them. Otherwise, all changes are already committed from Tasks 1-8.
