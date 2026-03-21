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

New `destinations` table linked to `cached_places`:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| cachedPlaceId | FK | Link to cached_places |
| city | String | City name |
| country | String | Country name |
| region | Enum | Southeast Asia, East Asia, Europe, Americas, Middle East, Africa, Oceania |
| tagline | String | Short description |
| bestSeasons | String[] | spring, summer, autumn, winter |
| avgDailyBudget | Decimal | Average daily cost in USD |
| tags | String[] | culture, beach, food, adventure, nightlife, nature, history, shopping, romantic, family |
| coverImages | String[] | Array of image URLs |
| popularityScore | Float | Computed from saves + trips count |
| isActive | Boolean | Whether to show in explore |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Scoring Engine

Service calculates relevance score per destination per user:

| Factor | Weight | Logic |
|--------|--------|-------|
| Season match | 30% | destination.bestSeasons vs current month |
| Profile match | 40% | destination.tags vs user.travelerTypes + spendingHabits |
| Popularity | 20% | Normalized popularityScore |
| Recency penalty | 10% | Reduce score if user has recent trip to this destination |

- Scores cached in Redis: per-user (TTL 1h), global seasonal (TTL 6h)
- Guest users get season match (30%) + popularity (70%) only

## API Endpoints

### `GET /api/explore`

SSR entry point. Returns pre-scored destinations grouped by section.

**Query params:** `?season=auto&limit=20&offset=0`

**Auth:** Optional. With token → personalized sections. Without → seasonal/popular only.

**Response:**
```json
{
  "forYou": [Destination],
  "trending": [Destination],
  "budgetFriendly": [Destination],
  "basedOnPastTrips": [Destination]
}
```

Guest response includes only `trending` and a `popular` section.

### `GET /api/explore/destinations/:id`

Detail page data for a single destination.

**Response:**
```json
{
  "destination": Destination,
  "weather": WeatherForecast,
  "budgetBreakdown": BudgetEstimate,
  "similarDestinations": [Destination]
}
```

### `POST /api/explore/enhance`

AI enhancement endpoint, called async from client after SSR hydration.

**Input:**
```json
{
  "destinationIds": ["uuid1", "uuid2"],
  "userProfileId": "uuid"
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

### `POST /api/explore/destinations/:id/save`

Save destination to user's collection.

**Input:**
```json
{
  "collectionId": "uuid",
  "notes": "optional note"
}
```

## Frontend Architecture

### Page: `/explore` (SSR)

Next.js server component. Fetches `/api/explore` server-side for initial render.

**Sections (top to bottom):**

1. **Hero Section**
   - Search bar for destination text search
   - Seasonal banner: "Spring in Japan", "Summer beaches in Southeast Asia"
   - Auto-detected based on current date + hemisphere

2. **"For You"** (authenticated only)
   - Personalized destination grid from scoring engine
   - Progressive enhancement: skeleton → scored results → AI-enhanced results
   - Shows "why for you" chips after AI enhancement completes

3. **"Trending This Season"**
   - Destinations matching current season + high popularity
   - Available to all users including guests
   - Primary section for unauthenticated users

4. **"Based on Your Past Trips"** (authenticated + has trip history)
   - Destinations similar to places user has visited
   - Uses tags and region overlap from past trip activities

5. **"Budget-Friendly Picks"** (authenticated)
   - Filtered by user's spendingHabits from travel profile
   - Shows avgDailyBudget prominently on each card

6. **Guest Fallback**
   - "Trending This Season" + "Popular Destinations"
   - CTA banner to sign up/login for personalized recommendations

### Destination Card

Each card displays:

- Cover image with gradient overlay
- City, Country + region badge
- Tagline (AI-generated or static)
- Quick stats row: avg budget/day, best season, rating
- Top 3 tags with color coding
- Action buttons:
  - Save (bookmark icon) — opens collection picker
  - Quick Budget Estimate (popover with daily breakdown)
  - Plan Trip (primary CTA → creates AI chat conversation)
- Weather badge (small, corner): current temperature + weather icon
- "Why for you" chip (appears after AI enhancement): "Matches your adventure style"

### Destination Detail Page: `/explore/[id]` (SSR)

- **Hero gallery** — Image carousel, full-width
- **Overview panel** — City, country, tagline, rating, tags, region
- **Weather section** — 7-day forecast, "best time to visit" chart by month
- **Budget breakdown** — Daily estimate by category (accommodation, food, transport, activities), compared to user's spendingHabits
- **Similar destinations** — Grid of 4-6 related destination cards
- **"Plan This Trip" CTA** — Creates AI conversation pre-filled with destination context
- **Save to collection** button

## Performance & Caching

| Layer | Strategy | TTL |
|-------|----------|-----|
| Scoring results (per user) | Redis hash | 1 hour |
| Seasonal trending (global) | Redis sorted set | 6 hours |
| Destination detail | Redis cache | 1 hour |
| Weather data | Redis cache | 3 hours |
| AI enhancements | Redis cache per user+destination | 24 hours |

- **SSR**: Next.js server components for initial render — fast TTFB, good SEO
- **Progressive enhancement**: AI results stream in after hydration
- **Image optimization**: Next.js Image component, lazy loading, blur placeholders
- **Pagination**: "Load more" button per section, 20 items per page

## Data Seeding & Growth

### Initial Seed
- Migrate existing 20 hardcoded destinations into `destinations` table
- Link to existing `cached_places` entries or create new ones

### Organic Growth
- When a user "Plan Trip" for a new destination via AI chat → AI enriches and creates a new `destinations` entry automatically
- Threshold: destination appears in 3+ conversations → auto-create entry

### Background Enrichment
- BullMQ job runs daily:
  - Update weather data for all active destinations
  - Refresh budget estimates
  - Update popularity scores from saves/trips counts
  - AI-enrich destinations missing taglines or cover images

## Testing Strategy

- **Unit tests**: Scoring engine logic, season detection, profile matching
- **Integration tests**: API endpoints with test database
- **E2E tests**: Explore page load, section rendering, card interactions, navigation to detail page
- **Performance tests**: SSR response time < 500ms, AI enhancement < 3s
