# Pipeline Diversity Overhaul

**Date:** 2026-03-22
**Status:** Draft
**Branch:** feat/plan-diversity

## Problem

The planning pipeline consistently recommends the same places (e.g., MẸT restaurant for every Hanoi trip). Four root causes:

1. **Narrow search**: 1 query per task type → same Google top results every time
2. **User profile ignored in scoring**: Onboarding data (traveler types, dietary, spending) only used in Synthesizer system prompt, not in POIRecommender
3. **Data truncation**: `compactWorkerData` cuts to 15 items / 4000 chars → LLM sees limited pool
4. **No repeat tracking**: Same user gets identical recommendations across conversations

## Design

### Layer A: Pass onboarding userProfile to POIRecommender

**Files:** `POIRecommender.js` (new helper), `PlanningPipeline.js` (call site)

Currently `PlanningPipeline.js:159` constructs a new `userProfile` from ClarificationAgent context:
```javascript
const userProfile = {
  interests: context.interests || [],        // usually empty
  travelStyle: context.travelStyle || 'comfort',
  prioritizeDiversity: true,
  prioritizeRating: true,
};
```

**Change in `PlanningPipeline.js`:** Merge `this.executionContext.userProfile` (onboarding data) into the POIRecommender profile:

```javascript
const onboarding = this.executionContext.userProfile || {};
const travelProfile = onboarding.travelProfile || {};

// Map onboarding spendingHabits to POIRecommender travelStyle
const SPENDING_TO_STYLE = { budget: 'budget', moderate: 'comfort', luxury: 'luxury' };

const userProfile = {
  interests: mapTravelerTypesToInterests(
    travelProfile.travelerTypes || [],
    context.interests || [],
  ),
  travelStyle: SPENDING_TO_STYLE[travelProfile.spendingHabits]
    || context.travelStyle || 'comfort',
  dietaryRestrictions: onboarding.preferences?.dietaryRestrictions || [],
  prioritizeDiversity: true,
  prioritizeRating: true,
};
```

**New helper `mapTravelerTypesToInterests` — placed in `POIRecommender.js`:**

Co-located with `INTEREST_KEYWORDS` and scoring functions that consume these values.

Maps onboarding traveler types (from `travelProfileOptions.js` enum values) to POIRecommender interest keywords:

| Traveler Type (DB value) | Mapped Interests |
|--------------------------|-----------------|
| `adventurer` | adventure, outdoor, hiking, extreme |
| `explorer` | hidden gems, off-beaten-path, local |
| `culture_seeker` | culture, history, museum, temple, art |
| `foodie` | food, cuisine, street food, restaurant, cooking |
| `photographer` | viewpoint, scenic, photo, architecture |
| `relaxation` | spa, beach, park, garden, cafe |
| `budget_traveler` | street food, free, market, local |
| `luxury_traveler` | fine dining, luxury, premium, boutique |

Merge with `context.interests` (from ClarificationAgent), deduplicate.

**Edge case — empty onboarding:** When `travelProfile` is null or `travelerTypes` is empty (user skipped onboarding), falls through to `context.interests || []`, preserving existing behavior.

### Layer B: Multi-angle search queries in ToolWorker

**File:** `ToolWorker.js`

Add `DIVERSITY_ANGLES` constant — per task type, each angle generates an additional Serper Places query. Use the existing `isVietnam` regex pattern (already at line 127) to switch between Vietnamese and English queries:

```javascript
const IS_VIETNAM = /vi[eệ]t\s*nam|hà\s*n[oộ]i|đ[aà]\s*n[aẵ]ng|sài\s*gòn|hcm|huế|hội\s*an|nha\s*trang|đà\s*lạt|phú\s*quốc/i;

const DIVERSITY_ANGLES = {
  restaurants: {
    vi: [
      (dest) => `${dest} street food chợ đêm quán vỉa hè`,
      (dest) => `${dest} nhà hàng đặc sản địa phương ngon nổi tiếng`,
      (dest) => `${dest} quán ăn hidden gem locals yêu thích ít khách du lịch`,
    ],
    en: [
      (dest) => `${dest} street food night market local stalls`,
      (dest) => `${dest} best local specialty restaurants authentic`,
      (dest) => `${dest} hidden gem restaurants locals favorite off tourist trail`,
    ],
  },
  activities: {
    vi: [
      (dest) => `${dest} workshop cooking class trải nghiệm thủ công`,
      (dest) => `${dest} thiên nhiên outdoor hiking cycling`,
    ],
    en: [
      (dest) => `${dest} workshop cooking class handcraft experience`,
      (dest) => `${dest} nature outdoor hiking cycling adventure`,
    ],
  },
  attractions: {
    vi: [
      (dest) => `${dest} điểm đến ít người biết hidden gems địa phương`,
    ],
    en: [
      (dest) => `${dest} hidden gems off-the-beaten-path local favorites`,
    ],
  },
  nightlife: {
    vi: [
      (dest) => `${dest} rooftop bar live music quán bar đêm`,
    ],
    en: [
      (dest) => `${dest} rooftop bar live music local nightlife`,
    ],
  },
};
```

**Change in `getPlacesQueries(task)`:**

```javascript
function getPlacesQueries(task) {
  const ctx = task.context || {};
  const dest = ctx.destination || '';
  const generic = GENERIC_FALLBACK[task.taskType]?.(ctx);
  const queries = [];
  if (task.query) queries.push(task.query);
  if (generic && generic !== task.query) queries.push(generic);

  // Add diversity angle queries (language-aware)
  const angleSet = DIVERSITY_ANGLES[task.taskType];
  if (angleSet) {
    const lang = IS_VIETNAM.test(dest) ? 'vi' : 'en';
    for (const angleFn of angleSet[lang]) {
      const q = angleFn(dest);
      if (!queries.includes(q)) queries.push(q);
    }
  }

  if (queries.length === 0) queries.push(`points of interest ${dest}`);
  return queries;
}
```

**Impact:** Restaurants go from 2 queries → 5 queries. Each runs as a parallel Serper Places call. Pool grows from ~80 to ~150-200 places.

**Cost:** ~5 extra Serper API calls per plan (~$0.004). All parallel, no latency increase.

### Layer C: Increase Synthesizer data capacity

**File:** `SynthesizerAgent.js` — `compactWorkerData` function

| Parameter | Before | After |
|-----------|--------|-------|
| `MAX_ITEMS` | 15 | 20 |
| JSON char limit | 4000 | 6000 |

**File:** `PlanningPipeline.js` — Layer 2.75

| Parameter | Before | After |
|-----------|--------|-------|
| `TARGET_PLACES` | 25 | 35 |

Rationale: Sonnet 4.5 has 16K output tokens and handles larger input well. The extra ~2K chars per task is negligible vs the quality improvement.

Note: POIRecommender filters to TARGET_PLACES=35 *before* compactWorkerData runs, so the 20-item limit per task type applies to the already-diversified set. With 35 places split across ~4 task types, each type gets ~8-10 places on average — well within the 20-item limit.

### Layer D: Recommendation history feedback loop

#### D.1: Database schema

**New Prisma model:**

```prisma
model recommendation_history {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @db.Uuid
  placeKey      String   @db.VarChar(255)
  destination   String   @db.VarChar(255)
  placeName     String   @db.VarChar(255)
  draftId       String?  @db.Uuid
  recommendedAt DateTime @default(now()) @db.Timestamptz

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, destination])
  @@map("recommendation_history")
}
```

Also add back-reference in the `User` model:
```prisma
model User {
  // ... existing fields ...
  recommendationHistory recommendation_history[]
}
```

**No unique constraint** — store every recommendation as a separate row. This preserves full history (how many times a place was recommended, across which drafts). The table is append-mostly and user-scoped, so row count is manageable.

**Cleanup:** Add a periodic job (or migration) to delete rows older than 90 days, since the decay schedule makes them inert.

**`placeKey` generation:** Use Google `cid` (Place ID) from Serper when available. Fall back to normalized name: strip diacritics, collapse whitespace, lowercase, remove common suffixes ("restaurant", "nhà hàng", "café"), then join with `|` and destination. Example: `"met|ha noi"`.

```javascript
function generatePlaceKey(place, destination) {
  if (place.cid) return `cid:${place.cid}`;
  const normalized = (place.name || place.title || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(restaurant|nha hang|cafe|café|quán|shop)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  const destNorm = (destination || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
  return `${normalized}|${destNorm}`;
}
```

#### D.2: Repository

**New file:** `src/modules/ai/infrastructure/repositories/RecommendationHistoryRepository.js`

```javascript
class RecommendationHistoryRepository {
  /**
   * Returns Map<placeKey, Date> for a user+destination pair.
   * Only returns records from the last 90 days.
   */
  async getByUserAndDestination(userId, destination) { ... }

  /**
   * Inserts recommendation records (one per activity).
   * No upsert — appends every recommendation.
   */
  async recordRecommendations(userId, destination, places, draftId) { ... }
}
```

- `getByUserAndDestination`: Returns `Map<string, Date>` mapping placeKey to most recent `recommendedAt`. Filters to last 90 days.
- `recordRecommendations`: Batch `createMany` for all activities in the draft.

#### D.3: POIRecommender integration

**Full call chain update:**

1. `getDiverseRecommendations(places, userProfile, count, options)` — add `options.previouslyRecommended` (Map<string, Date>)
2. `scorePlace(place, userProfile, selectedPlaces, options)` — add `options` parameter, forward to penalty function
3. `calculateDiversityPenalty(place, selectedPlaces, previouslyRecommended)` — add Map parameter

```javascript
export function calculateDiversityPenalty(place, selectedPlaces, previouslyRecommended) {
  // ... existing type + proximity penalties ...

  // History penalty: penalize places recommended to this user before
  if (previouslyRecommended instanceof Map) {
    const placeKey = generatePlaceKey(place, place._destination);
    const lastRecommended = previouslyRecommended.get(placeKey);
    if (lastRecommended) {
      const daysSince = (Date.now() - lastRecommended.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) penalty += 8;
      else if (daysSince < 30) penalty += 5;
      else if (daysSince < 90) penalty += 2;
    }
  }

  return Math.min(20, penalty); // Raised cap from 15 → 20
}
```

Existing callers pass `undefined` for `previouslyRecommended` — no breakage since the `instanceof Map` check guards the new logic.

#### D.4: Pipeline integration

**File:** `PlanningPipeline.js`

1. Before Layer 2.75, fetch history (skip for anonymous users):
   ```javascript
   const userId = this.executionContext.userId;
   let previouslyRecommended = null;
   if (userId) {
     previouslyRecommended = await recommendationHistoryRepo
       .getByUserAndDestination(userId, context.destination);
   }
   ```

2. Pass to `getDiverseRecommendations`:
   ```javascript
   const diversePlaces = getDiverseRecommendations(
     allPlaces, userProfile,
     Math.min(TARGET_PLACES, allPlaces.length),
     { previouslyRecommended },
   );
   ```

3. After `SynthesizerAgent._saveDraft()` succeeds, record what the user actually sees (the LLM's final output, not POIRecommender's input). The LLM's activity objects use `name` field (per synthesizerPrompt schema):
   ```javascript
   if (userId && draftId) {
     await recommendationHistoryRepo.recordRecommendations(
       userId, context.destination,
       itineraryData.days.flatMap(d => d.activities),
       draftId,
     );
   }
   ```

## File Changes Summary

| File | Change Type | Description |
|------|------------|-------------|
| `POIRecommender.js` | Modify | Add `mapTravelerTypesToInterests`, `generatePlaceKey`, update `calculateDiversityPenalty` + `scorePlace` + `getDiverseRecommendations` signatures |
| `PlanningPipeline.js` | Modify | Merge onboarding profile, fetch/pass history, record after save, increase TARGET_PLACES |
| `ToolWorker.js` | Modify | Add DIVERSITY_ANGLES (vi/en), expand getPlacesQueries |
| `SynthesizerAgent.js` | Modify | Increase MAX_ITEMS (15→20) and char limit (4000→6000) in compactWorkerData |
| `RecommendationHistoryRepository.js` | New | CRUD for recommendation_history table |
| `prisma/schema.prisma` | Modify | Add recommendation_history model + User back-reference |

## Performance Impact

- **Serper API calls:** ~6 → ~12 per plan (+$0.004, all parallel)
- **DB queries:** +1 read (history fetch, indexed) + 1 batch insert (record recommendations)
- **Latency:** No measurable increase (extra Serper calls are parallel, DB queries are fast)
- **LLM tokens:** ~500 more input tokens per synthesis (larger compact data)
- **POIRecommender:** O(n*m) scoring unchanged; 35 × 200 = 7000 calls, ~50ms total

## Testing Strategy

- Unit test: `mapTravelerTypesToInterests` with all 8 traveler types + empty input
- Unit test: `generatePlaceKey` with cid, Vietnamese names, English names
- Unit test: `calculateDiversityPenalty` with history Map (7-day, 30-day, 90-day decay)
- Unit test: `getPlacesQueries` generates correct queries for Vietnam vs international destinations
- Edge case: anonymous user (null userId) — history skipped, no recording
- Edge case: user with no onboarding data — degrades to existing behavior
- Integration test: Full pipeline produces different results for same query when history exists
- Manual test: Create 2 Hanoi plans for same user → verify different restaurants
