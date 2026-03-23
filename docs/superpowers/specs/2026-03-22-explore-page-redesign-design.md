# Explore Page Redesign — Personalized Discovery

**Date:** 2026-03-22
**Status:** Draft
**Approach:** Hybrid Scoring + AI Enhancement

## Problem

The current `/explore` page uses 20 hardcoded destinations with client-side filtering. No backend API calls, no personalization, no dynamic content. The page feels static and doesn't leverage existing infrastructure (travel profiles, AI recommendation endpoint, cached_places).

## Goals

- Personalized destination discovery based on user's travel profile
- Dynamic data from database, not hardcoded
- Seasonal trending for guest users (no login required)
- Rich destination detail pages
- Fast initial load via SSR with progressive AI enhancement

## Approach: Hybrid Scoring + AI Enhancement

**Layer 1 — Scoring Engine (SSR):** Fast backend scoring service ranks destinations by season match, profile compatibility, popularity, and recency. Serves initial page render.

**Layer 2 — AI Enhancement (Async):** After page loads, client calls AI endpoint to re-rank results, generate personalized taglines, and add "why this fits you" explanations. Graceful degradation if AI is slow/unavailable.

## Data Layer

### Destinations Table

Thin overlay on `cached_places` — stores only travel-specific metadata that `cached_places` doesn't have. City, country, photos are read by joining to `cached_places` at query time.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| cachedPlaceId | FK | Link to cached_places (source for city, country, photos) |
| region | Enum | Southeast Asia, East Asia, South Asia, Europe, Americas, Middle East, Africa, Oceania |
| tagline | String | Short travel-oriented description |
| bestSeasons | String[] | spring, summer, autumn, winter |
| avgDailyBudget | Decimal | Average daily cost in USD |
| tags | String[] | culture, beach, food, adventure, nightlife, nature, history, shopping, romantic, family |
| coverImageAssetIds | String[] | References to image_assets IDs (processed via existing R2 pipeline) |
| popularityScore | Float | Computed from saves + trips count |
| isActive | Boolean | Whether to show in explore |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Key design decisions:**
- No `city`/`country`/`coverImages` columns — these come from the joined `cached_places` row, avoiding data drift
- `coverImageAssetIds` references the existing `image_assets` table, ensuring images go through the R2 ingest pipeline with responsive sizes and blur placeholders
- `region` enum includes South Asia (for India, Nepal, Sri Lanka, Maldives)

### Scoring Engine

Service calculates relevance score per destination per user:

| Factor | Weight (Auth) | Weight (Guest) | Logic |
|--------|---------------|----------------|-------|
| Season match | 25% | 40% | destination.bestSeasons vs destination's hemisphere-adjusted current season |
| Profile match | 35% | — | destination.tags vs user.travelerTypes + spendingHabits |
| Popularity | 25% | 60% | Normalized popularityScore |
| Recency penalty | 15% | — | Reduce score if user has recent trip to this destination |

**Season detection:** Season is determined relative to the destination's hemisphere, using the destination's latitude from `cached_places`. March = spring for Northern Hemisphere destinations (lat > 0), autumn for Southern Hemisphere (lat < 0). This ensures a user in Australia sees Tokyo tagged as "spring" and Sydney as "autumn" in March.

**Weight transition:** Guest and authenticated weights are designed so that the ordering doesn't drastically change on login. Season (40%→25%) and popularity (60%→25%) remain significant factors; profile match and recency are additive boosters rather than replacements.

- Scores cached in Redis: per-user (TTL 1h), global seasonal (TTL 6h)
- **Cache invalidation triggers:**
  - User profile update → invalidate per-user scoring cache
  - Destination save or trip creation → update popularityScore via BullMQ job, invalidate affected global caches
  - Destination data update → invalidate destination detail cache

## API Endpoints

All endpoints follow the existing `AppError` contract for error responses. Empty database returns `{ forYou: [], trending: [], ... }` with empty arrays. Redis failure falls through to direct DB queries (existing `CacheService` in-memory fallback).

### `GET /api/explore`

SSR entry point. Returns pre-scored destinations grouped by section.

**Query params:** `?limit=8&offset=0` (per-section pagination)

**Auth:** Optional (`optionalAuth` middleware). With token → personalized sections. Without → seasonal/popular only.

**Response (authenticated):**
```json
{
  "forYou": { "items": [Destination], "total": 42, "hasMore": true },
  "trending": { "items": [Destination], "total": 30, "hasMore": true },
  "budgetFriendly": { "items": [Destination], "total": 15, "hasMore": true },
  "basedOnPastTrips": { "items": [Destination], "total": 8, "hasMore": false }
}
```

**Response (guest):**
```json
{
  "trending": { "items": [Destination], "total": 30, "hasMore": true },
  "popular": { "items": [Destination], "total": 50, "hasMore": true }
}
```

Initial SSR returns 8 items per section for fast payload. "Load more" fetches additional pages via `?section=forYou&limit=8&offset=8`.

### `GET /api/explore/search?q=...`

Text search across destinations (city, country, tags, tagline).

**Query params:** `?q=beach&limit=20&offset=0`

**Response:** `{ items: [Destination], total: number, hasMore: boolean }`

Uses PostgreSQL full-text search on joined `cached_places` + `destinations` data.

### `GET /api/explore/destinations/:id`

Detail page data for a single destination.

**Response:**
```json
{
  "destination": Destination,
  "weather": {
    "current": CurrentWeather,
    "forecast": WeatherForecast7Day
  },
  "budgetBreakdown": BudgetEstimate,
  "similarDestinations": [Destination]
}
```

**Note on weather:** Shows current conditions + 7-day forecast from Open-Meteo. The "best time to visit" chart is omitted from v1 since Open-Meteo's free tier doesn't provide historical climate averages. Can be added later with a climate data source.

### `POST /api/explore/enhance`

AI enhancement endpoint, called async from client after SSR hydration.

**Auth:** Required (`authMiddleware`). User profile is extracted from `req.user.id` — never from request body.

**Rate limit:** 10 requests per user per minute (enforced via dedicated rate limiter, same pattern as `RateLimiter.js` in AI module).

**Input:**
```json
{
  "destinationIds": ["uuid1", "uuid2"]
}
```

**Output:**
```json
{
  "enhancements": {
    "uuid1": {
      "personalizedTagline": "Perfect for your adventure style",
      "whyForYou": "Matches your love for outdoor activities and budget-friendly travel",
      "adjustedRank": 1
    }
  }
}
```

### Save to Collection

Reuse existing `POST /api/collections/:id/places` endpoint from the collection module. No new save endpoint needed — the frontend calls the existing collection API with the destination's `cachedPlaceId`.

## Frontend Architecture

### Page: `/explore` (SSR)

Next.js server component. Fetches `/api/explore` server-side for initial render.

**Sections (top to bottom):**

1. **Hero Section**
   - Search bar for destination text search (calls `/api/explore/search`)
   - Seasonal banner: "Spring in Japan", "Summer beaches in Southeast Asia"
   - Season determined by server based on majority of trending destinations' hemispheres

2. **"For You"** (authenticated only)
   - Personalized destination grid from scoring engine
   - Progressive enhancement: scored results (SSR) → AI-enhanced results (client-side)
   - Shows "why for you" chips after AI enhancement completes

3. **"Trending This Season"**
   - Destinations matching current season + high popularity
   - Available to all users including guests
   - Primary section for unauthenticated users

4. **"Based on Your Past Trips"** (authenticated + has trip history)
   - Destinations similar to places user has visited
   - Uses tags and region overlap from past trip activities
   - Deferred to v1.1 if timeline is tight

5. **"Budget-Friendly Picks"** (authenticated)
   - Filtered by user's spendingHabits from travel profile
   - Shows avgDailyBudget prominently on each card

6. **Guest Fallback**
   - "Trending This Season" + "Popular Destinations"
   - CTA banner to sign up/login for personalized recommendations

### Destination Card

Each card displays:

- Cover image with gradient overlay (from image_assets, responsive sizes)
- City, Country + region badge
- Tagline (AI-generated or static)
- Quick stats row: avg budget/day, best season, rating
- Top 3 tags with color coding
- Action buttons:
  - Save (bookmark icon) — calls existing collection API
  - Plan Trip (primary CTA → creates AI chat conversation)
- Weather badge (small, corner): current temperature + weather icon
- "Why for you" chip (appears after AI enhancement): "Matches your adventure style"

### Destination Detail Page: `/explore/[id]` (SSR)

- **Hero gallery** — Image carousel (from image_assets), full-width
- **Overview panel** — City, country, tagline, rating, tags, region
- **Weather section** — Current conditions + 7-day forecast
- **Budget breakdown** — Daily estimate by category (accommodation, food, transport, activities), compared to user's spendingHabits if authenticated
- **Similar destinations** — Grid of 4-6 related destination cards
- **"Plan This Trip" CTA** — Creates AI conversation pre-filled with destination context
- **Save to collection** button

## Performance & Caching

| Layer | Strategy | TTL | Invalidation |
|-------|----------|-----|--------------|
| Scoring results (per user) | Redis hash | 1 hour | Profile update, new trip/save |
| Seasonal trending (global) | Redis key | 6 hours | Popularity score recalc |
| Destination detail | Redis cache | 1 hour | Destination data update |
| Weather data | Redis cache | 3 hours | None (natural expiry) |
| AI enhancements | Redis cache per user+destination | 24 hours | Profile update |

- **SSR**: Next.js server components for initial render — fast TTFB, good SEO
- **Progressive enhancement**: AI results fetched client-side after hydration
- **Image optimization**: Next.js Image component via image_assets pipeline, lazy loading, blur placeholders
- **Pagination**: 8 items per section initial load, "Load more" per section

## Data Seeding & Growth

### Initial Seed
- Migrate existing 20 hardcoded destinations into `destinations` table
- Create `cached_places` entries for each, process cover images through R2 pipeline

### Organic Growth (v2 — deferred from v1)
Automatic destination creation from AI conversations requires careful design (content moderation, extraction logic, review workflow). Deferred to a future iteration with a dedicated spec.

### Background Enrichment
BullMQ job runs daily with rate limiting (reuse `ImageQueueService` throttle pattern: max 10 ops/sec):
- Update popularity scores from saves/trips counts
- AI-enrich destinations missing taglines (batch, throttled)
- Weather data refreshed on-demand via cache TTL, not batch job

## Testing Strategy

- **Unit tests**: Scoring engine logic, hemisphere-aware season detection, profile matching weights
- **Integration tests**: API endpoints with test database, Redis cache behavior
- **E2E tests**: Explore page load, section rendering, card interactions, navigation to detail page, guest vs authenticated views
- **Performance tests**: SSR response time < 500ms, AI enhancement < 3s
