# Trip Page Enrichment, Sharing & Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken sharing (token generation + public trip page), enrich place data via Serper, and add inline editing to the trip timeline.

**Architecture:** Three independent modules sharing existing patterns. Backend: Express routes → controllers → repositories (Prisma). Frontend: Next.js App Router + Zustand + Mapbox GL. Enrichment uses existing SerperService.

**Tech Stack:** Node.js/Express, Prisma, Serper API, Next.js 14, React, Zustand, Mapbox GL, Framer Motion, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-trip-page-enrichment-sharing-design.md`

---

## File Structure

### Backend (new files)

| File | Responsibility |
|------|---------------|
| `src/modules/trip/interfaces/http/tripShareRoutes.js` | Share routes (public + authenticated) |
| `src/modules/trip/interfaces/http/tripShareController.js` | Share request handling |
| `src/modules/trip/infrastructure/repositories/TripShareRepository.js` | Share token CRUD, access tracking |
| `src/modules/place/interfaces/http/placeRoutes.js` | Place enrichment + search routes |
| `src/modules/place/interfaces/http/placeController.js` | Place request handling |
| `src/modules/place/application/services/PlaceEnrichmentService.js` | Serper enrichment orchestration |
| `src/modules/place/infrastructure/repositories/PlaceRepository.js` | cached_places CRUD |

### Backend (modified files)

| File | Change |
|------|--------|
| `src/modules/trip/interfaces/http/tripRoutes.js` | Mount share routes |
| `src/modules/trip/infrastructure/repositories/TripAdvancedRepository.js` | Add `duplicateTripForShareToken()` (skip owner check) |
| `src/modules/trip/application/services/DraftCompilerService.js` | Add Level 1 enrichment call after compilation |
| `src/app.js` or `src/routes/index.js` | Mount place routes |

### Frontend (new files)

| File | Responsibility |
|------|---------------|
| `src/app/(public)/trips/shared/[shareToken]/page.tsx` | Shared trip public page |
| `src/components/features/trip/PlaceDetailPanel.tsx` | Place detail side panel |
| `src/components/features/trip/MapMarkerPopup.tsx` | Map marker click popup |
| `src/components/features/trip/ActivityEditor.tsx` | Inline activity edit form |
| `src/components/features/trip/AddActivityForm.tsx` | Add new activity form |
| `src/services/shareService.ts` | Share API client |
| `src/services/placeService.ts` | Place enrichment API client |

### Frontend (modified files)

| File | Change |
|------|--------|
| `src/components/features/chat/page/ShareTripModal.tsx` | Use share API, show shareToken URL, add revoke |
| `src/components/features/chat/MapboxMap.tsx` | Add click handler, popup, day filter |
| `src/components/features/chat/page/TripItineraryTimelineCard.tsx` | Add inline editing, add activity, detail panel trigger |
| `src/services/tripService.ts` | Add share/duplicate methods |
| `src/stores/chatStore.ts` | Add selectedPlace state |

---

## Module 1: Sharing

### Task 1: TripShareRepository (Backend)

**Files:**
- Create: `src/modules/trip/infrastructure/repositories/TripShareRepository.js`

- [ ] **Step 1: Create TripShareRepository with generateToken**

```js
import crypto from 'node:crypto';
import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logger } from '../../../../shared/services/LoggerService.js';

class TripShareRepository {
  async generateShareToken(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, shareToken: true },
    });

    if (!trip) throw AppError.notFound('Trip not found');
    if (trip.ownerId !== userId) {
      throw AppError.forbidden('Only the trip owner can share');
    }

    if (trip.shareToken) {
      return { shareToken: trip.shareToken, alreadyShared: true };
    }

    const shareToken = crypto.randomBytes(16).toString('hex');

    await prisma.$transaction(async (tx) => {
      await tx.trips.update({
        where: { id: tripId },
        data: { shareToken, visibility: 'SHARED' },
      });

      await tx.trip_shares.create({
        data: {
          tripId,
          shareToken,
          permission: 'VIEWER',
        },
      });
    });

    logger.info('[Share] Token generated', { tripId });
    return { shareToken, alreadyShared: false };
  }

  async revokeShareToken(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, shareToken: true },
    });

    if (!trip) throw AppError.notFound('Trip not found');
    if (trip.ownerId !== userId) {
      throw AppError.forbidden('Only the trip owner can revoke');
    }
    if (!trip.shareToken) {
      throw AppError.badRequest('Trip is not currently shared');
    }

    await prisma.$transaction(async (tx) => {
      await tx.trips.update({
        where: { id: tripId },
        data: { shareToken: null, visibility: 'PRIVATE' },
      });

      await tx.trip_shares.deleteMany({
        where: { tripId },
      });
    });

    logger.info('[Share] Token revoked', { tripId });
  }

  async findTripByShareToken(shareToken) {
    const trip = await prisma.trips.findFirst({
      where: { shareToken },
      include: {
        trip_cities: { orderBy: { orderIndex: 'asc' } },
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: {
              orderBy: { orderIndex: 'asc' },
              include: {
                cached_places: true,
                image_asset: true,
              },
            },
          },
        },
      },
    });

    if (!trip) return null;

    await prisma.trip_shares.updateMany({
      where: { shareToken },
      data: {
        accessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    return trip;
  }
}

export default new TripShareRepository();
```

- [ ] **Step 2: Verify the Prisma schema relations**

Check that `activities` relation to `cached_places` uses the right relation name. Run:
```bash
grep -A5 'placeId' prisma/schema.prisma | head -20
```

Adjust the `include` in `findTripByShareToken` to match the actual Prisma relation names (e.g., `cached_place` vs `cached_places`, `image_assets` vs `image_asset`).

- [ ] **Step 3: Commit**

```bash
git add src/modules/trip/infrastructure/repositories/TripShareRepository.js
git commit -m "feat(share): add TripShareRepository with token generation and revoke"
```

---

### Task 2: TripShareController + Routes (Backend)

**Files:**
- Create: `src/modules/trip/interfaces/http/tripShareController.js`
- Create: `src/modules/trip/interfaces/http/tripShareRoutes.js`
- Modify: `src/modules/trip/interfaces/http/tripRoutes.js`

- [ ] **Step 1: Create TripShareController**

```js
import { sendSuccess, sendCreated } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import tripShareRepository from '../../infrastructure/repositories/TripShareRepository.js';
import tripAdvancedRepository from '../../infrastructure/repositories/TripAdvancedRepository.js';

export const shareTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const { shareToken } = await tripShareRepository.generateShareToken(
    tripId,
    userId
  );

  return sendCreated(
    res,
    { shareToken },
    'Trip shared successfully'
  );
});

export const revokeShare = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  await tripShareRepository.revokeShareToken(tripId, userId);

  return sendSuccess(res, null, 'Share link revoked');
});

export const getSharedTrip = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  const trip = await tripShareRepository.findTripByShareToken(shareToken);

  if (!trip) {
    throw AppError.notFound(
      'Trip not found or link has been revoked'
    );
  }

  const { ownerId, ...sanitized } = trip;

  return sendSuccess(res, { trip: sanitized });
});

export const duplicateSharedTrip = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;
  const userId = req.user.id;

  const trip = await tripShareRepository.findTripByShareToken(shareToken);

  if (!trip) {
    throw AppError.notFound(
      'Trip not found or link has been revoked'
    );
  }

  const newTrip = await tripAdvancedRepository.duplicateTripByData(
    trip,
    userId
  );

  return sendCreated(
    res,
    { trip: newTrip },
    'Trip duplicated to your account'
  );
});
```

- [ ] **Step 2: Create TripShareRoutes**

```js
import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as tripShareController from './tripShareController.js';

const router = Router();

// Public routes (no auth)
router.get('/shared/:shareToken', tripShareController.getSharedTrip);

// Authenticated routes
router.post(
  '/:tripId/share',
  authenticate,
  tripShareController.shareTrip
);
router.delete(
  '/:tripId/share',
  authenticate,
  tripShareController.revokeShare
);
router.post(
  '/shared/:shareToken/duplicate',
  authenticate,
  tripShareController.duplicateSharedTrip
);

export default router;
```

- [ ] **Step 3: Mount share routes in tripRoutes.js**

In `src/modules/trip/interfaces/http/tripRoutes.js`, add before the `router.use(authenticate)` line:

```js
import tripShareRoutes from './tripShareRoutes.js';

// Share routes (mix of public and authenticated - handles own auth)
router.use('/', tripShareRoutes);
```

This must be BEFORE the global `router.use(authenticate)` line so that the public `GET /shared/:shareToken` endpoint works without auth.

- [ ] **Step 4: Add duplicateTripByData to TripAdvancedRepository**

In `src/modules/trip/infrastructure/repositories/TripAdvancedRepository.js`, add this method to the class. It reuses the existing duplicate logic but takes trip data directly instead of requiring ownership:

```js
async duplicateTripByData(tripData, newOwnerId) {
  const newTripId = crypto.randomUUID();

  return prisma.$transaction(async (tx) => {
    const newTrip = await tx.trips.create({
      data: {
        id: newTripId,
        ownerId: newOwnerId,
        title: `${tripData.title} (Copy)`,
        description: tripData.description,
        coverImageUrl: tripData.coverImageUrl,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        travelersCount: tripData.travelersCount,
        budgetTotal: tripData.budgetTotal,
        budgetCurrency: tripData.budgetCurrency,
        status: 'DRAFT',
        visibility: 'PRIVATE',
        overview: tripData.overview,
        metadata: tripData.metadata,
      },
    });

    if (tripData.trip_cities?.length > 0) {
      await tx.trip_cities.createMany({
        data: tripData.trip_cities.map((city) => ({
          id: crypto.randomUUID(),
          tripId: newTripId,
          cityName: city.cityName,
          countryCode: city.countryCode,
          latitude: city.latitude,
          longitude: city.longitude,
          placeId: city.placeId,
          startDate: city.startDate,
          endDate: city.endDate,
          orderIndex: city.orderIndex,
        })),
      });
    }

    for (const day of tripData.itinerary_days || []) {
      const newDayId = crypto.randomUUID();

      await tx.itinerary_days.create({
        data: {
          id: newDayId,
          tripId: newTripId,
          date: day.date,
          cityName: day.cityName,
          dayNumber: day.dayNumber,
          notes: day.notes,
          weatherData: day.weatherData,
          metadata: day.metadata,
        },
      });

      if (day.activities?.length > 0) {
        await tx.activities.createMany({
          data: day.activities.map((a) => ({
            id: crypto.randomUUID(),
            itineraryDayId: newDayId,
            name: a.name,
            type: a.type,
            description: a.description,
            startTime: a.startTime,
            endTime: a.endTime,
            duration: a.duration,
            placeId: a.placeId,
            customAddress: a.customAddress,
            latitude: a.latitude,
            longitude: a.longitude,
            estimatedCost: a.estimatedCost,
            currency: a.currency,
            bookingUrl: a.bookingUrl,
            notes: a.notes,
            orderIndex: a.orderIndex,
            transportFromPrevious: a.transportFromPrevious,
            imageAssetId: a.imageAssetId,
          })),
        });
      }
    }

    return tx.trips.findUnique({
      where: { id: newTrip.id },
      include: {
        trip_cities: { orderBy: { orderIndex: 'asc' } },
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });
  });
}
```

- [ ] **Step 5: Test manually**

```bash
# Start the server
npm run dev

# Generate share token (replace with valid tripId and JWT)
curl -X POST http://localhost:5000/api/trips/<tripId>/share \
  -H "Authorization: Bearer <jwt>" | jq .

# Access shared trip (no auth)
curl http://localhost:5000/api/trips/shared/<shareToken> | jq .

# Revoke
curl -X DELETE http://localhost:5000/api/trips/<tripId>/share \
  -H "Authorization: Bearer <jwt>" | jq .
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/trip/interfaces/http/tripShareController.js \
  src/modules/trip/interfaces/http/tripShareRoutes.js \
  src/modules/trip/interfaces/http/tripRoutes.js \
  src/modules/trip/infrastructure/repositories/TripAdvancedRepository.js
git commit -m "feat(share): add share/revoke/view/duplicate endpoints"
```

---

### Task 3: Share Frontend — Service + Modal Update

**Files:**
- Create: `frontend/src/services/shareService.ts`
- Modify: `frontend/src/components/features/chat/page/ShareTripModal.tsx`
- Modify: `frontend/src/services/tripService.ts`

- [ ] **Step 1: Create shareService.ts**

```ts
import api from '@/src/lib/api';

interface ShareResponse {
  shareToken: string;
}

const shareService = {
  async shareTrip(tripId: string): Promise<ShareResponse> {
    const response = await api.post<{ data: ShareResponse }>(
      `/trips/${tripId}/share`
    );
    return response.data.data;
  },

  async revokeShare(tripId: string): Promise<void> {
    await api.delete(`/trips/${tripId}/share`);
  },

  async getSharedTrip(shareToken: string) {
    const response = await api.get(`/trips/shared/${shareToken}`);
    return response.data.data.trip;
  },

  async duplicateSharedTrip(shareToken: string) {
    const response = await api.post(
      `/trips/shared/${shareToken}/duplicate`
    );
    return response.data.data.trip;
  },
};

export default shareService;
```

- [ ] **Step 2: Update ShareTripModal to use share API**

Replace the `handleVisibilityChange` logic and `buildShareUrl` in `ShareTripModal.tsx`:

Key changes:
1. `buildShareUrl` now takes a `shareToken` parameter: `${origin}/trips/shared/${shareToken}`
2. When selecting SHARED → call `shareService.shareTrip(tripId)` → store returned `shareToken` in state
3. When selecting PRIVATE (was SHARED) → call `shareService.revokeShare(tripId)` → clear `shareToken`
4. Add `shareToken` prop (optional, from parent) and local state
5. Show share URL only when `shareToken` exists

```tsx
// Add to imports:
import shareService from '@/src/services/shareService';

// Add to state:
const [shareToken, setShareToken] = useState<string | null>(
  initialShareToken ?? null
);

// In handleVisibilityChange:
if (newVisibility === 'SHARED' || newVisibility === 'PUBLIC') {
  const result = await shareService.shareTrip(tripId);
  setShareToken(result.shareToken);
} else {
  await shareService.revokeShare(tripId);
  setShareToken(null);
}
await tripService.updateTrip(tripId, { visibility: newVisibility });
setVisibility(newVisibility);

// buildShareUrl:
function buildShareUrl(token: string | null): string {
  if (!token || typeof window === 'undefined') return '';
  return `${window.location.origin}/trips/shared/${token}`;
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/services/shareService.ts \
  src/components/features/chat/page/ShareTripModal.tsx
git commit -m "feat(share): connect ShareTripModal to share API with token"
```

---

### Task 4: Shared Trip Public Page (Frontend)

**Files:**
- Create: `frontend/src/app/(public)/trips/shared/[shareToken]/page.tsx`

Check the frontend app directory structure first to find the correct layout group for public (no-auth) pages:

```bash
ls frontend/src/app/
```

- [ ] **Step 1: Create the shared trip page**

This page renders a read-only trip view. It reuses `TripItineraryTimelineCard` and `MapboxMap` in read-only mode.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import shareService from '@/src/services/shareService';
import { toast } from '@/src/components/ui/use-toast';

const MapboxMap = dynamic(
  () => import('@/src/components/features/chat/MapboxMap'),
  { ssr: false }
);
const TripItineraryTimelineCard = dynamic(
  () =>
    import(
      '@/src/components/features/chat/page/TripItineraryTimelineCard'
    ),
  { ssr: false }
);

export default function SharedTripPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.shareToken as string;

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      try {
        const data = await shareService.getSharedTrip(shareToken);
        setTrip(data);
      } catch {
        setError('Trip not found or link has been revoked');
      } finally {
        setLoading(false);
      }
    }
    loadTrip();
  }, [shareToken]);

  const handleDuplicate = async () => {
    try {
      const newTrip = await shareService.duplicateSharedTrip(
        shareToken
      );
      toast.success('Trip added to your account!');
      router.push(`/chat/${newTrip.id}`);
    } catch {
      toast.error(
        'Please log in to save this trip',
        'You need an account to duplicate trips'
      );
      router.push(`/login?redirect=/trips/shared/${shareToken}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--primary-main)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-semibold text-[var(--neutral-100)]">
          Trip Not Found
        </h1>
        <p className="text-[var(--neutral-60)]">
          {error || 'This trip is no longer available.'}
        </p>
      </div>
    );
  }

  // Transform trip data to match the itinerary format expected by components
  // This depends on the exact shape TripItineraryTimelineCard expects
  // Adjust based on actual component props

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--neutral-30)] px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--neutral-100)]">
            {trip.title}
          </h1>
          <p className="text-sm text-[var(--neutral-60)]">
            Shared trip plan
          </p>
        </div>
        <button
          type="button"
          onClick={handleDuplicate}
          className="rounded-lg bg-[var(--primary-main)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Save to my trips
        </button>
      </div>

      {/* Content - Map + Timeline */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <MapboxMap tripData={trip} readOnly />
        </div>
        <div className="w-[420px] overflow-y-auto border-l border-[var(--neutral-30)]">
          <TripItineraryTimelineCard
            tripData={trip}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
```

**Note:** The exact props for `MapboxMap` and `TripItineraryTimelineCard` need to match what those components accept. Read the component props interfaces and adjust accordingly. The key additions are:
- Pass `readOnly` prop to hide edit controls
- Transform the Prisma trip shape to match the component's expected `ItineraryStructuredData` shape if needed

- [ ] **Step 2: Verify routing works**

```bash
# Start frontend dev server
cd frontend && npm run dev

# Open in browser:
# http://localhost:3000/trips/shared/<shareToken>
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/app/\(public\)/trips/shared/\[shareToken\]/page.tsx
git commit -m "feat(share): add public shared trip page with duplicate button"
```

---

## Module 2: Place Enrichment

### Task 5: PlaceRepository (Backend)

**Files:**
- Create: `src/modules/place/infrastructure/repositories/PlaceRepository.js`

- [ ] **Step 1: Create PlaceRepository**

```js
import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

class PlaceRepository {
  async findById(placeId) {
    return prisma.cached_places.findUnique({
      where: { id: placeId },
    });
  }

  async findByProviderAndExternalId(provider, externalId) {
    return prisma.cached_places.findUnique({
      where: {
        provider_externalId: { provider, externalId },
      },
    });
  }

  async upsertPlace(data) {
    return prisma.cached_places.upsert({
      where: {
        provider_externalId: {
          provider: data.provider,
          externalId: data.externalId,
        },
      },
      create: {
        ...data,
        lastFetchedAt: new Date(),
      },
      update: {
        ...data,
        lastFetchedAt: new Date(),
      },
    });
  }

  async updateEnrichedData(placeId, enrichedData, expiresAt) {
    return prisma.cached_places.update({
      where: { id: placeId },
      data: {
        enrichedData,
        lastFetchedAt: new Date(),
        expiresAt,
      },
    });
  }

  async searchNearby(query, lat, lng, radiusKm = 10) {
    // Use Prisma raw query with PostGIS for distance filtering
    // Fallback to simple bounding box if PostGIS not available
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    return prisma.cached_places.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      take: 20,
      orderBy: { rating: 'desc' },
    });
  }
}

export default new PlaceRepository();
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/modules/place/infrastructure/repositories
git add src/modules/place/infrastructure/repositories/PlaceRepository.js
git commit -m "feat(place): add PlaceRepository for cached_places CRUD"
```

---

### Task 6: PlaceEnrichmentService (Backend)

**Files:**
- Create: `src/modules/place/application/services/PlaceEnrichmentService.js`

- [ ] **Step 1: Create PlaceEnrichmentService**

```js
import serperService from '../../../ai/infrastructure/services/SerperService.js';
import placeRepository from '../../infrastructure/repositories/PlaceRepository.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const BASIC_CACHE_DAYS = 30;
const FULL_CACHE_DAYS = 7;

class PlaceEnrichmentService {
  /**
   * Level 1: Basic enrichment for a list of activities.
   * Called during draft compilation.
   */
  async enrichActivitiesBasic(activities, destination) {
    const results = [];

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < activities.length; i += 5) {
      const batch = activities.slice(i, i + 5);
      const promises = batch.map((activity) =>
        this.#enrichSingleBasic(activity, destination).catch((err) => {
          logger.warn('[Enrichment] Basic enrichment failed', {
            activity: activity.name,
            error: err.message,
          });
          return null;
        })
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  async #enrichSingleBasic(activity, destination) {
    const query = `${activity.name} ${destination}`;

    const { places } = await serperService.searchPlaces({
      query,
      skipCache: false,
    });

    if (!places || places.length === 0) return null;

    const best = places[0];

    // Also fetch images
    let photos = [];
    try {
      const imageResult = await serperService.searchImages({
        query: `${activity.name} ${destination}`,
        limit: 3,
      });
      if (imageResult?.images) {
        photos = imageResult.images.map((img) => img.url);
      }
    } catch {
      // Images are optional
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + BASIC_CACHE_DAYS);

    const place = await placeRepository.upsertPlace({
      provider: 'serper',
      externalId: best.cid || `serper-${query.replace(/\s+/g, '-')}`,
      name: best.name,
      address: best.address || '',
      city: destination,
      latitude: best.latitude,
      longitude: best.longitude,
      rating: best.rating,
      ratingCount: best.ratingCount,
      phone: best.phone,
      website: best.website,
      categories: best.category ? [best.category] : [],
      photos,
      type: this.#inferPlaceType(activity.type),
      expiresAt,
    });

    return { activityName: activity.name, placeId: place.id, place };
  }

  /**
   * Level 2: Full enrichment for a single place (on-demand).
   */
  async enrichPlaceFull(placeId) {
    const place = await placeRepository.findById(placeId);
    if (!place) return null;

    // Check cache
    if (
      place.enrichedData &&
      place.expiresAt &&
      place.expiresAt > new Date()
    ) {
      return place;
    }

    const query = `${place.name} ${place.city || ''}`.trim();

    // Fetch detailed info via web search
    let enrichedData = place.enrichedData || {};

    try {
      const webResult = await serperService.search({
        query: `${query} opening hours reviews`,
        limit: 5,
      });

      if (webResult.knowledgeGraph) {
        const kg = webResult.knowledgeGraph;
        enrichedData = {
          ...enrichedData,
          openingHours: kg.attributes?.Hours || null,
          description: kg.description || null,
          website: kg.website || place.website,
          phone: kg.phone || place.phone,
          reviewSnippets: [],
        };
      }

      // Extract review snippets from search results
      if (webResult.results) {
        const reviewSnippets = webResult.results
          .filter(
            (r) =>
              r.content &&
              (r.url.includes('tripadvisor') ||
                r.url.includes('google.com/maps') ||
                r.url.includes('yelp'))
          )
          .slice(0, 3)
          .map((r) => ({
            text: r.content,
            source: r.url,
            title: r.title,
          }));

        if (reviewSnippets.length > 0) {
          enrichedData.reviewSnippets = reviewSnippets;
        }
      }
    } catch (err) {
      logger.warn('[Enrichment] Full enrichment failed', {
        placeId,
        error: err.message,
      });
    }

    // Fetch additional images if current photos are sparse
    if (!place.photos || place.photos.length < 3) {
      try {
        const imageResult = await serperService.searchImages({
          query,
          limit: 5,
        });
        if (imageResult?.images) {
          const newPhotos = imageResult.images.map((img) => img.url);
          const allPhotos = [
            ...(place.photos || []),
            ...newPhotos,
          ];
          // Deduplicate
          const uniquePhotos = [...new Set(allPhotos)].slice(0, 8);
          await placeRepository.upsertPlace({
            ...place,
            photos: uniquePhotos,
          });
        }
      } catch {
        // Images are optional
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + FULL_CACHE_DAYS);

    const updated = await placeRepository.updateEnrichedData(
      placeId,
      enrichedData,
      expiresAt
    );

    return updated;
  }

  /**
   * Search for places near coordinates.
   */
  async searchPlaces(query, lat, lng) {
    // First check local cache
    const cached = await placeRepository.searchNearby(
      query,
      lat,
      lng
    );
    if (cached.length >= 5) return cached;

    // Fallback to Serper
    const serperQuery = lat && lng
      ? `${query} near ${lat},${lng}`
      : query;

    const { places } = await serperService.searchPlaces({
      query: serperQuery,
    });

    // Upsert results into cache
    const upserted = [];
    for (const p of places || []) {
      try {
        const place = await placeRepository.upsertPlace({
          provider: 'serper',
          externalId: p.cid || `serper-${p.name}-${p.address}`,
          name: p.name,
          address: p.address || '',
          latitude: p.latitude,
          longitude: p.longitude,
          rating: p.rating,
          ratingCount: p.ratingCount,
          phone: p.phone,
          website: p.website,
          categories: p.category ? [p.category] : [],
          photos: [],
          type: 'OTHER',
        });
        upserted.push(place);
      } catch {
        // Skip duplicates
      }
    }

    return upserted;
  }

  #inferPlaceType(activityType) {
    const typeMap = {
      HOTEL: 'HOTEL',
      ACCOMMODATION: 'HOTEL',
      RESTAURANT: 'RESTAURANT',
      DINING: 'RESTAURANT',
      ATTRACTION: 'ATTRACTION',
      ACTIVITY: 'ACTIVITY',
      TRANSPORT: 'TRANSPORT',
      TRANSPORTATION: 'TRANSPORT',
    };
    return typeMap[activityType] || 'OTHER';
  }
}

export default new PlaceEnrichmentService();
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/modules/place/application/services
git add src/modules/place/application/services/PlaceEnrichmentService.js
git commit -m "feat(place): add PlaceEnrichmentService with Serper integration"
```

---

### Task 7: Place Routes + Controller (Backend)

**Files:**
- Create: `src/modules/place/interfaces/http/placeController.js`
- Create: `src/modules/place/interfaces/http/placeRoutes.js`
- Modify: Route mounting (find main app router file)

- [ ] **Step 1: Find and read the main route mounting file**

```bash
grep -r "tripRoutes\|router.use.*trips" src/app.js src/routes/ src/index.js 2>/dev/null | head -10
```

- [ ] **Step 2: Create placeController.js**

```js
import { query, param, validationResult } from 'express-validator';
import {
  sendSuccess,
  sendValidationError,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import placeEnrichmentService from '../../application/services/PlaceEnrichmentService.js';

export const enrichPlace = asyncHandler(async (req, res) => {
  const { placeId } = req.params;

  const place = await placeEnrichmentService.enrichPlaceFull(placeId);

  if (!place) {
    throw AppError.notFound('Place not found');
  }

  return sendSuccess(res, { place });
});

export const searchPlaces = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors.array());

  const { query: q, lat, lng } = req.query;

  const places = await placeEnrichmentService.searchPlaces(
    q,
    lat ? parseFloat(lat) : null,
    lng ? parseFloat(lng) : null
  );

  return sendSuccess(res, { places });
});

export const searchPlacesValidation = [
  query('query')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Query is required'),
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];
```

- [ ] **Step 3: Create placeRoutes.js**

```js
import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as placeController from './placeController.js';

const router = Router();

router.use(authenticate);

router.get('/:placeId/enrich', placeController.enrichPlace);
router.get(
  '/search',
  placeController.searchPlacesValidation,
  placeController.searchPlaces
);

export default router;
```

- [ ] **Step 4: Mount place routes in the main app router**

Find the file where `/api/trips` is mounted and add `/api/places` alongside it:

```js
import placeRoutes from './modules/place/interfaces/http/placeRoutes.js';

// Add alongside existing routes:
router.use('/api/places', placeRoutes);
```

- [ ] **Step 5: Test manually**

```bash
# Search places
curl "http://localhost:5000/api/places/search?query=pho+restaurants&lat=21.028&lng=105.854" \
  -H "Authorization: Bearer <jwt>" | jq .

# Enrich a place
curl "http://localhost:5000/api/places/<placeId>/enrich" \
  -H "Authorization: Bearer <jwt>" | jq .
```

- [ ] **Step 6: Commit**

```bash
mkdir -p src/modules/place/interfaces/http
git add src/modules/place/interfaces/http/placeController.js \
  src/modules/place/interfaces/http/placeRoutes.js
# Also add the modified app router file
git commit -m "feat(place): add place enrichment and search API endpoints"
```

---

### Task 8: Integrate Level 1 Enrichment into DraftCompilerService

**Files:**
- Modify: `src/modules/trip/application/services/DraftCompilerService.js`

- [ ] **Step 1: Read current DraftCompilerService to find the right insertion point**

```bash
grep -n 'compileDraftIfNeeded\|compileGeneratedData\|#resolveActivities\|Pass 1\|Pass 2' \
  src/modules/trip/application/services/DraftCompilerService.js
```

- [ ] **Step 2: Add enrichment after compilation**

At the end of the `#compileGeneratedData` method (after Pass 2), or in `compileDraftIfNeeded` after `#compileGeneratedData` returns, add:

```js
import placeEnrichmentService from '../../../place/application/services/PlaceEnrichmentService.js';

// After compiled data is ready, enrich activities that lack placeId
const activitiesToEnrich = compiledDays
  .flatMap((day) => day.activities)
  .filter((a) => !a.placeId && a.name);

if (activitiesToEnrich.length > 0) {
  const destination = compiledData.destination || '';
  try {
    const enrichResults =
      await placeEnrichmentService.enrichActivitiesBasic(
        activitiesToEnrich,
        destination
      );

    // Link enrichment results back to activities
    for (const result of enrichResults) {
      if (!result) continue;
      const activity = activitiesToEnrich.find(
        (a) => a.name === result.activityName
      );
      if (activity) {
        activity.placeId = result.placeId;
        if (result.place.latitude) activity.latitude = result.place.latitude;
        if (result.place.longitude) activity.longitude = result.place.longitude;
        if (result.place.address) activity.customAddress = result.place.address;
      }
    }
  } catch (err) {
    logger.warn('[DraftCompiler] Enrichment failed, continuing without', {
      error: err.message,
    });
  }
}
```

- [ ] **Step 3: Test with a new trip creation via AI chat**

Create a new trip via the chat to verify enrichment runs and activities get placeIds.

- [ ] **Step 4: Commit**

```bash
git add src/modules/trip/application/services/DraftCompilerService.js
git commit -m "feat(place): integrate Level 1 Serper enrichment into DraftCompilerService"
```

---

## Module 3: UI Enhancements

### Task 9: Place Service (Frontend)

**Files:**
- Create: `frontend/src/services/placeService.ts`

- [ ] **Step 1: Create placeService.ts**

```ts
import api from '@/src/lib/api';

export interface EnrichedPlace {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  rating: number | null;
  ratingCount: number | null;
  phone: string | null;
  website: string | null;
  photos: string[];
  categories: string[];
  enrichedData: {
    openingHours?: string | null;
    description?: string | null;
    reviewSnippets?: Array<{
      text: string;
      source: string;
      title: string;
    }>;
    amenities?: string[];
  } | null;
}

const placeService = {
  async enrichPlace(placeId: string): Promise<EnrichedPlace> {
    const response = await api.get(`/places/${placeId}/enrich`);
    return response.data.data.place;
  },

  async searchPlaces(
    query: string,
    lat?: number,
    lng?: number
  ): Promise<EnrichedPlace[]> {
    const params = new URLSearchParams({ query });
    if (lat != null) params.set('lat', lat.toString());
    if (lng != null) params.set('lng', lng.toString());
    const response = await api.get(
      `/places/search?${params.toString()}`
    );
    return response.data.data.places;
  },
};

export default placeService;
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/services/placeService.ts
git commit -m "feat(place): add placeService API client for enrichment"
```

---

### Task 10: Map Marker Popup (Frontend)

**Files:**
- Create: `frontend/src/components/features/trip/MapMarkerPopup.tsx`
- Modify: `frontend/src/components/features/chat/MapboxMap.tsx`

- [ ] **Step 1: Create MapMarkerPopup component**

```tsx
'use client';

import { Star } from '@phosphor-icons/react';

interface MapMarkerPopupProps {
  name: string;
  type?: string;
  imageUrl?: string;
  rating?: number | null;
  ratingCount?: number | null;
  onViewDetails: () => void;
}

export default function MapMarkerPopup({
  name,
  type,
  imageUrl,
  rating,
  ratingCount,
  onViewDetails,
}: MapMarkerPopupProps) {
  return (
    <div className="w-[240px] overflow-hidden rounded-lg bg-[var(--neutral-10)] shadow-lg">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="h-[100px] w-full object-cover"
        />
      )}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-[var(--neutral-100)] line-clamp-1">
          {name}
        </h4>
        <div className="mt-1 flex items-center gap-2">
          {type && (
            <span className="rounded bg-[var(--neutral-20)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--neutral-60)]">
              {type}
            </span>
          )}
          {rating != null && (
            <span className="flex items-center gap-0.5 text-xs text-[var(--neutral-70)]">
              <Star size={12} weight="fill" className="text-amber-400" />
              {rating.toFixed(1)}
              {ratingCount != null && (
                <span className="text-[var(--neutral-50)]">
                  ({ratingCount})
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-2 w-full rounded-md bg-[var(--primary-main)] py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
        >
          View details
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add click handler to MapboxMap**

In `MapboxMap.tsx`, find where markers are rendered. Add an `onClick` handler that:
1. Sets `selectedMarker` state with the activity data
2. Shows a Mapbox `Popup` component at the marker's coordinates
3. Renders `MapMarkerPopup` inside the popup
4. "View details" calls a callback prop like `onActivitySelect(activity)` that the parent page handles

Key code to add in MapboxMap:

```tsx
import { Popup } from 'react-map-gl';
import MapMarkerPopup from '../trip/MapMarkerPopup';

// State:
const [selectedMarker, setSelectedMarker] = useState<ActivityData | null>(null);

// In marker click handler:
onClick={() => setSelectedMarker(activity)}

// After markers, before closing Map:
{selectedMarker && (
  <Popup
    latitude={selectedMarker.latitude}
    longitude={selectedMarker.longitude}
    anchor="bottom"
    onClose={() => setSelectedMarker(null)}
    closeOnClick={false}
    className="map-popup"
  >
    <MapMarkerPopup
      name={selectedMarker.name}
      type={selectedMarker.type}
      imageUrl={selectedMarker.imageUrl || selectedMarker.thumbnail}
      rating={selectedMarker.googleMapsInfo?.rating}
      ratingCount={selectedMarker.googleMapsInfo?.ratingCount}
      onViewDetails={() => {
        onActivitySelect?.(selectedMarker);
        setSelectedMarker(null);
      }}
    />
  </Popup>
)}
```

Add `onActivitySelect?: (activity: ActivityData) => void` to the MapboxMap props interface.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/features/trip/MapMarkerPopup.tsx \
  src/components/features/chat/MapboxMap.tsx
git commit -m "feat(map): add marker click popup with place preview"
```

---

### Task 11: Place Detail Side Panel (Frontend)

**Files:**
- Create: `frontend/src/components/features/trip/PlaceDetailPanel.tsx`

- [ ] **Step 1: Create PlaceDetailPanel**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Globe,
  MapPin,
  Phone,
  Star,
} from '@phosphor-icons/react';
import placeService, {
  type EnrichedPlace,
} from '@/src/services/placeService';

interface PlaceDetailPanelProps {
  placeId: string | null;
  activityData: {
    name: string;
    type?: string;
    estimatedCost?: number;
    currency?: string;
    description?: string;
    address?: string;
    imageUrl?: string;
    photos?: string[];
  };
  onClose: () => void;
}

export default function PlaceDetailPanel({
  placeId,
  activityData,
  onClose,
}: PlaceDetailPanelProps) {
  const [place, setPlace] = useState<EnrichedPlace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    placeService
      .enrichPlace(placeId)
      .then(setPlace)
      .catch(() => {
        // Use activity data as fallback
      })
      .finally(() => setLoading(false));
  }, [placeId]);

  const photos = place?.photos?.length
    ? place.photos
    : activityData.photos?.length
      ? activityData.photos
      : activityData.imageUrl
        ? [activityData.imageUrl]
        : [];

  const name = place?.name || activityData.name;
  const address = place?.address || activityData.address;
  const rating = place?.rating;
  const ratingCount = place?.ratingCount;
  const enriched = place?.enrichedData;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--neutral-30)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-[var(--neutral-20)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-[var(--neutral-100)] line-clamp-1">
          {name}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image Gallery */}
        {photos.length > 0 && (
          <div className="flex gap-1 overflow-x-auto p-1">
            {photos.slice(0, 5).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${name} ${i + 1}`}
                className="h-[160px] min-w-[200px] rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-[var(--primary-main)] border-t-transparent rounded-full" />
          </div>
        )}

        <div className="space-y-4 p-4">
          {/* Rating */}
          {rating != null && (
            <div className="flex items-center gap-2">
              <Star
                size={16}
                weight="fill"
                className="text-amber-400"
              />
              <span className="text-sm font-medium">
                {rating.toFixed(1)}
              </span>
              {ratingCount != null && (
                <span className="text-xs text-[var(--neutral-60)]">
                  ({ratingCount} reviews)
                </span>
              )}
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="flex items-start gap-2">
              <MapPin
                size={16}
                className="mt-0.5 shrink-0 text-[var(--neutral-60)]"
              />
              <span className="text-sm text-[var(--neutral-80)]">
                {address}
              </span>
            </div>
          )}

          {/* Opening Hours */}
          {enriched?.openingHours && (
            <div className="flex items-start gap-2">
              <Clock
                size={16}
                className="mt-0.5 shrink-0 text-[var(--neutral-60)]"
              />
              <span className="text-sm text-[var(--neutral-80)]">
                {enriched.openingHours}
              </span>
            </div>
          )}

          {/* Phone */}
          {place?.phone && (
            <div className="flex items-center gap-2">
              <Phone
                size={16}
                className="text-[var(--neutral-60)]"
              />
              <a
                href={`tel:${place.phone}`}
                className="text-sm text-[var(--primary-main)]"
              >
                {place.phone}
              </a>
            </div>
          )}

          {/* Website */}
          {place?.website && (
            <div className="flex items-center gap-2">
              <Globe
                size={16}
                className="text-[var(--neutral-60)]"
              />
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--primary-main)] truncate"
              >
                {place.website}
              </a>
            </div>
          )}

          {/* Description */}
          {(enriched?.description || activityData.description) && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-1">
                About
              </h4>
              <p className="text-sm text-[var(--neutral-80)]">
                {enriched?.description || activityData.description}
              </p>
            </div>
          )}

          {/* Cost */}
          {activityData.estimatedCost != null && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-1">
                Estimated Cost
              </h4>
              <p className="text-sm font-medium text-[var(--neutral-100)]">
                {activityData.estimatedCost.toLocaleString()}{' '}
                {activityData.currency || 'USD'}
              </p>
            </div>
          )}

          {/* Review Snippets */}
          {enriched?.reviewSnippets &&
            enriched.reviewSnippets.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-2">
                  Reviews
                </h4>
                <div className="space-y-2">
                  {enriched.reviewSnippets.map((review, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-[var(--neutral-20)] p-3"
                    >
                      <p className="text-xs text-[var(--neutral-80)]">
                        &ldquo;{review.text}&rdquo;
                      </p>
                      <a
                        href={review.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-[10px] text-[var(--primary-main)]"
                      >
                        {review.title}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Google Maps Link */}
          {place?.latitude && place?.longitude && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-[var(--neutral-30)] py-2.5 text-sm font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] transition-colors"
            >
              <MapPin size={16} />
              Open in Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/features/trip/PlaceDetailPanel.tsx
git commit -m "feat(place): add PlaceDetailPanel with Serper enrichment"
```

---

### Task 12: Wire Map Popup → Detail Panel in Chat Page

**Files:**
- Modify: `frontend/src/app/(app)/chat/[conversationId]/page.tsx`
- Modify: `frontend/src/stores/chatStore.ts`

- [ ] **Step 1: Add selectedPlace state to chatStore**

```ts
// In chatStore state type, add:
selectedPlace: {
  placeId: string | null;
  activityData: any;
} | null;

// In chatStore actions, add:
setSelectedPlace: (place: { placeId: string | null; activityData: any } | null) => void;

// In store implementation:
selectedPlace: null,
setSelectedPlace: (place) => set({ selectedPlace: place }),
```

- [ ] **Step 2: In the chat page, handle map activity selection**

When `onActivitySelect` fires from MapboxMap:
- Set `selectedPlace` in store
- Right panel switches from timeline to `PlaceDetailPanel`
- When `PlaceDetailPanel.onClose` fires → clear `selectedPlace`, show timeline again

```tsx
// In the chat page component:
const { selectedPlace, setSelectedPlace } = useChatStore();

// Pass to MapboxMap:
<MapboxMap
  {...existingProps}
  onActivitySelect={(activity) => {
    setSelectedPlace({
      placeId: activity.placeId || null,
      activityData: activity,
    });
  }}
/>

// Right panel logic:
{selectedPlace ? (
  <PlaceDetailPanel
    placeId={selectedPlace.placeId}
    activityData={selectedPlace.activityData}
    onClose={() => setSelectedPlace(null)}
  />
) : (
  <TripItineraryTimelineCard ... />
)}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/stores/chatStore.ts \
  src/app/\(app\)/chat/\[conversationId\]/page.tsx
git commit -m "feat(map): wire marker popup to place detail panel"
```

---

### Task 13: Inline Activity Editing (Frontend)

**Files:**
- Create: `frontend/src/components/features/trip/ActivityEditor.tsx`
- Modify: `frontend/src/components/features/chat/page/TripItineraryTimelineCard.tsx`

- [ ] **Step 1: Create ActivityEditor component**

An inline form that appears when clicking edit on an activity in the timeline.

```tsx
'use client';

import { useCallback, useState } from 'react';
import { Check, X } from '@phosphor-icons/react';
import tripService from '@/src/services/tripService';
import { toast } from '@/src/components/ui/use-toast';

interface ActivityEditorProps {
  tripId: string;
  activityId: string;
  initial: {
    name: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    estimatedCost?: number;
    currency?: string;
    notes?: string;
  };
  onSave: (updated: any) => void;
  onCancel: () => void;
}

export default function ActivityEditor({
  tripId,
  activityId,
  initial,
  onSave,
  onCancel,
}: ActivityEditorProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await tripService.updateActivity(tripId, activityId, {
        name: form.name,
        description: form.description || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        estimatedCost: form.estimatedCost
          ? Number(form.estimatedCost)
          : undefined,
        notes: form.notes || undefined,
      });
      onSave(form);
      toast.success('Activity updated');
    } catch {
      toast.error('Failed to update activity');
    } finally {
      setSaving(false);
    }
  }, [form, tripId, activityId, onSave]);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--primary-main)] bg-[var(--primary-surface)] p-3">
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        placeholder="Activity name"
      />

      <div className="flex gap-2">
        <input
          type="time"
          value={form.startTime || ''}
          onChange={(e) =>
            setForm({ ...form, startTime: e.target.value })
          }
          className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        />
        <input
          type="time"
          value={form.endTime || ''}
          onChange={(e) =>
            setForm({ ...form, endTime: e.target.value })
          }
          className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        />
      </div>

      <textarea
        value={form.description || ''}
        onChange={(e) =>
          setForm({ ...form, description: e.target.value })
        }
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        rows={2}
        placeholder="Description"
      />

      <input
        type="number"
        value={form.estimatedCost ?? ''}
        onChange={(e) =>
          setForm({
            ...form,
            estimatedCost: e.target.value
              ? Number(e.target.value)
              : undefined,
          })
        }
        className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
        placeholder="Estimated cost"
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-[var(--neutral-60)] hover:bg-[var(--neutral-20)]"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-md bg-[var(--primary-main)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add updateActivity and deleteActivity to tripService.ts**

Check if these methods already exist. If not, add:

```ts
async updateActivity(
  tripId: string,
  activityId: string,
  data: Record<string, any>
) {
  const response = await api.patch(
    `/trips/${tripId}/activities/${activityId}`,
    data
  );
  return response.data;
},

async deleteActivity(tripId: string, activityId: string) {
  await api.delete(`/trips/${tripId}/activities/${activityId}`);
},

async reorderActivities(
  tripId: string,
  dayId: string,
  activityIds: string[]
) {
  const response = await api.patch(
    `/trips/${tripId}/days/${dayId}/activities/reorder`,
    { activityIds }
  );
  return response.data;
},

async addActivity(
  tripId: string,
  dayId: string,
  data: Record<string, any>
) {
  const response = await api.post(
    `/trips/${tripId}/days/${dayId}/activities`,
    data
  );
  return response.data;
},
```

- [ ] **Step 3: Integrate ActivityEditor into TripItineraryTimelineCard**

In the timeline card, for each activity:
- Add an edit icon button (PencilSimple from phosphor-icons)
- When clicked, toggle `editingActivityId` state
- If `editingActivityId === activity.id`, render `<ActivityEditor>` instead of the normal activity display
- On save, update local state optimistically
- Add delete button with confirmation
- Only show edit/delete controls when `readOnly` prop is false (or not set)

This is a surgical edit — find the activity rendering loop and add the toggle.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/components/features/trip/ActivityEditor.tsx \
  src/services/tripService.ts \
  src/components/features/chat/page/TripItineraryTimelineCard.tsx
git commit -m "feat(timeline): add inline activity editing with time/cost/description"
```

---

### Task 14: Add Activity + Reorder (Frontend)

**Files:**
- Create: `frontend/src/components/features/trip/AddActivityForm.tsx`
- Modify: `frontend/src/components/features/chat/page/TripItineraryTimelineCard.tsx`

- [ ] **Step 1: Create AddActivityForm component**

```tsx
'use client';

import { useCallback, useState } from 'react';
import {
  MagnifyingGlass,
  MapPin,
  Plus,
  X,
} from '@phosphor-icons/react';
import placeService from '@/src/services/placeService';
import tripService from '@/src/services/tripService';
import { toast } from '@/src/components/ui/use-toast';

interface AddActivityFormProps {
  tripId: string;
  dayId: string;
  cityLat?: number;
  cityLng?: number;
  onAdd: (activity: any) => void;
  onCancel: () => void;
}

export default function AddActivityForm({
  tripId,
  dayId,
  cityLat,
  cityLng,
  onAdd,
  onCancel,
}: AddActivityFormProps) {
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    type: 'ACTIVITY',
    startTime: '',
    estimatedCost: '',
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const places = await placeService.searchPlaces(
        query,
        cityLat,
        cityLng
      );
      setResults(places);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, cityLat, cityLng]);

  const handleSelectPlace = useCallback(
    async (place: any) => {
      setSaving(true);
      try {
        const result = await tripService.addActivity(tripId, dayId, {
          name: place.name,
          placeId: place.id,
          latitude: place.latitude,
          longitude: place.longitude,
          customAddress: place.address,
          type: place.type || 'ACTIVITY',
        });
        onAdd(result.data?.activity || result);
        toast.success(`Added ${place.name}`);
      } catch {
        toast.error('Failed to add activity');
      } finally {
        setSaving(false);
      }
    },
    [tripId, dayId, onAdd]
  );

  const handleAddCustom = useCallback(async () => {
    if (!customForm.name.trim()) return;
    setSaving(true);
    try {
      const result = await tripService.addActivity(tripId, dayId, {
        name: customForm.name,
        type: customForm.type,
        startTime: customForm.startTime || undefined,
        estimatedCost: customForm.estimatedCost
          ? Number(customForm.estimatedCost)
          : undefined,
      });
      onAdd(result.data?.activity || result);
      toast.success(`Added ${customForm.name}`);
    } catch {
      toast.error('Failed to add activity');
    } finally {
      setSaving(false);
    }
  }, [customForm, tripId, dayId, onAdd]);

  return (
    <div className="rounded-lg border border-dashed border-[var(--neutral-40)] bg-[var(--neutral-15)] p-3 space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === 'search'
              ? 'bg-[var(--primary-main)] text-white'
              : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
          }`}
        >
          <MagnifyingGlass size={12} className="inline mr-1" />
          Search places
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === 'custom'
              ? 'bg-[var(--primary-main)] text-white'
              : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
          }`}
        >
          <Plus size={12} className="inline mr-1" />
          Custom activity
        </button>
      </div>

      {mode === 'search' ? (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for a place..."
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-md bg-[var(--primary-main)] px-3 py-1.5 text-xs text-white"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  disabled={saving}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--neutral-20)] transition-colors"
                >
                  <MapPin
                    size={14}
                    className="shrink-0 text-[var(--neutral-60)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--neutral-100)] truncate">
                      {place.name}
                    </p>
                    <p className="text-[10px] text-[var(--neutral-60)] truncate">
                      {place.address}
                    </p>
                  </div>
                  {place.rating && (
                    <span className="text-[10px] text-[var(--neutral-60)]">
                      {place.rating}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <input
            type="text"
            value={customForm.name}
            onChange={(e) =>
              setCustomForm({ ...customForm, name: e.target.value })
            }
            placeholder="Activity name"
            className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={customForm.startTime}
              onChange={(e) =>
                setCustomForm({
                  ...customForm,
                  startTime: e.target.value,
                })
              }
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={customForm.estimatedCost}
              onChange={(e) =>
                setCustomForm({
                  ...customForm,
                  estimatedCost: e.target.value,
                })
              }
              placeholder="Cost"
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={saving || !customForm.name.trim()}
            className="w-full rounded-md bg-[var(--primary-main)] py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Activity'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="flex w-full items-center justify-center gap-1 text-xs text-[var(--neutral-60)] hover:text-[var(--neutral-80)]"
      >
        <X size={12} />
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add "+" button and delete to TripItineraryTimelineCard**

In the timeline card:
- After the last activity in each day, add a "+" button that toggles `AddActivityForm`
- For delete: add a trash icon on each activity, clicking it shows a confirm dialog, then calls `tripService.deleteActivity()`
- For reorder: the component already uses Framer Motion `Reorder` — verify it calls the reorder API on drag end. If not, add:

```tsx
onReorder={(newOrder) => {
  // Update local state immediately
  setDayActivities(newOrder);
  // Call API
  tripService.reorderActivities(
    tripId,
    dayId,
    newOrder.map(a => a.id)
  ).catch(() => {
    toast.error('Failed to reorder');
    // Rollback
    setDayActivities(previousOrder);
  });
}}
```

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/features/trip/AddActivityForm.tsx \
  src/components/features/chat/page/TripItineraryTimelineCard.tsx
git commit -m "feat(timeline): add activity creation, deletion, and drag reorder"
```

---

### Task 15: Integration Testing & Final Verification

- [ ] **Step 1: Test sharing end-to-end**

1. Open a trip in chat page
2. Click share → select SHARED → verify token is generated
3. Copy the share link
4. Open in incognito → verify trip renders without auth
5. Click "Save to my trips" → redirect to login → after login, trip is duplicated
6. Back in original tab → click PRIVATE → share link should stop working

- [ ] **Step 2: Test enrichment**

1. Create a new trip via AI chat
2. Verify activities have placeIds linked (check DB or API response)
3. Click on a marker on the map → verify popup shows
4. Click "View details" → verify side panel loads with enriched data

- [ ] **Step 3: Test inline editing**

1. Open a saved trip's timeline
2. Click edit on an activity → change time and description → save
3. Verify changes persist after page refresh
4. Drag an activity to reorder → verify new order persists
5. Delete an activity → verify it's gone
6. Add a new activity via search → verify it appears in timeline and map
7. Add a custom activity → verify it appears

- [ ] **Step 4: Test shared page is read-only**

1. Open a shared link
2. Verify no edit/delete/add buttons appear
3. Verify map shows markers but no edit controls on popup

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for sharing, enrichment, and inline editing"
```
