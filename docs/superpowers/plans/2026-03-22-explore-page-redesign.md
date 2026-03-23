# Explore Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded explore page with a personalized, dynamic destination discovery experience powered by a hybrid scoring + AI enhancement architecture.

**Architecture:** New `destinations` table as thin overlay on `cached_places`. Backend scoring engine ranks destinations by season/profile/popularity. SSR renders initial results; client-side AI enhancement adds personalized taglines. Reuses existing CacheService, BullMQ, and collection APIs.

**Tech Stack:** Express.js 5, Prisma 6, Redis (CacheService), BullMQ, Next.js 16 (App Router SSR), Zustand, Framer Motion, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-22-explore-page-redesign-design.md`

---

## File Structure

### Backend (new files)

```
src/modules/explore/
├── application/
│   ├── services/
│   │   ├── ScoringService.js          # Destination relevance scoring engine
│   │   └── ExploreEnhancementService.js  # AI enhancement wrapper
│   └── jobs/
│       └── ExploreEnrichmentJob.js    # BullMQ daily enrichment worker
├── infrastructure/
│   └── repositories/
│       └── DestinationRepository.js   # Prisma CRUD + cached queries
└── interfaces/
    └── http/
        ├── exploreController.js       # Request handlers
        └── exploreRoutes.js           # Route definitions

prisma/migrations/YYYYMMDDHHMMSS_add_destinations_table/
```

### Backend (modified files)

```
prisma/schema.prisma                   # Add destinations model
src/index.js                           # Register explore routes + enrichment job
```

### Frontend (new files)

```
src/services/exploreService.ts         # API client for explore endpoints
src/app/(app)/explore/[id]/page.tsx    # Destination detail page (SSR)
src/app/(app)/explore/[id]/layout.tsx  # Detail page metadata
src/components/features/explore/
├── ExploreHero.tsx                    # Hero section with search + seasonal banner
├── DestinationSection.tsx             # Reusable section with title + grid + load more
├── ExploreDestinationCard.tsx         # Enhanced destination card
├── DestinationDetail.tsx              # Detail page content
├── WeatherBadge.tsx                   # Small weather indicator
└── WhyForYouChip.tsx                  # AI enhancement chip
```

### Frontend (modified files)

```
src/app/(app)/explore/page.tsx         # Complete rewrite: SSR + dynamic sections
src/app/(app)/explore/layout.tsx       # Update metadata
```

---

## Task 1: Database — Add Destinations Table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_destinations_table/migration.sql`

- [ ] **Step 1: Add destinations model to Prisma schema**

Add to `prisma/schema.prisma` after the `cached_places` model:

```prisma
enum DestinationRegion {
  SOUTHEAST_ASIA
  EAST_ASIA
  SOUTH_ASIA
  EUROPE
  AMERICAS
  MIDDLE_EAST
  AFRICA
  OCEANIA
}

model destinations {
  id                 String            @id @default(uuid())
  cachedPlaceId      String
  region             DestinationRegion
  tagline            String?
  bestSeasons        String[]          @default([])
  avgDailyBudget     Decimal?          @db.Decimal(10, 2)
  tags               String[]          @default([])
  coverImageAssetIds String[]          @default([])
  popularityScore    Float             @default(0)
  isActive           Boolean           @default(true)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  cached_place       cached_places     @relation(fields: [cachedPlaceId], references: [id])

  @@index([region])
  @@index([isActive])
  @@index([popularityScore])
  @@index([cachedPlaceId])
}
```

Also add the reverse relation to `cached_places` model:

```prisma
// Add inside cached_places model, after existing relations
destinations    destinations[]
```

- [ ] **Step 2: Generate and run migration**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/backend
npx prisma migrate dev --name add_destinations_table
```

Expected: Migration created and applied. `destinations` table exists in PostgreSQL.

- [ ] **Step 3: Verify schema**

```bash
npx prisma db pull --print | grep -A 5 "destinations"
```

Expected: Table with all columns visible.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(explore): add destinations table as overlay on cached_places"
```

---

## Task 2: Backend — DestinationRepository

**Files:**
- Create: `src/modules/explore/infrastructure/repositories/DestinationRepository.js`

- [ ] **Step 1: Create module directory structure**

```bash
mkdir -p src/modules/explore/{application/{services,jobs},infrastructure/repositories,interfaces/http}
```

- [ ] **Step 2: Implement DestinationRepository**

Create `src/modules/explore/infrastructure/repositories/DestinationRepository.js`:

```javascript
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const CACHE_TTL = {
  DESTINATION_DETAIL: 3600,
  DESTINATION_LIST: 600,
  TRENDING: 21600,
};

const CACHE_KEYS = {
  DETAIL: (id) => `explore:dest:${id}`,
  TRENDING: (season) => `explore:trending:${season}`,
  SEARCH: (query, offset) => `explore:search:${query}:${offset}`,
};

const DESTINATION_INCLUDE = {
  cached_place: {
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      countryCode: true,
      latitude: true,
      longitude: true,
      rating: true,
      ratingCount: true,
      photos: true,
      categories: true,
    },
  },
};

class DestinationRepository {
  async findById(id) {
    const cacheKey = CACHE_KEYS.DETAIL(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const destination = await prisma.destinations.findUnique({
      where: { id },
      include: DESTINATION_INCLUDE,
    });

    if (!destination) {
      throw AppError.notFound('Destination not found');
    }

    await cacheService.set(cacheKey, destination, CACHE_TTL.DESTINATION_DETAIL);
    return destination;
  }

  async findActive({ limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: { isActive: true },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async countActive(where = { isActive: true }) {
    return prisma.destinations.count({ where });
  }

  async findByRegion(region, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: { isActive: true, region },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findBySeason(season, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        bestSeasons: { has: season },
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findByTags(tags, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        tags: { hasSome: tags },
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async search(query, { limit = 20, offset = 0 } = {}) {
    const cacheKey = CACHE_KEYS.SEARCH(query, offset);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const lowerQuery = `%${query.toLowerCase()}%`;

    const items = await prisma.$queryRaw`
      SELECT d.*,
        json_build_object(
          'id', cp.id, 'name', cp.name, 'city', cp.city,
          'country', cp.country, 'latitude', cp.latitude,
          'longitude', cp.longitude, 'rating', cp.rating,
          'photos', cp.photos, 'categories', cp.categories
        ) as cached_place
      FROM destinations d
      JOIN cached_places cp ON d."cachedPlaceId" = cp.id
      WHERE d."isActive" = true
        AND (
          LOWER(cp.city) LIKE ${lowerQuery}
          OR LOWER(cp.country) LIKE ${lowerQuery}
          OR LOWER(d.tagline) LIKE ${lowerQuery}
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) t
            WHERE LOWER(t) LIKE ${lowerQuery}
          )
        )
      ORDER BY d."popularityScore" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total
      FROM destinations d
      JOIN cached_places cp ON d."cachedPlaceId" = cp.id
      WHERE d."isActive" = true
        AND (
          LOWER(cp.city) LIKE ${lowerQuery}
          OR LOWER(cp.country) LIKE ${lowerQuery}
          OR LOWER(d.tagline) LIKE ${lowerQuery}
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) t
            WHERE LOWER(t) LIKE ${lowerQuery}
          )
        )
    `;

    const result = {
      items,
      total: countResult[0]?.total ?? 0,
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.DESTINATION_LIST);
    return result;
  }

  async updatePopularityScore(id, score) {
    await prisma.destinations.update({
      where: { id },
      data: { popularityScore: score },
    });
    await cacheService.del(CACHE_KEYS.DETAIL(id));
  }

  async findSimilar(destination, { limit = 6 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        id: { not: destination.id },
        OR: [
          { region: destination.region },
          { tags: { hasSome: destination.tags.slice(0, 3) } },
        ],
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
    });
  }

  async invalidateUserCache(userId) {
    await cacheService.delPattern(`explore:user:${userId}:*`);
  }
}

export default new DestinationRepository();
```

- [ ] **Step 3: Verify import paths resolve**

```bash
node -e "import('./src/modules/explore/infrastructure/repositories/DestinationRepository.js').then(() => console.log('OK')).catch(e => console.error(e.message))"
```

Expected: OK (or Prisma client error if DB not connected, which is fine).

- [ ] **Step 4: Commit**

```bash
git add src/modules/explore/
git commit -m "feat(explore): add DestinationRepository with caching and search"
```

---

## Task 3: Backend — ScoringService

**Files:**
- Create: `src/modules/explore/application/services/ScoringService.js`

- [ ] **Step 1: Implement ScoringService**

Create `src/modules/explore/application/services/ScoringService.js`:

```javascript
import cacheService from '../../../../shared/services/CacheService.js';

const CACHE_TTL = {
  USER_SCORES: 3600,
  GLOBAL_SCORES: 21600,
};

const WEIGHTS = {
  AUTH: { season: 0.25, profile: 0.35, popularity: 0.25, recency: 0.15 },
  GUEST: { season: 0.40, popularity: 0.60 },
};

const MONTH_TO_SEASON_NORTH = {
  0: 'winter', 1: 'winter', 2: 'spring',
  3: 'spring', 4: 'spring', 5: 'summer',
  6: 'summer', 7: 'summer', 8: 'autumn',
  9: 'autumn', 10: 'autumn', 11: 'winter',
};

const FLIP_SEASON = {
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
  winter: 'summer',
};

class ScoringService {
  getSeasonForLatitude(latitude) {
    const month = new Date().getMonth();
    const northSeason = MONTH_TO_SEASON_NORTH[month];
    return latitude >= 0 ? northSeason : FLIP_SEASON[northSeason];
  }

  scoreSeasonMatch(destination) {
    const lat = destination.cached_place?.latitude ?? 0;
    const currentSeason = this.getSeasonForLatitude(lat);
    return destination.bestSeasons.includes(currentSeason) ? 1.0 : 0.2;
  }

  scoreProfileMatch(destination, travelProfile) {
    if (!travelProfile) return 0;

    const profileTypes = travelProfile.travelerTypes ?? [];
    const tagMapping = {
      ADVENTURE: ['adventure', 'nature'],
      LUXURY: ['shopping', 'romantic'],
      BUDGET: ['food', 'culture'],
      CULTURAL: ['culture', 'history'],
      FAMILY: ['family', 'nature'],
      FOODIE: ['food'],
      BEACH: ['beach'],
      NIGHTLIFE: ['nightlife'],
    };

    const relevantTags = profileTypes
      .flatMap((type) => tagMapping[type] ?? []);

    if (relevantTags.length === 0) return 0.5;

    const matchCount = destination.tags
      .filter((tag) => relevantTags.includes(tag)).length;
    return Math.min(matchCount / Math.max(relevantTags.length, 1), 1.0);
  }

  scorePopularity(destination, maxPopularity) {
    if (maxPopularity <= 0) return 0.5;
    return destination.popularityScore / maxPopularity;
  }

  scoreRecency(destination, userTrips) {
    if (!userTrips || userTrips.length === 0) return 1.0;

    const destCity = destination.cached_place?.city?.toLowerCase();
    const recentTrip = userTrips.find((trip) => {
      const tripCities = (trip.activities ?? [])
        .map((a) => a.cached_places?.city?.toLowerCase())
        .filter(Boolean);
      return tripCities.includes(destCity);
    });

    if (!recentTrip) return 1.0;

    const daysSince = Math.floor(
      (Date.now() - new Date(recentTrip.endDate).getTime())
      / (1000 * 60 * 60 * 24)
    );
    return Math.min(daysSince / 365, 1.0);
  }

  scoreDestination(destination, { travelProfile, userTrips, maxPopularity }) {
    const seasonScore = this.scoreSeasonMatch(destination);
    const popularityScore = this.scorePopularity(destination, maxPopularity);

    if (!travelProfile) {
      const w = WEIGHTS.GUEST;
      return seasonScore * w.season + popularityScore * w.popularity;
    }

    const profileScore = this.scoreProfileMatch(destination, travelProfile);
    const recencyScore = this.scoreRecency(destination, userTrips);
    const w = WEIGHTS.AUTH;

    return (
      seasonScore * w.season
      + profileScore * w.profile
      + popularityScore * w.popularity
      + recencyScore * w.recency
    );
  }

  rankDestinations(destinations, context) {
    const maxPopularity = Math.max(
      ...destinations.map((d) => d.popularityScore),
      1,
    );

    return destinations
      .map((dest) => ({
        ...dest,
        score: this.scoreDestination(dest, {
          ...context,
          maxPopularity,
        }),
      }))
      .sort((a, b) => b.score - a.score);
  }

  async getRankedDestinations(destinations, context, cacheKey) {
    if (cacheKey) {
      const cached = await cacheService.get(cacheKey);
      if (cached) return cached;
    }

    const ranked = this.rankDestinations(destinations, context);

    if (cacheKey) {
      const ttl = context.travelProfile
        ? CACHE_TTL.USER_SCORES
        : CACHE_TTL.GLOBAL_SCORES;
      await cacheService.set(cacheKey, ranked, ttl);
    }

    return ranked;
  }
}

export default new ScoringService();
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/explore/application/services/ScoringService.js
git commit -m "feat(explore): add hemisphere-aware scoring engine"
```

---

## Task 4: Backend — ExploreController and Routes

**Files:**
- Create: `src/modules/explore/interfaces/http/exploreController.js`
- Create: `src/modules/explore/interfaces/http/exploreRoutes.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement exploreController**

Create `src/modules/explore/interfaces/http/exploreController.js`:

```javascript
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { sendSuccess } from '../../../../shared/utils/response.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import destinationRepository from '../../infrastructure/repositories/DestinationRepository.js';
import scoringService from '../../application/services/ScoringService.js';
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

const SECTION_LIMIT = 8;

async function getUserContext(userId) {
  if (!userId) return { travelProfile: null, userTrips: null };

  const [travelProfile, userTrips] = await Promise.all([
    prisma.travel_profiles.findUnique({ where: { userId } }),
    prisma.trips.findMany({
      where: { userId, status: { in: ['COMPLETED', 'ACTIVE'] } },
      select: {
        endDate: true,
        itinerary_days: {
          select: {
            activities: {
              select: {
                cached_places: {
                  select: { city: true },
                },
              },
            },
          },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    }),
  ]);

  const flatTrips = userTrips.map((trip) => ({
    endDate: trip.endDate,
    activities: trip.itinerary_days.flatMap((d) => d.activities),
  }));

  return { travelProfile, userTrips: flatTrips };
}

export const getExplore = asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? null;
  const section = req.query.section ?? null;
  const limit = Math.min(parseInt(req.query.limit, 10) || SECTION_LIMIT, 50);
  const offset = parseInt(req.query.offset, 10) || 0;

  const allDestinations = await destinationRepository.findActive({
    limit: 200,
    offset: 0,
  });

  const { travelProfile, userTrips } = await getUserContext(userId);
  const context = { travelProfile, userTrips };

  if (section) {
    const sectionData = await buildSection(
      section, allDestinations, context, limit, offset,
    );
    return sendSuccess(res, sectionData);
  }

  const sections = userId
    ? await buildAuthSections(allDestinations, context, limit)
    : await buildGuestSections(allDestinations, context, limit);

  return sendSuccess(res, sections);
});

async function buildSection(name, destinations, context, limit, offset) {
  const ranked = scoringService.rankDestinations(destinations, context);
  let filtered;

  switch (name) {
    case 'forYou':
      filtered = ranked;
      break;
    case 'trending':
      filtered = ranked.filter((d) =>
        scoringService.scoreSeasonMatch(d) > 0.5,
      );
      break;
    case 'budgetFriendly':
      filtered = ranked.filter(
        (d) => d.avgDailyBudget && parseFloat(d.avgDailyBudget) <= 60,
      );
      break;
    default:
      filtered = ranked;
  }

  const items = filtered.slice(offset, offset + limit);
  return {
    items,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
}

async function buildAuthSections(destinations, context, limit) {
  const ranked = scoringService.rankDestinations(destinations, context);

  const trending = ranked.filter((d) =>
    scoringService.scoreSeasonMatch(d) > 0.5,
  );

  const budgetFriendly = ranked.filter(
    (d) => d.avgDailyBudget && parseFloat(d.avgDailyBudget) <= 60,
  );

  return {
    forYou: paginate(ranked, limit),
    trending: paginate(trending, limit),
    budgetFriendly: paginate(budgetFriendly, limit),
  };
}

async function buildGuestSections(destinations, context, limit) {
  const ranked = scoringService.rankDestinations(destinations, context);

  const trending = ranked.filter((d) =>
    scoringService.scoreSeasonMatch(d) > 0.5,
  );

  return {
    trending: paginate(trending, limit),
    popular: paginate(ranked, limit),
  };
}

function paginate(items, limit) {
  return {
    items: items.slice(0, limit),
    total: items.length,
    hasMore: items.length > limit,
  };
}

export const getDestination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const destination = await destinationRepository.findById(id);

  const [similar, weather] = await Promise.all([
    destinationRepository.findSimilar(destination),
    fetchWeather(destination.cached_place),
  ]);

  return sendSuccess(res, {
    destination,
    weather,
    similarDestinations: similar,
  });
});

async function fetchWeather(place) {
  if (!place.latitude || !place.longitude) return null;

  const cacheKey = `explore:weather:${place.latitude}:${place.longitude}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=7`;
    const response = await fetch(url);
    const data = await response.json();

    const weather = {
      current: {
        temperature: data.current?.temperature_2m,
        weatherCode: data.current?.weather_code,
      },
      forecast: data.daily?.time?.map((date, i) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        weatherCode: data.daily.weather_code[i],
      })) ?? [],
    };

    await cacheService.set(cacheKey, weather, 10800); // 3h TTL
    return weather;
  } catch {
    return null;
  }
}

export const searchDestinations = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  if (!query || query.length < 2) {
    throw AppError.badRequest('Search query must be at least 2 characters');
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  const offset = parseInt(req.query.offset, 10) || 0;

  const result = await destinationRepository.search(query, { limit, offset });

  return sendSuccess(res, {
    items: result.items,
    total: result.total,
    hasMore: offset + limit < result.total,
  });
});
```

- [ ] **Step 2: Implement exploreRoutes**

Create `src/modules/explore/interfaces/http/exploreRoutes.js`:

```javascript
import { Router } from 'express';
import { optionalAuth } from '../../../../shared/middleware/authenticate.js';
import * as exploreController from './exploreController.js';

const router = Router();

router.get('/', optionalAuth, exploreController.getExplore);
router.get('/search', optionalAuth, exploreController.searchDestinations);
router.get('/destinations/:id', optionalAuth, exploreController.getDestination);

export default router;
```

- [ ] **Step 3: Register routes in main app**

In `src/index.js`, add the import and route registration alongside existing routes:

```javascript
// Import (add near other route imports)
import exploreRoutes from './modules/explore/interfaces/http/exploreRoutes.js';

// Route registration (add near other app.use lines)
app.use('/api/explore', exploreRoutes);
```

- [ ] **Step 4: Verify routes load**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/backend
node -e "import('./src/modules/explore/interfaces/http/exploreRoutes.js').then(() => console.log('Routes OK')).catch(e => console.error(e))"
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/explore/interfaces/http/ src/index.js
git commit -m "feat(explore): add explore API endpoints with optional auth"
```

---

## Task 5: Backend — AI Enhancement Endpoint

**Files:**
- Create: `src/modules/explore/application/services/ExploreEnhancementService.js`
- Modify: `src/modules/explore/interfaces/http/exploreController.js`
- Modify: `src/modules/explore/interfaces/http/exploreRoutes.js`

- [ ] **Step 1: Implement ExploreEnhancementService**

Create `src/modules/explore/application/services/ExploreEnhancementService.js`:

```javascript
import cacheService from '../../../../shared/services/CacheService.js';
import prisma from '../../../../config/database.js';
import { getFastModel } from '../../../ai/infrastructure/services/provider.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const CACHE_TTL = 86400; // 24 hours

class ExploreEnhancementService {
  getModel() {
    return getFastModel();
  }

  async enhance(destinationIds, userId) {
    const cacheKey = `explore:enhance:${userId}:${destinationIds.sort().join(',')}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const [destinations, profile] = await Promise.all([
      prisma.destinations.findMany({
        where: { id: { in: destinationIds } },
        include: {
          cached_place: {
            select: { city: true, country: true, categories: true },
          },
        },
      }),
      prisma.travel_profiles.findUnique({ where: { userId } }),
    ]);

    if (!profile || destinations.length === 0) {
      return { enhancements: {} };
    }

    const prompt = this.buildPrompt(destinations, profile);

    try {
      const model = this.getModel();
      const response = await model.invoke(prompt);
      const parsed = this.parseResponse(response.content, destinationIds);

      await cacheService.set(cacheKey, parsed, CACHE_TTL);
      return parsed;
    } catch (error) {
      logger.warn('[ExploreEnhancement] AI enhancement failed', {
        error: error.message,
      });
      return { enhancements: {} };
    }
  }

  buildPrompt(destinations, profile) {
    const destList = destinations
      .map((d) => `- ${d.cached_place.city}, ${d.cached_place.country} (tags: ${d.tags.join(', ')})`)
      .join('\n');

    const profileDesc = [
      profile.travelerTypes?.length
        ? `Traveler types: ${profile.travelerTypes.join(', ')}`
        : null,
      profile.spendingHabits
        ? `Spending: ${profile.spendingHabits}`
        : null,
      profile.dailyRhythm
        ? `Daily rhythm: ${profile.dailyRhythm}`
        : null,
      profile.socialPreference
        ? `Social preference: ${profile.socialPreference}`
        : null,
    ].filter(Boolean).join('. ');

    return `You are a travel recommendation assistant. Given a user profile and destinations, generate personalized taglines and explanations.

User Profile: ${profileDesc}

Destinations:
${destList}

For each destination, respond with ONLY valid JSON (no markdown, no code blocks):
{
  "enhancements": {
    "<destination_id>": {
      "personalizedTagline": "<short catchy tagline for this user, max 60 chars>",
      "whyForYou": "<1 sentence explaining why this matches their profile>"
    }
  }
}

Destination IDs in order: ${destinations.map((d) => d.id).join(', ')}`;
  }

  parseResponse(content, destinationIds) {
    try {
      const cleaned = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.enhancements) return { enhancements: {} };

      const valid = {};
      for (const id of destinationIds) {
        if (parsed.enhancements[id]) {
          valid[id] = {
            personalizedTagline:
              parsed.enhancements[id].personalizedTagline ?? '',
            whyForYou: parsed.enhancements[id].whyForYou ?? '',
          };
        }
      }

      return { enhancements: valid };
    } catch {
      return { enhancements: {} };
    }
  }
}

export default new ExploreEnhancementService();
```

- [ ] **Step 2: Add enhance endpoint to controller**

Append to `src/modules/explore/interfaces/http/exploreController.js`:

```javascript
import enhancementService from '../../application/services/ExploreEnhancementService.js';

export const enhanceDestinations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { destinationIds } = req.body;

  if (!Array.isArray(destinationIds) || destinationIds.length === 0) {
    throw AppError.badRequest('destinationIds must be a non-empty array');
  }

  if (destinationIds.length > 20) {
    throw AppError.badRequest('Maximum 20 destinations per request');
  }

  const result = await enhancementService.enhance(destinationIds, userId);
  return sendSuccess(res, result);
});
```

- [ ] **Step 3: Add enhance route with rate limiting**

Update `src/modules/explore/interfaces/http/exploreRoutes.js`:

```javascript
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, optionalAuth } from '../../../../shared/middleware/authenticate.js';
import * as exploreController from './exploreController.js';

const router = Router();

const enhanceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many enhancement requests' } },
});

router.get('/', optionalAuth, exploreController.getExplore);
router.get('/search', optionalAuth, exploreController.searchDestinations);
router.get('/destinations/:id', optionalAuth, exploreController.getDestination);
router.post('/enhance', authenticate, enhanceRateLimiter, exploreController.enhanceDestinations);

export default router;
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/explore/
git commit -m "feat(explore): add AI enhancement endpoint with rate limiting"
```

---

## Task 6: Backend — Data Seed Script

**Files:**
- Create: `src/modules/explore/scripts/seedDestinations.js`

- [ ] **Step 1: Create seed script**

This script migrates the 20 hardcoded destinations from the frontend into the database. It creates `cached_places` entries if they don't exist and links them to `destinations`.

Create `src/modules/explore/scripts/seedDestinations.js`:

```javascript
import prisma from '../../../config/database.js';

const SEED_DESTINATIONS = [
  {
    city: 'Bangkok', country: 'Thailand', region: 'SOUTHEAST_ASIA',
    tagline: 'Street food capital meets temple grandeur',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 35,
    tags: ['food', 'culture', 'nightlife', 'shopping'],
    lat: 13.7563, lng: 100.5018,
  },
  {
    city: 'Hanoi', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Ancient charm meets vibrant street life',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 30,
    tags: ['culture', 'food', 'history'],
    lat: 21.0285, lng: 105.8542,
  },
  {
    city: 'Bali', country: 'Indonesia', region: 'SOUTHEAST_ASIA',
    tagline: 'Island of gods and endless sunsets',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 45,
    tags: ['beach', 'culture', 'nature', 'romantic'],
    lat: -8.3405, lng: 115.092,
  },
  {
    city: 'Singapore', country: 'Singapore', region: 'SOUTHEAST_ASIA',
    tagline: 'Future-forward city with hawker heritage',
    bestSeasons: ['spring', 'winter'], avgDailyBudget: 80,
    tags: ['food', 'shopping', 'culture'],
    lat: 1.3521, lng: 103.8198,
  },
  {
    city: 'Tokyo', country: 'Japan', region: 'EAST_ASIA',
    tagline: 'Where tradition dances with innovation',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 70,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 35.6762, lng: 139.6503,
  },
  {
    city: 'Seoul', country: 'South Korea', region: 'EAST_ASIA',
    tagline: 'K-culture epicenter with palace-lined streets',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 55,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 37.5665, lng: 126.978,
  },
  {
    city: 'Taipei', country: 'Taiwan', region: 'EAST_ASIA',
    tagline: 'Night market paradise with mountain escapes',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['food', 'culture', 'nature', 'nightlife'],
    lat: 25.033, lng: 121.5654,
  },
  {
    city: 'Paris', country: 'France', region: 'EUROPE',
    tagline: 'The city of light, love, and croissants',
    bestSeasons: ['spring', 'summer', 'autumn'], avgDailyBudget: 120,
    tags: ['culture', 'food', 'romantic', 'history'],
    lat: 48.8566, lng: 2.3522,
  },
  {
    city: 'Barcelona', country: 'Spain', region: 'EUROPE',
    tagline: "Gaudí's playground by the Mediterranean",
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 80,
    tags: ['beach', 'culture', 'food', 'nightlife'],
    lat: 41.3874, lng: 2.1686,
  },
  {
    city: 'Rome', country: 'Italy', region: 'EUROPE',
    tagline: 'Eternal city of gelato and gladiators',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 90,
    tags: ['history', 'food', 'culture', 'romantic'],
    lat: 41.9028, lng: 12.4964,
  },
  {
    city: 'London', country: 'United Kingdom', region: 'EUROPE',
    tagline: 'Royal heritage meets multicultural buzz',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 130,
    tags: ['culture', 'history', 'shopping', 'nightlife'],
    lat: 51.5074, lng: -0.1278,
  },
  {
    city: 'New York', country: 'United States', region: 'AMERICAS',
    tagline: 'The city that never sleeps',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 150,
    tags: ['culture', 'food', 'shopping', 'nightlife'],
    lat: 40.7128, lng: -74.006,
  },
  {
    city: 'Cancun', country: 'Mexico', region: 'AMERICAS',
    tagline: 'Caribbean blues and Mayan ruins',
    bestSeasons: ['winter', 'spring'], avgDailyBudget: 70,
    tags: ['beach', 'adventure', 'nightlife', 'history'],
    lat: 21.1619, lng: -86.8515,
  },
  {
    city: 'Dubai', country: 'UAE', region: 'MIDDLE_EAST',
    tagline: 'Desert luxury and record-breaking skyline',
    bestSeasons: ['winter', 'autumn'], avgDailyBudget: 120,
    tags: ['shopping', 'adventure', 'culture'],
    lat: 25.2048, lng: 55.2708,
  },
  {
    city: 'Istanbul', country: 'Turkey', region: 'MIDDLE_EAST',
    tagline: 'Where East meets West over Turkish tea',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 50,
    tags: ['culture', 'food', 'history', 'shopping'],
    lat: 41.0082, lng: 28.9784,
  },
  {
    city: 'Cape Town', country: 'South Africa', region: 'AFRICA',
    tagline: 'Table Mountain views and coastal wonders',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 55,
    tags: ['nature', 'adventure', 'beach', 'food'],
    lat: -33.9249, lng: 18.4241,
  },
  {
    city: 'Marrakech', country: 'Morocco', region: 'AFRICA',
    tagline: 'Spice-scented souks and riad retreats',
    bestSeasons: ['spring', 'autumn'], avgDailyBudget: 40,
    tags: ['culture', 'food', 'shopping', 'history'],
    lat: 31.6295, lng: -7.9811,
  },
  {
    city: 'Sydney', country: 'Australia', region: 'OCEANIA',
    tagline: 'Harbor icons and sun-kissed beaches',
    bestSeasons: ['summer', 'spring'], avgDailyBudget: 110,
    tags: ['beach', 'culture', 'food', 'nature'],
    lat: -33.8688, lng: 151.2093,
  },
  {
    city: 'Queenstown', country: 'New Zealand', region: 'OCEANIA',
    tagline: 'Adventure capital of the Southern Alps',
    bestSeasons: ['summer', 'autumn'], avgDailyBudget: 100,
    tags: ['adventure', 'nature', 'romantic'],
    lat: -45.0312, lng: 168.6626,
  },
  {
    city: 'Da Nang', country: 'Vietnam', region: 'SOUTHEAST_ASIA',
    tagline: 'Coastal charm between two UNESCO sites',
    bestSeasons: ['spring', 'summer'], avgDailyBudget: 30,
    tags: ['beach', 'food', 'culture', 'nature'],
    lat: 16.0544, lng: 108.2022,
  },
];

export async function seedDestinations() {
  console.log('Seeding destinations...');
  let created = 0;
  let skipped = 0;

  for (const dest of SEED_DESTINATIONS) {
    const existingPlace = await prisma.cached_places.findFirst({
      where: {
        city: dest.city,
        country: dest.country,
      },
    });

    let placeId;
    if (existingPlace) {
      placeId = existingPlace.id;
    } else {
      const newPlace = await prisma.cached_places.create({
        data: {
          externalId: `seed-${dest.city.toLowerCase().replace(/\s+/g, '-')}`,
          provider: 'seed',
          name: dest.city,
          type: 'CITY',
          city: dest.city,
          country: dest.country,
          latitude: dest.lat,
          longitude: dest.lng,
          photos: [],
          categories: dest.tags,
        },
      });
      placeId = newPlace.id;
    }

    const existingDest = await prisma.destinations.findFirst({
      where: { cachedPlaceId: placeId },
    });

    if (existingDest) {
      skipped++;
      continue;
    }

    await prisma.destinations.create({
      data: {
        cachedPlaceId: placeId,
        region: dest.region,
        tagline: dest.tagline,
        bestSeasons: dest.bestSeasons,
        avgDailyBudget: dest.avgDailyBudget,
        tags: dest.tags,
        coverImageAssetIds: [],
        popularityScore: Math.random() * 50 + 10,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`Seed complete: ${created} created, ${skipped} skipped`);
}

// Allow running directly: node src/modules/explore/scripts/seedDestinations.js
const isDirectRun = process.argv[1]?.includes('seedDestinations');
if (isDirectRun) {
  seedDestinations()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Run the seed**

```bash
node src/modules/explore/scripts/seedDestinations.js
```

Expected: `Seed complete: 20 created, 0 skipped`

- [ ] **Step 3: Verify data**

```bash
npx prisma studio
```

Or via psql: check `destinations` table has 20 rows with `cached_place` relations.

- [ ] **Step 4: Commit**

```bash
git add src/modules/explore/scripts/
git commit -m "feat(explore): add destination seed script with 20 initial destinations"
```

---

## Task 7: Backend — BullMQ Enrichment Job

**Files:**
- Create: `src/modules/explore/application/jobs/ExploreEnrichmentJob.js`
- Modify: `src/index.js`

- [ ] **Step 1: Implement enrichment job**

Create `src/modules/explore/application/jobs/ExploreEnrichmentJob.js`:

```javascript
import { Queue, Worker } from 'bullmq';
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

function parseRedisUrl(redisUrl) {
  if (!redisUrl) return null;
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || '127.0.0.1',
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
    };
  } catch {
    return null;
  }
}

class ExploreEnrichmentJob {
  constructor() {
    this.queue = null;
    this.worker = null;
  }

  init() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn('[ExploreEnrichment] No REDIS_URL, skipping job init');
      return;
    }

    const connection = parseRedisUrl(redisUrl);

    this.queue = new Queue('explore-enrichment', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    this.worker = new Worker(
      'explore-enrichment',
      (job) => this.processJob(job),
      {
        connection,
        concurrency: 2,
        limiter: { max: 5, duration: 1000 },
      },
    );

    this.worker.on('completed', (job) => {
      logger.debug(`[ExploreEnrichment] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.warn(`[ExploreEnrichment] Job ${job.id} failed: ${err.message}`);
    });

    this.scheduleDaily();
    logger.info('[ExploreEnrichment] Job worker initialized');
  }

  async processJob(job) {
    const { type } = job.data;

    switch (type) {
      case 'update-popularity':
        await this.updatePopularityScores();
        break;
      default:
        logger.warn(`[ExploreEnrichment] Unknown job type: ${type}`);
    }
  }

  async updatePopularityScores() {
    const destinations = await prisma.destinations.findMany({
      where: { isActive: true },
      select: { id: true, cachedPlaceId: true },
    });

    for (const dest of destinations) {
      const [saveCount, tripCount] = await Promise.all([
        prisma.saved_places.count({
          where: { placeId: dest.cachedPlaceId },
        }),
        prisma.activities.count({
          where: { placeId: dest.cachedPlaceId },
        }),
      ]);

      const score = saveCount * 2 + tripCount * 5;

      await prisma.destinations.update({
        where: { id: dest.id },
        data: { popularityScore: score },
      });
    }

    logger.info(
      `[ExploreEnrichment] Updated popularity for ${destinations.length} destinations`,
    );
  }

  async scheduleDaily() {
    await this.queue.add(
      'daily-enrichment',
      { type: 'update-popularity' },
      {
        repeat: { pattern: '0 3 * * *' },
        jobId: 'daily-popularity-update',
      },
    );
  }

  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

export default new ExploreEnrichmentJob();
```

- [ ] **Step 2: Register job in main app**

In `src/index.js`, add initialization and shutdown:

```javascript
// Import
import exploreEnrichmentJob from './modules/explore/application/jobs/ExploreEnrichmentJob.js';

// In startServer(), after imageQueueService.init():
exploreEnrichmentJob.init();

// In gracefulShutdown(), add:
try { await exploreEnrichmentJob.close(); } catch {}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/explore/application/jobs/ src/index.js
git commit -m "feat(explore): add daily popularity enrichment BullMQ job"
```

---

## Task 8: Frontend — Explore Service

**Files:**
- Create: `frontend/src/services/exploreService.ts`

- [ ] **Step 1: Create exploreService**

Create `frontend/src/services/exploreService.ts`:

```typescript
import api from '@/src/lib/api';

export interface DestinationPlace {
  id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  photos: string[];
  categories: string[];
}

export interface Destination {
  id: string;
  cachedPlaceId: string;
  region: string;
  tagline: string | null;
  bestSeasons: string[];
  avgDailyBudget: number | null;
  tags: string[];
  coverImageAssetIds: string[];
  popularityScore: number;
  isActive: boolean;
  cached_place: DestinationPlace;
  score?: number;
}

export interface PaginatedSection {
  items: Destination[];
  total: number;
  hasMore: boolean;
}

export interface ExploreResponse {
  forYou?: PaginatedSection;
  trending: PaginatedSection;
  budgetFriendly?: PaginatedSection;
  popular?: PaginatedSection;
}

export interface Enhancement {
  personalizedTagline: string;
  whyForYou: string;
}

export interface EnhanceResponse {
  enhancements: Record<string, Enhancement>;
}

export interface SearchResponse {
  items: Destination[];
  total: number;
  hasMore: boolean;
}

class ExploreService {
  async getExplore(): Promise<ExploreResponse> {
    const { data } = await api.get('/explore');
    return data.data;
  }

  async getSection(
    section: string,
    limit = 8,
    offset = 0,
  ): Promise<PaginatedSection> {
    const { data } = await api.get('/explore', {
      params: { section, limit, offset },
    });
    return data.data;
  }

  async getDestination(id: string) {
    const { data } = await api.get(`/explore/destinations/${id}`);
    return data.data;
  }

  async search(query: string, limit = 20, offset = 0): Promise<SearchResponse> {
    const { data } = await api.get('/explore/search', {
      params: { q: query, limit, offset },
    });
    return data.data;
  }

  async enhance(destinationIds: string[]): Promise<EnhanceResponse> {
    const { data } = await api.post('/explore/enhance', { destinationIds });
    return data.data;
  }
}

const exploreService = new ExploreService();
export default exploreService;
```

- [ ] **Step 2: Commit**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
git add frontend/src/services/exploreService.ts
git commit -m "feat(explore): add frontend explore API service"
```

---

## Task 9: Frontend — Explore Page Components

**Files:**
- Create: `frontend/src/components/features/explore/ExploreHero.tsx`
- Create: `frontend/src/components/features/explore/ExploreDestinationCard.tsx`
- Create: `frontend/src/components/features/explore/DestinationSection.tsx`
- Create: `frontend/src/components/features/explore/WeatherBadge.tsx`
- Create: `frontend/src/components/features/explore/WhyForYouChip.tsx`

- [ ] **Step 1: Create WeatherBadge component**

Create `frontend/src/components/features/explore/WeatherBadge.tsx`:

```tsx
'use client';

import { Sun, Cloud, CloudRain, Snowflake } from '@phosphor-icons/react';

interface WeatherBadgeProps {
  temperature?: number;
  condition?: string;
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
};

export default function WeatherBadge({
  temperature,
  condition = 'sunny',
}: WeatherBadgeProps) {
  if (temperature === undefined) return null;

  const Icon = WEATHER_ICONS[condition] ?? Sun;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur-sm">
      <Icon size={14} weight="fill" />
      <span>{temperature}°</span>
    </div>
  );
}
```

- [ ] **Step 2: Create WhyForYouChip component**

Create `frontend/src/components/features/explore/WhyForYouChip.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { Sparkle } from '@phosphor-icons/react';

interface WhyForYouChipProps {
  text: string;
}

export default function WhyForYouChip({ text }: WhyForYouChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-3 py-1 text-xs text-[var(--primary-main)]"
    >
      <Sparkle size={12} weight="fill" />
      <span className="line-clamp-1">{text}</span>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create ExploreDestinationCard component**

Create `frontend/src/components/features/explore/ExploreDestinationCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  MapPin,
  CurrencyCircleDollar,
  CalendarBlank,
  BookmarkSimple,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import WhyForYouChip from '@/src/components/features/explore/WhyForYouChip';
import type { Destination, Enhancement } from '@/src/services/exploreService';

interface ExploreDestinationCardProps {
  destination: Destination;
  enhancement?: Enhancement;
  index?: number;
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

const TAG_COLORS: Record<string, string> = {
  culture: 'bg-purple-100 text-purple-700',
  beach: 'bg-blue-100 text-blue-700',
  food: 'bg-orange-100 text-orange-700',
  adventure: 'bg-green-100 text-green-700',
  nightlife: 'bg-pink-100 text-pink-700',
  nature: 'bg-emerald-100 text-emerald-700',
  history: 'bg-amber-100 text-amber-700',
  shopping: 'bg-rose-100 text-rose-700',
  romantic: 'bg-red-100 text-red-700',
  family: 'bg-sky-100 text-sky-700',
};

export default function ExploreDestinationCard({
  destination,
  enhancement,
  index = 0,
  onPlanTrip,
  onSave,
}: ExploreDestinationCardProps) {
  const place = destination.cached_place;
  const imageUrl = place.photos?.[0] ?? '/images/placeholder-destination.jpg';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-xl border border-[var(--neutral-30)] bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={imageUrl}
          alt={`${place.city}, ${place.country}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Season badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium">
          <CalendarBlank size={12} />
          {destination.bestSeasons.slice(0, 2).join(', ')}
        </div>

        {/* Save button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSave(destination); }}
          className="absolute top-3 right-3 rounded-full bg-white/80 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
        >
          <BookmarkSimple size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-[var(--neutral-60)]">
          <MapPin size={14} weight="fill" />
          <span className="font-semibold text-[var(--neutral-90)]">
            {place.city}
          </span>
          <span>, {place.country}</span>
        </div>

        {/* Tagline */}
        <p className="line-clamp-1 text-sm text-[var(--neutral-60)]">
          {enhancement?.personalizedTagline ?? destination.tagline ?? ''}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[var(--neutral-50)]">
          {destination.avgDailyBudget && (
            <span className="flex items-center gap-1">
              <CurrencyCircleDollar size={14} />
              ~${Number(destination.avgDailyBudget)}/day
            </span>
          )}
          {place.rating && (
            <span className="flex items-center gap-1">
              ⭐ {place.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {destination.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Why for you */}
        {enhancement?.whyForYou && (
          <WhyForYouChip text={enhancement.whyForYou} />
        )}

        {/* Plan Trip button */}
        <button
          onClick={() => onPlanTrip(destination)}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary-main)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          <PaperPlaneTilt size={16} weight="fill" />
          Plan Trip
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Create DestinationSection component**

Create `frontend/src/components/features/explore/DestinationSection.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import exploreService from '@/src/services/exploreService';
import type { Destination, Enhancement } from '../../../services/exploreService';

interface DestinationSectionProps {
  title: string;
  subtitle?: string;
  sectionKey: string;
  initialItems: Destination[];
  initialTotal: number;
  initialHasMore: boolean;
  enhancements?: Record<string, Enhancement>;
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

export default function DestinationSection({
  title,
  subtitle,
  sectionKey,
  initialItems,
  initialTotal,
  initialHasMore,
  enhancements = {},
  onPlanTrip,
  onSave,
}: DestinationSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const data = await exploreService.getSection(
        sectionKey,
        8,
        items.length,
      );
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, items.length, sectionKey]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[var(--neutral-90)]">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--neutral-50)]">{subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((dest, i) => (
          <ExploreDestinationCard
            key={dest.id}
            destination={dest}
            enhancement={enhancements[dest.id]}
            index={i}
            onPlanTrip={onPlanTrip}
            onSave={onSave}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-[var(--neutral-30)] px-6 py-2 text-sm font-medium text-[var(--neutral-70)] transition-colors hover:bg-[var(--neutral-10)] disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Show more (${initialTotal - items.length} remaining)`}
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Create ExploreHero component**

Create `frontend/src/components/features/explore/ExploreHero.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MagnifyingGlass, Compass } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';

interface ExploreHeroProps {
  seasonalBanner: string;
  onSearch: (query: string) => void;
}

export default function ExploreHero({
  seasonalBanner,
  onSearch,
}: ExploreHeroProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) onSearch(query.trim());
    },
    [query, onSearch],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <Compass size={32} weight="duotone" className="text-[var(--primary-main)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--neutral-90)]">
            Explore Destinations
          </h1>
          <p className="text-sm text-[var(--primary-main)]">{seasonalBanner}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative max-w-xl">
        <MagnifyingGlass
          size={20}
          className="absolute top-1/2 left-4 -translate-y-1/2 text-[var(--neutral-40)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search destinations, countries, or tags..."
          className="w-full rounded-xl border border-[var(--neutral-30)] bg-white py-3 pr-4 pl-11 text-sm outline-none transition-colors focus:border-[var(--primary-main)] focus:ring-2 focus:ring-[var(--primary-surface)]"
        />
      </form>
    </motion.div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
git add frontend/src/components/features/explore/
git commit -m "feat(explore): add explore page UI components"
```

---

## Task 10: Frontend — Rewrite Explore Page (SSR)

**Files:**
- Modify: `frontend/src/app/(app)/explore/page.tsx` (complete rewrite)
- Modify: `frontend/src/app/(app)/explore/layout.tsx`

- [ ] **Step 1: Rewrite the explore page**

Replace the entire content of `frontend/src/app/(app)/explore/page.tsx`. The page is a client component that fetches data on mount (the backend SSR support means the API returns fast cached responses).

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ExploreHero from '@/src/components/features/explore/ExploreHero';
import DestinationSection from '@/src/components/features/explore/DestinationSection';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import useChatStore from '@/src/stores/chatStore';
import exploreService from '@/src/services/exploreService';
import type {
  Destination,
  ExploreResponse,
  Enhancement,
  SearchResponse,
} from '@/src/services/exploreService';

const SEASON_BANNERS: Record<string, string> = {
  spring: '🌸 Spring escapes — cherry blossoms & fresh beginnings',
  summer: '☀️ Summer adventures — beaches, festivals & long days',
  autumn: '🍂 Autumn colors — cozy cities & harvest festivals',
  winter: '❄️ Winter wonders — snow peaks & warm getaways',
};

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

export default function ExplorePage() {
  const router = useRouter();
  const createConversation = useChatStore((s) => s.createConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [exploreData, setExploreData] = useState<ExploreResponse | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [enhancements, setEnhancements] = useState<Record<string, Enhancement>>({});
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const season = getCurrentSeason();
  const banner = SEASON_BANNERS[season];

  useEffect(() => {
    async function load() {
      try {
        const data = await exploreService.getExplore();
        setExploreData(data);

        // AI enhancement async
        const allIds = [
          ...(data.forYou?.items ?? []),
          ...(data.trending?.items ?? []),
        ].map((d) => d.id).slice(0, 16);

        if (allIds.length > 0) {
          try {
            const enhanced = await exploreService.enhance(allIds);
            setEnhancements(enhanced.enhancements);
          } catch {
            // AI enhancement is optional
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePlanTrip = useCallback(
    async (dest: Destination) => {
      const place = dest.cached_place;
      const message = `Plan a trip to ${place.city}, ${place.country}`;
      const conversationId = await createConversation(undefined, message);
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
        setTimeout(() => sendMessage(message), 300);
      }
    },
    [createConversation, sendMessage, router],
  );

  const handleSave = useCallback((dest: Destination) => {
    router.push(`/collections?save=${dest.cachedPlaceId}`);
  }, [router]);

  const handleSearch = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const results = await exploreService.search(query);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 space-y-8 overflow-y-auto p-4 md:p-6">
        <div className="h-20 animate-pulse rounded-xl bg-[var(--neutral-20)]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--neutral-20)]" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-80 animate-pulse rounded-xl bg-[var(--neutral-20)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 overflow-y-auto p-4 md:p-6">
      <ExploreHero seasonalBanner={banner} onSearch={handleSearch} />

      {searchResults ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {searchResults.total} results found
            </h2>
            <button
              onClick={clearSearch}
              className="text-sm text-[var(--primary-main)] hover:underline"
            >
              Clear search
            </button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {searchResults.items.map((dest, i) => (
              <ExploreDestinationCard
                key={dest.id}
                destination={dest}
                index={i}
                onPlanTrip={handlePlanTrip}
                onSave={handleSave}
              />
            ))}
          </div>
          {searchResults.items.length === 0 && (
            <p className="py-12 text-center text-[var(--neutral-50)]">
              No destinations found. Try a different search term.
            </p>
          )}
        </div>
      ) : (
        <>
          {exploreData?.forYou && (
            <DestinationSection
              title="For You"
              subtitle="Personalized picks based on your travel profile"
              sectionKey="forYou"
              initialItems={exploreData.forYou.items}
              initialTotal={exploreData.forYou.total}
              initialHasMore={exploreData.forYou.hasMore}
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.trending && (
            <DestinationSection
              title="Trending This Season"
              subtitle={`Popular destinations for ${season}`}
              sectionKey="trending"
              initialItems={exploreData.trending.items}
              initialTotal={exploreData.trending.total}
              initialHasMore={exploreData.trending.hasMore}
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.budgetFriendly && (
            <DestinationSection
              title="Budget-Friendly Picks"
              subtitle="Great destinations under $60/day"
              sectionKey="budgetFriendly"
              initialItems={exploreData.budgetFriendly.items}
              initialTotal={exploreData.budgetFriendly.total}
              initialHasMore={exploreData.budgetFriendly.hasMore}
              enhancements={enhancements}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {exploreData?.popular && (
            <DestinationSection
              title="Popular Destinations"
              subtitle="Most loved by travelers worldwide"
              sectionKey="popular"
              initialItems={exploreData.popular.items}
              initialTotal={exploreData.popular.total}
              initialHasMore={exploreData.popular.hasMore}
              onPlanTrip={handlePlanTrip}
              onSave={handleSave}
            />
          )}

          {!exploreData?.forYou && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-[var(--primary-surface)] bg-[var(--primary-surface)]/30 p-6 text-center"
            >
              <p className="text-sm text-[var(--neutral-70)]">
                Sign in and complete your travel profile to get personalized recommendations!
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page compiles**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/frontend
npx next build --no-lint 2>&1 | head -30
```

Expected: No TypeScript errors for explore page files.

- [ ] **Step 3: Commit**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
git add frontend/src/app/\(app\)/explore/
git commit -m "feat(explore): rewrite explore page with dynamic sections and AI enhancement"
```

---

## Task 11: Frontend — Destination Detail Page

**Files:**
- Create: `frontend/src/app/(app)/explore/[id]/page.tsx`
- Create: `frontend/src/app/(app)/explore/[id]/layout.tsx`
- Create: `frontend/src/components/features/explore/DestinationDetail.tsx`

- [ ] **Step 1: Create detail page layout**

Create `frontend/src/app/(app)/explore/[id]/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Destination Details | ATrips',
  description: 'Explore destination details, weather, and budget information',
};

export default function DestinationDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Create DestinationDetail component**

Create `frontend/src/components/features/explore/DestinationDetail.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  MapPin,
  CurrencyCircleDollar,
  CalendarBlank,
  Star,
  ArrowLeft,
  PaperPlaneTilt,
  BookmarkSimple,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import type { Destination } from '../../../services/exploreService';

interface DestinationDetailProps {
  destination: Destination;
  similarDestinations: Destination[];
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

const TAG_COLORS: Record<string, string> = {
  culture: 'bg-purple-100 text-purple-700',
  beach: 'bg-blue-100 text-blue-700',
  food: 'bg-orange-100 text-orange-700',
  adventure: 'bg-green-100 text-green-700',
  nightlife: 'bg-pink-100 text-pink-700',
  nature: 'bg-emerald-100 text-emerald-700',
  history: 'bg-amber-100 text-amber-700',
  shopping: 'bg-rose-100 text-rose-700',
  romantic: 'bg-red-100 text-red-700',
  family: 'bg-sky-100 text-sky-700',
};

export default function DestinationDetail({
  destination,
  similarDestinations,
  onPlanTrip,
  onSave,
}: DestinationDetailProps) {
  const router = useRouter();
  const place = destination.cached_place;
  const photos = place.photos?.length > 0
    ? place.photos
    : ['/images/placeholder-destination.jpg'];

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--neutral-60)] hover:text-[var(--neutral-90)]"
      >
        <ArrowLeft size={18} />
        Back to Explore
      </button>

      {/* Hero Gallery */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-2 overflow-hidden rounded-2xl md:grid-cols-3 md:grid-rows-2"
        style={{ maxHeight: '400px' }}
      >
        <div className="relative col-span-1 md:col-span-2 md:row-span-2">
          <Image
            src={photos[0]}
            alt={place.city}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 66vw"
            priority
          />
        </div>
        {photos.slice(1, 3).map((photo, i) => (
          <div key={i} className="relative hidden md:block">
            <Image
              src={photo}
              alt={`${place.city} ${i + 2}`}
              fill
              className="object-cover"
              sizes="33vw"
            />
          </div>
        ))}
      </motion.div>

      {/* Overview */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={20} weight="fill" className="text-[var(--primary-main)]" />
            <h1 className="text-2xl font-bold text-[var(--neutral-90)]">
              {place.city}, {place.country}
            </h1>
          </div>

          {destination.tagline && (
            <p className="text-lg text-[var(--neutral-60)]">
              {destination.tagline}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {destination.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-medium ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-[var(--neutral-60)]">
            {place.rating && (
              <span className="flex items-center gap-1">
                <Star size={16} weight="fill" className="text-yellow-500" />
                {place.rating.toFixed(1)}
                {place.ratingCount && ` (${place.ratingCount})`}
              </span>
            )}
            {destination.avgDailyBudget && (
              <span className="flex items-center gap-1">
                <CurrencyCircleDollar size={16} />
                ~${Number(destination.avgDailyBudget)}/day
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarBlank size={16} />
              Best: {destination.bestSeasons.join(', ')}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(destination)}
            className="flex items-center gap-2 rounded-lg border border-[var(--neutral-30)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--neutral-10)]"
          >
            <BookmarkSimple size={18} />
            Save
          </button>
          <button
            onClick={() => onPlanTrip(destination)}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary-main)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
          >
            <PaperPlaneTilt size={18} weight="fill" />
            Plan This Trip
          </button>
        </div>
      </div>

      {/* Similar Destinations */}
      {similarDestinations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--neutral-90)]">
            Similar Destinations
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {similarDestinations.map((dest, i) => (
              <ExploreDestinationCard
                key={dest.id}
                destination={dest}
                index={i}
                onPlanTrip={onPlanTrip}
                onSave={onSave}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create detail page**

Create `frontend/src/app/(app)/explore/[id]/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useChatStore from '@/src/stores/chatStore';
import exploreService from '@/src/services/exploreService';
import DestinationDetail from '@/src/components/features/explore/DestinationDetail';
import type { Destination } from '@/src/services/exploreService';

export default function DestinationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const createConversation = useChatStore((s) => s.createConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [destination, setDestination] = useState<Destination | null>(null);
  const [similar, setSimilar] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await exploreService.getDestination(id);
        setDestination(data.destination);
        setSimilar(data.similarDestinations);
      } catch {
        setError('Destination not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePlanTrip = useCallback(
    async (dest: Destination) => {
      const place = dest.cached_place;
      const message = `Plan a trip to ${place.city}, ${place.country}`;
      const conversationId = await createConversation(undefined, message);
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
        setTimeout(() => sendMessage(message), 300);
      }
    },
    [createConversation, sendMessage, router],
  );

  const handleSave = useCallback(
    (dest: Destination) => {
      router.push(`/collections?save=${dest.cachedPlaceId}`);
    },
    [router],
  );

  if (loading) {
    return (
      <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--neutral-20)]" />
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--neutral-20)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--neutral-20)]" />
      </div>
    );
  }

  if (error || !destination) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-[var(--neutral-60)]">
            {error ?? 'Something went wrong'}
          </p>
          <button
            onClick={() => router.push('/explore')}
            className="mt-4 text-sm text-[var(--primary-main)] hover:underline"
          >
            Back to Explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <DestinationDetail
        destination={destination}
        similarDestinations={similar}
        onPlanTrip={handlePlanTrip}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add card click navigation to ExploreDestinationCard**

In `frontend/src/components/features/explore/ExploreDestinationCard.tsx`, wrap the card with a click handler to navigate to the detail page. Add `useRouter` import and an `onClick` on the outer `motion.div`:

```tsx
// Add to imports
import { useRouter } from 'next/navigation';

// Inside component, add:
const router = useRouter();

// On the motion.div, add:
onClick={() => router.push(`/explore/${destination.id}`)}
className="... cursor-pointer" // add cursor-pointer to existing classes
```

- [ ] **Step 5: Commit**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com
git add frontend/src/app/\(app\)/explore/\[id\]/ frontend/src/components/features/explore/DestinationDetail.tsx frontend/src/components/features/explore/ExploreDestinationCard.tsx
git commit -m "feat(explore): add destination detail page with similar destinations"
```

---

## Task 12: Integration Testing — End-to-End Verification

**Files:** None (manual verification)

- [ ] **Step 1: Start backend and verify API**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/backend
npm run dev
```

Test endpoints:
```bash
# Guest explore (no auth)
curl http://localhost:5000/api/explore | jq '.data | keys'
# Expected: ["popular", "trending"]

# Search
curl "http://localhost:5000/api/explore/search?q=tokyo" | jq '.data.total'
# Expected: 1

# Destination detail (use an ID from the explore response)
curl http://localhost:5000/api/explore/destinations/<ID> | jq '.data.destination.cached_place.city'
# Expected: city name
```

- [ ] **Step 2: Start frontend and verify pages**

```bash
cd /home/eddiesngu/Desktop/VLinh/atrips.com/frontend
npm run dev
```

Visit `http://localhost:3000/explore`:
- Verify sections load (Trending, Popular for guest)
- Verify search works
- Verify card click navigates to detail page
- Verify "Plan Trip" button creates chat conversation
- Log in and verify "For You" section appears

- [ ] **Step 3: Test authenticated flow**

Log in and visit `/explore`:
- Verify "For You" section shows personalized results
- Verify "Budget-Friendly Picks" section appears
- Verify AI enhancement chips appear after a few seconds
- Verify Save button works

- [ ] **Step 4: Final commit with any fixes**

```bash
git add -A
git commit -m "feat(explore): integration fixes and polish"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Database migration | `schema.prisma`, migration |
| 2 | DestinationRepository | `DestinationRepository.js` |
| 3 | ScoringService | `ScoringService.js` |
| 4 | ExploreController + Routes | `exploreController.js`, `exploreRoutes.js`, `index.js` |
| 5 | AI Enhancement | `ExploreEnhancementService.js` |
| 6 | Data Seed | `seedDestinations.js` |
| 7 | BullMQ Enrichment Job | `ExploreEnrichmentJob.js`, `index.js` |
| 8 | Frontend Service | `exploreService.ts` |
| 9 | UI Components | 5 new components |
| 10 | Explore Page Rewrite | `explore/page.tsx` |
| 11 | Detail Page | `explore/[id]/page.tsx`, `DestinationDetail.tsx` |
| 12 | Integration Testing | Manual E2E verification |
