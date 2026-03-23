# Pipeline Diversity Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate repetitive trip recommendations by widening search queries, integrating user onboarding data into scoring, increasing data capacity, and tracking recommendation history.

**Architecture:** Four independent layers applied sequentially — (A) merge onboarding profile into POIRecommender scoring, (B) add multi-angle search queries per task type in ToolWorker, (C) increase data limits in compactWorkerData and TARGET_PLACES, (D) add recommendation_history table and decay-based penalty for previously recommended places.

**Tech Stack:** Node.js ESM, Prisma ORM, PostgreSQL, Serper API

**Spec:** `docs/superpowers/specs/2026-03-22-pipeline-diversity-overhaul-design.md`

---

### Task 1: Add `mapTravelerTypesToInterests` and `generatePlaceKey` to POIRecommender

**Files:**
- Modify: `src/modules/ai/domain/algorithms/POIRecommender.js`

- [ ] **Step 1: Add `TRAVELER_TYPE_INTERESTS` mapping and `mapTravelerTypesToInterests` function**

Add after the `TRAVEL_STYLE_PROFILE` constant (after line 52), before `calculateInterestMatch`:

```javascript
/**
 * Maps onboarding traveler types to POIRecommender interest keywords.
 * Values match travelProfileOptions.js enum values.
 */
const TRAVELER_TYPE_INTERESTS = {
  adventurer: ['adventure', 'outdoor', 'hiking', 'extreme'],
  explorer: ['hidden gems', 'off-beaten-path', 'local'],
  culture_seeker: ['culture', 'history', 'museum', 'temple', 'art'],
  foodie: ['food', 'cuisine', 'street food', 'restaurant', 'cooking'],
  photographer: ['viewpoint', 'scenic', 'photo', 'architecture'],
  relaxation: ['spa', 'beach', 'park', 'garden', 'cafe'],
  budget_traveler: ['street food', 'free', 'market', 'local'],
  luxury_traveler: ['fine dining', 'luxury', 'premium', 'boutique'],
};

/**
 * Convert onboarding traveler types to interest keywords for scoring.
 * Merges with ClarificationAgent interests, deduplicates.
 */
export function mapTravelerTypesToInterests(travelerTypes, contextInterests) {
  const interests = new Set(contextInterests || []);
  for (const type of travelerTypes || []) {
    const keywords = TRAVELER_TYPE_INTERESTS[type];
    if (keywords) {
      for (const kw of keywords) interests.add(kw);
    }
  }
  return [...interests];
}
```

- [ ] **Step 2: Add `generatePlaceKey` function**

Add after `mapTravelerTypesToInterests`:

```javascript
/**
 * Generate a stable key for deduplicating place recommendations.
 * Uses Google cid when available, falls back to normalized name|destination.
 */
export function generatePlaceKey(place, destination) {
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

- [ ] **Step 3: Add both to the default export**

Change the default export at the bottom of the file (line 458-469):

```javascript
export default {
  calculateInterestMatch,
  calculateStyleCompatibility,
  calculateRatingScore,
  scorePlace,
  filterPlaces,
  getRecommendations,
  getDiverseRecommendations,
  getBalancedRecommendations,
  mapTravelerTypesToInterests,
  generatePlaceKey,
  INTEREST_KEYWORDS,
  TRAVEL_STYLE_PROFILE,
};
```

- [ ] **Step 4: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/domain/algorithms/POIRecommender.js').then(m => console.log(Object.keys(m).join(', ')))"`

Expected: Output includes `mapTravelerTypesToInterests, generatePlaceKey`

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/domain/algorithms/POIRecommender.js
git commit -m "feat(ai): add mapTravelerTypesToInterests and generatePlaceKey to POIRecommender"
```

---

### Task 2: Update `calculateDiversityPenalty`, `scorePlace`, `getDiverseRecommendations` signatures

**Files:**
- Modify: `src/modules/ai/domain/algorithms/POIRecommender.js`

- [ ] **Step 1: Update `calculateDiversityPenalty` to accept `previouslyRecommended` Map**

Replace the function at line 184-208:

```javascript
/**
 * Calculate diversity penalty
 * Reduces score for places similar to already selected places
 * and previously recommended places.
 * @param {Object} place - Place to score
 * @param {Array} selectedPlaces - Already selected places
 * @param {Map<string, Date>} [previouslyRecommended] - Map of placeKey → recommendedAt
 * @param {string} [destination] - Destination for placeKey generation
 * @returns {number} Diversity penalty (0-20)
 */
export function calculateDiversityPenalty(
  place, selectedPlaces, previouslyRecommended, destination,
) {
  if (!selectedPlaces || selectedPlaces.length === 0) {
    if (!previouslyRecommended) return 0;
  }

  let penalty = 0;

  // Check for same type — soft penalty, don't over-penalize
  const sameType = (selectedPlaces || [])
    .filter(p => p.type === place.type).length;
  penalty += sameType * 3;

  // Check for nearby places
  if (place.latitude && place.longitude) {
    const veryNearby = (selectedPlaces || []).filter(p => {
      if (!p.latitude || !p.longitude) return false;
      const dist = Math.sqrt(
        Math.pow(p.latitude - place.latitude, 2) +
        Math.pow(p.longitude - place.longitude, 2)
      );
      return dist < 0.005;
    }).length;
    penalty += veryNearby * 2;
  }

  // History penalty: penalize places recommended to this user before
  if (previouslyRecommended instanceof Map) {
    const placeKey = generatePlaceKey(
      place, destination || place._destination,
    );
    const lastRecommended = previouslyRecommended.get(placeKey);
    if (lastRecommended) {
      const daysSince = (Date.now() - lastRecommended.getTime())
        / (1000 * 60 * 60 * 24);
      if (daysSince < 7) penalty += 8;
      else if (daysSince < 30) penalty += 5;
      else if (daysSince < 90) penalty += 2;
    }
  }

  return Math.min(20, penalty);
}
```

- [ ] **Step 2: Update `scorePlace` to forward `options`**

Replace the function at line 218-292:

```javascript
/**
 * Main recommendation scoring function
 * @param {Object} place - Place to score
 * @param {Object} userProfile - User preferences
 * @param {Array} selectedPlaces - Already selected places
 * @param {Object} [options] - Additional options
 * @param {Map<string, Date>} [options.previouslyRecommended]
 * @param {string} [options.destination]
 * @returns {Object} Scored place with breakdown
 */
export function scorePlace(
  place, userProfile = {}, selectedPlaces = [], options = {},
) {
  const {
    interests = [],
    travelStyle = 'comfort',
    prioritizeRating = true,
    prioritizeDiversity = true,
    dietaryRestrictions = [],
  } = userProfile;

  const interestScore = calculateInterestMatch(place, interests);
  const styleScore = calculateStyleCompatibility(place, travelStyle);
  const ratingScore = calculateRatingScore(place);
  const freshnessBonus = calculateFreshnessBonus(place);
  const diversityPenalty = prioritizeDiversity
    ? calculateDiversityPenalty(
        place, selectedPlaces,
        options.previouslyRecommended,
        options.destination,
      )
    : 0;

  // Dietary compatibility bonus for restaurants
  let dietaryBonus = 0;
  if (
    dietaryRestrictions.length > 0
    && (place.type === 'RESTAURANT' || place.type === 'CAFE')
  ) {
    const placeText = [
      place.name,
      place.description,
      ...(place.categories || []),
      ...(place.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();

    const dietaryKeywords = {
      vegetarian: ['chay', 'vegetarian', 'vegan', 'plant-based', 'rau'],
      vegan: ['vegan', 'chay', 'plant-based', 'thuần chay'],
      halal: ['halal'],
      'gluten-free': ['gluten-free', 'gluten free'],
      kosher: ['kosher'],
    };

    for (const restriction of dietaryRestrictions) {
      const keywords = dietaryKeywords[restriction.toLowerCase()]
        || [restriction.toLowerCase()];
      if (keywords.some(kw => placeText.includes(kw))) {
        dietaryBonus += 10;
      }
    }
  }

  const weights = {
    interest: 0.35,
    style: 0.20,
    rating: prioritizeRating ? 0.35 : 0.25,
    freshness: 0.10,
  };

  const baseScore =
    interestScore * weights.interest +
    styleScore * weights.style +
    ratingScore * weights.rating +
    freshnessBonus +
    dietaryBonus;

  const finalScore = Math.max(0, baseScore - diversityPenalty);

  return {
    ...place,
    score: Math.round(finalScore * 100) / 100,
    scoreBreakdown: {
      interest: Math.round(interestScore),
      style: Math.round(styleScore),
      rating: Math.round(ratingScore),
      freshness: freshnessBonus,
      dietaryBonus,
      diversityPenalty,
    },
  };
}
```

- [ ] **Step 3: Update `getDiverseRecommendations` to accept `options`**

Replace the function at line 405-432:

```javascript
/**
 * Get diverse recommendations with optional history penalty.
 * @param {Array} places - All places
 * @param {Object} userProfile - User preferences
 * @param {number} count - Number of recommendations
 * @param {Object} [options]
 * @param {Map<string, Date>} [options.previouslyRecommended]
 * @param {string} [options.destination]
 * @returns {Array} Diverse recommendations
 */
export function getDiverseRecommendations(
  places, userProfile, count = 10, options = {},
) {
  const selected = [];
  const availablePlaces = [...places];

  while (selected.length < count && availablePlaces.length > 0) {
    const scoredPlaces = availablePlaces.map(place =>
      scorePlace(
        place,
        { ...userProfile, prioritizeDiversity: true },
        selected,
        options,
      )
    );

    scoredPlaces.sort((a, b) => b.score - a.score);

    const topPlace = scoredPlaces[0];
    selected.push(topPlace);

    const index = availablePlaces.findIndex(p =>
      (p.id && p.id === topPlace.id) || p.name === topPlace.name
    );
    if (index > -1) {
      availablePlaces.splice(index, 1);
    }
  }

  return selected;
}
```

- [ ] **Step 4: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/domain/algorithms/POIRecommender.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/domain/algorithms/POIRecommender.js
git commit -m "feat(ai): add history penalty and options param to POIRecommender scoring chain"
```

---

### Task 3: Add multi-angle search queries to ToolWorker

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/ToolWorker.js`

- [ ] **Step 1: Add `IS_VIETNAM` regex and `DIVERSITY_ANGLES` constant**

Add after the `GENERIC_FALLBACK` constant (after line 18), before `getPlacesQueries`:

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

- [ ] **Step 2: Replace `getPlacesQueries` function**

Replace lines 20-28:

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

- [ ] **Step 3: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/ToolWorker.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/ToolWorker.js
git commit -m "feat(ai): add multi-angle diversity search queries to ToolWorker"
```

---

### Task 4: Increase Synthesizer data capacity

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js`

- [ ] **Step 1: Update `compactWorkerData` limits**

In the `compactWorkerData` function (line 402-433), change:

```javascript
// Line 406: change MAX_ITEMS from 15 to 20
const MAX_ITEMS = 20;
```

```javascript
// Line 432: change 4000 to 6000
return json.length > 6000 ? json.substring(0, 6000) + '...' : json;
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js
git commit -m "feat(ai): increase compactWorkerData limits (20 items, 6000 chars)"
```

---

### Task 5: Merge onboarding profile into PlanningPipeline + increase TARGET_PLACES

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js`

- [ ] **Step 1: Add import for `mapTravelerTypesToInterests`**

At the top of the file (line 14), add:

```javascript
import {
  getDiverseRecommendations,
  mapTravelerTypesToInterests,
} from '../../../domain/algorithms/POIRecommender.js';
```

And remove the existing import on line 14:
```javascript
// REMOVE: import { getDiverseRecommendations } from '../../../domain/algorithms/POIRecommender.js';
```

- [ ] **Step 2: Add `SPENDING_TO_STYLE` constant**

Add after imports (before the `flattenPlaces` function):

```javascript
const SPENDING_TO_STYLE = {
  budget: 'budget',
  moderate: 'comfort',
  luxury: 'luxury',
};
```

- [ ] **Step 3: Update Layer 2.75 userProfile construction**

In the `plan()` method (around line 152-164), replace the userProfile construction:

```javascript
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
    allPlaces, userProfile,
    Math.min(TARGET_PLACES, allPlaces.length),
  );
  diversifiedResult = rebuildFunnelResult(
    diversePlaces, funnelResult,
  );
  logger.info('[Pipeline] Layer 2.75 done', {
    durationMs: Date.now() - stepStart,
    inputPlaces: allPlaces.length,
    outputPlaces: diversePlaces.length,
  });
} else {
  logger.warn(
    '[Pipeline] Layer 2.75 skipped — no places to diversify',
  );
}
```

- [ ] **Step 4: Apply same changes in `planStream()` method**

The `planStream()` method has a similar Layer 2.75 section (around line 270-300). Apply the identical userProfile + TARGET_PLACES changes there.

- [ ] **Step 5: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js
git commit -m "feat(ai): merge onboarding profile into POIRecommender scoring, increase TARGET_PLACES to 35"
```

---

### Task 6: Add Prisma schema for recommendation_history

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `recommendation_history` model**

Add at the end of the schema file (before any closing content):

```prisma
model recommendation_history {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @db.Uuid
  placeKey      String   @db.VarChar(255)
  destination   String   @db.VarChar(255)
  placeName     String   @db.VarChar(255)
  draftId       String?  @db.Uuid
  recommendedAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, destination])
  @@map("recommendation_history")
}
```

- [ ] **Step 2: Add back-reference in the `User` model**

In the `User` model (line 1403, after `voice_inputs`), add:

```prisma
  recommendation_history   recommendation_history[]
```

- [ ] **Step 3: Generate Prisma client and create migration**

Run: `npx prisma migrate dev --name add_recommendation_history`

Expected: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(ai): add recommendation_history table for repeat-tracking"
```

---

### Task 7: Create RecommendationHistoryRepository

**Files:**
- Create: `src/modules/ai/infrastructure/repositories/RecommendationHistoryRepository.js`

- [ ] **Step 1: Create the repository file**

```javascript
/**
 * Recommendation History Repository
 * Tracks which places have been recommended to each user
 * for diversity scoring in POIRecommender.
 */

import prisma from '../../../../config/database.js';
import { generatePlaceKey } from '../../domain/algorithms/POIRecommender.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const HISTORY_TTL_DAYS = 90;

class RecommendationHistoryRepository {
  /**
   * Get previously recommended places for a user+destination.
   * Returns Map<placeKey, Date> filtered to last 90 days.
   */
  async getByUserAndDestination(userId, destination) {
    if (!userId || !destination) return new Map();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_TTL_DAYS);

    const rows = await prisma.recommendation_history.findMany({
      where: {
        userId,
        destination,
        recommendedAt: { gte: cutoff },
      },
      select: { placeKey: true, recommendedAt: true },
      orderBy: { recommendedAt: 'desc' },
    });

    // Keep only the most recent recommendedAt per placeKey
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.placeKey)) {
        map.set(row.placeKey, row.recommendedAt);
      }
    }
    return map;
  }

  /**
   * Record recommended places from a completed draft.
   * Appends one row per activity (no upsert).
   */
  async recordRecommendations(
    userId, destination, activities, draftId,
  ) {
    if (!userId || !destination || !activities?.length) return;

    const data = activities
      .filter(a => a.name || a.title)
      .map(a => ({
        userId,
        placeKey: generatePlaceKey(a, destination),
        destination,
        placeName: (a.name || a.title || '').slice(0, 255),
        draftId: draftId || null,
      }));

    if (data.length === 0) return;

    try {
      await prisma.recommendation_history.createMany({
        data,
        skipDuplicates: false,
      });
    } catch (error) {
      logger.warn('[RecommendationHistory] Failed to record:', {
        error: error.message,
        count: data.length,
      });
    }
  }

  /**
   * Delete records older than TTL. Call from a periodic job.
   */
  async cleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_TTL_DAYS);

    const { count } = await prisma.recommendation_history.deleteMany({
      where: { recommendedAt: { lt: cutoff } },
    });
    return count;
  }
}

export default new RecommendationHistoryRepository();
```

- [ ] **Step 2: Verify import works**

Run: `node -e "import('./src/modules/ai/infrastructure/repositories/RecommendationHistoryRepository.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/modules/ai/infrastructure/repositories/RecommendationHistoryRepository.js
git commit -m "feat(ai): add RecommendationHistoryRepository for repeat-tracking"
```

---

### Task 8: Integrate recommendation history into PlanningPipeline

**Files:**
- Modify: `src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js`
- Modify: `src/modules/ai/infrastructure/services/pipeline/SynthesizerAgent.js`

- [ ] **Step 1: Add import in PlanningPipeline.js**

Add at the top with other imports:

```javascript
import recommendationHistoryRepo from '../../repositories/RecommendationHistoryRepository.js';
```

- [ ] **Step 2: Update `plan()` method — fetch history before Layer 2.75**

In the `plan()` method, before the Layer 2.75 section, add:

```javascript
// Fetch recommendation history for diversity penalty
const userId = this.executionContext.userId;
let previouslyRecommended = null;
if (userId) {
  previouslyRecommended = await recommendationHistoryRepo
    .getByUserAndDestination(userId, context.destination);
}
```

Then update the `getDiverseRecommendations` call to pass options:

```javascript
const diversePlaces = getDiverseRecommendations(
  allPlaces, userProfile,
  Math.min(TARGET_PLACES, allPlaces.length),
  {
    previouslyRecommended,
    destination: context.destination,
  },
);
```

- [ ] **Step 3: Update `plan()` method — record recommendations after draft save**

After the synthesizer returns (after `const result = await this.synthesizer.synthesize(...)`), before Layer 4, add:

```javascript
// Record recommendations for future diversity
if (userId && result.draftId && result.itineraryData?.days) {
  recommendationHistoryRepo.recordRecommendations(
    userId, context.destination,
    result.itineraryData.days.flatMap(d => d.activities || []),
    result.draftId,
  ).catch(err => logger.warn(
    '[Pipeline] Failed to record recommendations:', err.message,
  ));
}
```

- [ ] **Step 4: Apply same changes in `planStream()` method**

In `planStream()`:
1. Fetch history before Layer 2.75 (same as step 2)
2. Pass `{ previouslyRecommended, destination }` to `getDiverseRecommendations`
3. After the `draft_created` event is captured (around line 317-321), record recommendations:

```javascript
if (event.type === 'draft_created') {
  itineraryData = event.itineraryData;
  // Record recommendations for future diversity
  if (userId && event.draftId && itineraryData?.days) {
    recommendationHistoryRepo.recordRecommendations(
      userId, context.destination,
      itineraryData.days.flatMap(d => d.activities || []),
      event.draftId,
    ).catch(err => logger.warn(
      '[Pipeline] Failed to record recommendations:',
      err.message,
    ));
  }
}
```

- [ ] **Step 5: Verify no syntax errors**

Run: `node -e "import('./src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js').then(() => console.log('OK'))"`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add src/modules/ai/infrastructure/services/pipeline/PlanningPipeline.js
git commit -m "feat(ai): integrate recommendation history into planning pipeline"
```

---

### Task 9: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Verify no startup errors.

- [ ] **Step 2: Create a Hanoi plan**

Send a chat message: "plan du lịch Hà Nội 2 người 3 ngày"

Verify:
- Pipeline completes without errors
- Log shows `[Pipeline] Layer 2.75 done` with `inputPlaces > 80` (increased from diversity angles)
- Log shows `outputPlaces: 35` (increased TARGET_PLACES)
- Draft is created with diverse restaurants (not just MẸT every time)

- [ ] **Step 3: Create a second Hanoi plan for the same user**

Send another message: "lên lịch trình Hà Nội 3 ngày 2 người đi"

Verify:
- Different restaurants/activities appear compared to first plan
- Log confirms recommendation history was fetched and applied
- Some overlap is OK (must-visit landmarks), but restaurants should differ

- [ ] **Step 4: Test international destination**

Send: "plan a 3-day trip to Tokyo for 2 people"

Verify:
- English diversity angle queries are used (not Vietnamese)
- Pipeline completes normally
