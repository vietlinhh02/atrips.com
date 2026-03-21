# Plan Diversity — Fix repetitive travel plans

## Problem

When different users ask the same travel planning question (e.g., "plan 3 days in Da Lat"), the system returns nearly identical plans every time. Two root causes:

1. **Search data is narrow** — hardcoded query templates, broken Mapbox integration, aggressive caching
2. **No diversity mechanism** — LLM always picks the same top-rated places from the same data pool

## Root Causes

| # | Bug | File | Impact |
|---|-----|------|--------|
| 1 | ToolWorker ignores Orchestrator's specific queries for Serper Places, uses hardcoded generic templates | `ToolWorker.js:17-32` | Same query every time → same Google results |
| 2 | Mapbox Search Box v1 missing required `session_token` param → API returns 400 | `searchHandlers.js:717-727` | Entire data source disabled |
| 3 | Mapbox Geocoding v5 fallback uses `types=poi` but v5 doesn't support POI search well | `searchHandlers.js:804-805` | Secondary fallback never returns data |
| 4 | No `temperature` parameter in LLM model config | `provider.js:12-18` | LLM output has low variation |
| 5 | POIRecommender has diversity logic (`getDiverseRecommendations`) but is never called in pipeline | Not integrated | No filtering or ranking of places |
| 6 | Cache keys don't distinguish planning vs standalone calls | `SerperService.js`, `ToolExecutor.js` | All users get cached results for 30min-24h |
| 7 | Synthesizer prompt has no diversity instruction | `synthesizerPrompt.js` | LLM always picks highest-rated, most popular places |

## Design

### Section 1: Fix data sources (bugs 1, 2, 3)

#### 1a. ToolWorker uses Orchestrator queries for Serper Places

**Current:** `SERPER_PLACES_QUERIES` is a hardcoded map of generic templates:
```js
attractions: (ctx) => [
  `tourist attractions ${ctx.destination}`,
  `things to do ${ctx.destination}`,
]
```
The Orchestrator generates specific, localized queries (e.g., `"café đẹp Đà Lạt 2026 view thiên nhiên"`) but ToolWorker ignores them for Serper Places — only uses them for web_search fallback.

**Change:** Replace hardcoded templates. Use `task.query` (from Orchestrator) as the primary Serper Places query, keep one generic fallback per task type:

```js
function getPlacesQueries(task) {
  const ctx = task.context || {};
  const generic = GENERIC_FALLBACK[task.taskType]?.(ctx);
  // Orchestrator query first, generic second
  const queries = [];
  if (task.query) queries.push(task.query);
  if (generic && generic !== task.query) queries.push(generic);
  // Catch-all: never return empty — always search for something
  if (queries.length === 0) queries.push(`points of interest ${ctx.destination}`);
  return queries;
}

const GENERIC_FALLBACK = {
  attractions: (ctx) => `things to do ${ctx.destination}`,
  restaurants: (ctx) => `local food ${ctx.destination}`,
  activities: (ctx) => `tours experiences ${ctx.destination}`,
  nightlife: (ctx) => `nightlife ${ctx.destination}`,
};
```

**File:** `ToolWorker.js`

#### 1b. Fix Mapbox Search Box — add `session_token`

**Current:** `searchViaMapboxSearchBox()` omits the required `session_token` parameter. Mapbox returns `400: Session Token is required`. Confirmed via direct API test — adding a UUID session_token returns valid results.

**Change:** Generate a random UUID session token per request:

```js
import { randomUUID } from 'node:crypto';

// In searchViaMapboxSearchBox():
const params = new URLSearchParams({
  q: searchQuery,
  access_token: token,
  limit: String(limit),
  language: 'vi',
  types: 'poi',
  session_token: randomUUID(),
});
```

**File:** `searchHandlers.js`

#### 1c. Remove Geocoding v5 fallback

**Current:** When Search Box returns empty, falls back to `searchViaMapboxGeocoding()` which uses Geocoding v5 with `types=poi`. Testing confirms v5 returns 0 results for POI queries — it only works for geocoding (cities, addresses).

**Change:** Remove the `searchViaMapboxGeocoding` fallback call from `searchPlaces()`. Search Box v1 (with session_token fix) is sufficient.

**File:** `searchHandlers.js`

#### 1d. ToolWorker merges Serper + Mapbox in parallel

**Current:** ToolWorker only uses `serperService.searchPlaces()`. Mapbox is only used via `toolExecutor.execute('search_places')` which ToolWorker doesn't call.

**Change:** For each task, run both Serper Places and Mapbox Search Box in parallel. Merge results, dedup by name + coordinate proximity (reuse existing `seenNames` logic + add coordinate check at 500m threshold).

```
Per task:
  Serper Places (task.query)     → ~10 places
  Mapbox Search Box (task.query) → ~5 places
  Merge + dedup                  → ~12-15 unique places
```

ToolWorker calls Mapbox through ToolExecutor with `{ noCache: true }` — same cache-bypass mechanism as all other planning calls. This avoids breaking encapsulation of the private `searchViaMapboxSearchBox` function. Export a new `searchMapboxPlaces(query, token)` wrapper from searchHandlers if needed, but prefer routing through ToolExecutor for consistency.

**File:** `ToolWorker.js`

### Section 2: Diversity in selection & synthesis (bugs 4, 5, 7)

#### 2a. Integrate POIRecommender between Funnel and Synthesizer

**Current:** Raw Funnel results go directly to SynthesizerAgent. No filtering, ranking, or diversity selection.

**Change:** Add a diversity step in `PlanningPipeline.js` between Funnel collection and Synthesizer:

```
Funnel.collect(tasks)
  → raw results (30-40 places across all tasks)
  → flattenPlaces(funnelResult)     // extract places from all task results
  → POIRecommender.getDiverseRecommendations(allPlaces, userProfile, 25)
  → rebuildFunnelResult(diversePlaces, funnelResult)  // put back into task structure
  → SynthesizerAgent.synthesize(context, diversifiedResult)
```

**flattenPlaces(funnelResult):**
```js
function flattenPlaces(funnelResult) {
  const allPlaces = [];
  for (const r of funnelResult.results) {
    if (r.status !== 'success' || !r.data) continue;
    const places = r.data.places || [];
    for (const p of places) {
      // Normalize type to uppercase for POIRecommender compatibility
      // Serper returns lowercase category, ToolWorker sets type: 'hotel'
      const normalizedType = (p.type || inferTypeFromCategory(p.category))
        .toUpperCase();
      allPlaces.push({
        ...p,
        type: normalizedType,
        _originalTaskType: r.taskType,  // preserve for rebuild
      });
    }
  }
  return allPlaces;
}
```

**rebuildFunnelResult(diversePlaces, funnelResult):**
```js
function rebuildFunnelResult(diversePlaces, originalResult) {
  // Group selected places back by their original task type
  const byTask = {};
  for (const p of diversePlaces) {
    const taskType = p._originalTaskType;
    if (!byTask[taskType]) byTask[taskType] = [];
    byTask[taskType].push(p);
  }
  // Rebuild: replace places in each result, preserve non-place data
  return {
    ...originalResult,
    results: originalResult.results.map(r => {
      if (r.status !== 'success' || !r.data) return r;
      return {
        ...r,
        data: {
          ...r.data,                    // webContext, weather, events, images pass through
          places: byTask[r.taskType] || r.data.places,  // replaced places only
        },
      };
    }),
  };
}
```

`getDiverseRecommendations` uses greedy selection:
1. Score all places (interest match 35% + style compatibility 20% + Bayesian rating 35% + freshness 10%)
2. Pick highest-scored place
3. Re-score remaining places with diversity penalty (-3 per same type, -2 per nearby < 500m)
4. Repeat until target count reached

The `userProfile` is built from ClarifiedContext:
```js
{
  interests: context.interests,        // from clarification
  travelStyle: context.travelStyle,    // from clarification
  prioritizeDiversity: true,           // always on for planning
  prioritizeRating: true,
}
```

**File:** `PlanningPipeline.js`

#### 2b. Add temperature parameter to model config

**Current:** `createModel()` in `provider.js` does not set `temperature`. All LLM calls use API defaults.

**Change:** Accept temperature parameter and set appropriate defaults per model tier:

```js
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

export function getFastModel() {
  const id = process.env.OAI_FAST_MODEL || 'kiro-claude-haiku-4-5';
  return createModel(id, 4096, 0.3);  // Low temp for deterministic JSON
}

export function getSynthesisModel() {
  const id = process.env.OAI_SYNTHESIS_MODEL
    || process.env.OAI_FALLBACK_MODEL
    || 'kiro-claude-sonnet-4-5';
  return createModel(id, 16384, 0.7);  // Moderate temp — enough variety without risking JSON errors
}
```

**File:** `provider.js`

#### 2c. Synthesizer prompt adds diversity instruction

**Current:** Prompt says "Use ONLY real place names from research data" but gives no instruction about variety or thematic diversity.

**Change:** Add to `SYNTHESIZER_SYSTEM_PROMPT`:

```
# Diversity
- Do NOT always pick the highest-rated places. Mix popular landmarks with lesser-known local favorites.
- Vary your thematic angle: sometimes lean into food, sometimes culture, sometimes nature — based on what the research data offers, not always the same pattern.
- Shuffle activity ordering across days. Don't always follow the same morning-attraction → lunch → afternoon-attraction → dinner pattern.
- When multiple restaurants/cafes have similar ratings, prefer variety in cuisine type over rating.
```

**File:** `synthesizerPrompt.js`

#### 2d. Orchestrator query randomization

**Current:** Orchestrator uses `getFastModel()` at temperature 0.3. Same input context → same work plan queries every time. Even with cache bypass, Serper returns the same ranked list for identical queries.

**Change:** Inject a random "angle" hint into the Orchestrator user prompt so it generates different query angles each time:

```js
const ANGLES = [
  'hidden gems and local favorites',
  'popular landmarks and must-see spots',
  'seasonal specialties and current events',
  'off-the-beaten-path and unique experiences',
  'food-focused and culinary exploration',
  'nature and outdoor activities',
  'culture, history, and architecture',
];
const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

// Append to user prompt:
`Focus angle for this plan: ${angle}. Bias your search queries toward this theme while still covering essentials.`
```

This keeps Orchestrator temperature low (0.3, deterministic JSON output) but varies the input, producing different queries each time.

**File:** `OrchestratorAgent.js`

### Section 3: Cache awareness (bugs 6)

#### 3a. ToolWorker bypasses cache for planning pipeline

**Current:** ToolWorker calls `serperService.searchPlaces()` and `toolExecutor.execute('web_search')` — both are cached (30min and 1h respectively). Same destination within cache window = identical data for all users.

**Change:** Single unified cache-bypass mechanism via `ToolExecutor.execute()`:

```js
async execute(toolName, args, options = {}) {
  const cacheable = !options.noCache && isCacheable(toolName, args);
  // ... rest of logic unchanged
}
```

ToolWorker routes ALL calls through ToolExecutor with `{ noCache: true }`:
```js
// Serper Places — now via ToolExecutor instead of direct serperService call
toolExecutor.execute('search_places', { query, location: ctx.destination }, { noCache: true })
// Web search
toolExecutor.execute('web_search', { query, numResults: 5 }, { noCache: true })
```

This centralizes cache control in one place. ToolWorker no longer calls `serperService.searchPlaces()` directly. The existing `search_places` handler in ToolExecutor already chains Serper → Mapbox, which means the 1d Mapbox parallel merge is handled by the existing handler (with the session_token fix from 1b).

Standalone tool calls (DirectAgent, user chat) continue using cache normally — they don't pass `noCache`.

**File:** `ToolExecutor.js`, `ToolWorker.js`

## Files Changed

| File | Changes |
|------|---------|
| `src/modules/ai/infrastructure/services/pipeline/ToolWorker.js` | Use task.query for Serper Places; route all calls through ToolExecutor with noCache |
| `src/modules/ai/infrastructure/services/handlers/searchHandlers.js` | Add session_token to Mapbox Search Box; remove Geocoding v5 fallback |
| `src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js` | Add POIRecommender diversity step (flattenPlaces + rebuildFunnelResult) |
| `src/modules/ai/infrastructure/services/pipeline/OrchestratorAgent.js` | Add random angle hint to user prompt |
| `src/modules/ai/infrastructure/services/provider.js` | Add temperature parameter to createModel, set per model tier |
| `src/modules/ai/domain/prompts/synthesizerPrompt.js` | Add diversity instructions |
| `src/modules/ai/infrastructure/services/ToolExecutor.js` | Add noCache option to execute() |

## Data Flow After Changes

```
User: "Plan 3 days in Da Lat"

Layer 1.5: ClarificationAgent (temp 0.3)
  → {destination: "Đà Lạt", duration: "3 days", interests: [...]}

Layer 2: OrchestratorAgent (temp 0.3, random angle: "food-focused")
  → tasks with SPECIFIC queries biased by angle:
    t1: attractions — "điểm tham quan Đà Lạt 2026, thung lũng tình yêu, hồ Tuyền Lâm"
    t2: restaurants — "đặc sản Đà Lạt 2026, bánh tráng nướng, lẩu gà lá é, quán ăn địa phương"
    t3: activities — "trải nghiệm ẩm thực Đà Lạt 2026, cooking class, chợ đêm"

Layer 2.5: ToolWorker (per task, parallel, NO CACHE)
  ├── Serper Places(task.query)  → ~10 places    ← NEW: uses Orchestrator query
  ├── Mapbox SearchBox(task.query) → ~5 places   ← NEW: fixed + parallel
  ├── web_search(task.query)     → context
  └── Dedup + merge              → ~12-15 places

Layer 2.75: POIRecommender (NEW STEP)
  → All ~35-45 places from all tasks
  → getDiverseRecommendations(places, userProfile, 25)
  → 25 diverse, relevant places

Layer 3: SynthesizerAgent (temp 0.7, diversity prompt)
  → Varied itinerary JSON + markdown

Layer 4: ItineraryVerifier
  → Validation
```

## Testing Strategy

1. **Mapbox fix** — unit test: call searchViaMapboxSearchBox with session_token, verify non-empty results for known destinations (Da Lat, Hue, Tokyo)
2. **ToolWorker queries** — log test: verify Serper Places receives Orchestrator queries, not hardcoded templates
3. **Diversity** — integration test: run pipeline 3 times for same destination, compare place overlap. Target: < 70% overlap between any 2 runs
4. **Cache bypass** — verify ToolWorker calls don't hit cache; standalone search_places still uses cache
5. **POIRecommender** — unit test: given 30 raw places, verify getDiverseRecommendations returns mix of types, not all same category
6. **Cache regression** — verify `toolExecutor.execute('search_places', args)` (without noCache) still caches; `toolExecutor.execute('search_places', args, { noCache: true })` does not

## Risks

- **Increased API costs**: bypassing cache + Mapbox calls ≈ 1.5x API usage per plan. Mitigated by keeping cache for non-planning flows (DirectAgent, standalone tools).
- **Latency**: Mapbox runs alongside Serper in parallel (no net increase). POIRecommender scoring is in-memory, negligible.
- **Temperature 0.7**: moderate — should preserve JSON validity while adding variety. Monitor JSON parse failures in first week.
