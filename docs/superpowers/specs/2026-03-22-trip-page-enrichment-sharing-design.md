# Trip Page Enrichment, Sharing & Inline Editing

**Date:** 2026-03-22
**Status:** Draft
**Approach:** Parallel modules (C) — 3 independent modules with defined interfaces

## Problem

The chat/trip page at `/chat/:conversationId` has three gaps:

1. **Map**: Clicking markers shows only tooltip names — no photos, ratings, descriptions, or detail panel
2. **Plan details**: Activities often lack enriched data (photos, ratings, opening hours, addresses) because `cached_places` aren't consistently linked
3. **Sharing**: Database schema exists (`trip_shares`, `shareToken`) but zero backend implementation — share links produce 404s

## Decisions

- Enrichment source: **Serper** (Google Maps provider unavailable)
- Share links: permanent by default, owner can revoke anytime
- Shared view: full read-only trip (map + itinerary + budget) + duplicate to own account
- Map interaction: popup on marker click → "View details" opens side panel
- Inline editing: time, details, reorder (drag & drop), add/delete activities

---

## Module 1: Trip Sharing

### Backend

#### Token Lifecycle

1. **Generate**: `POST /api/trips/:tripId/share`
   - Auth: trip owner only
   - Generate `shareToken` via `crypto.randomBytes(16).toString('hex')` (32 chars)
   - Update `trips.shareToken` column
   - Create `trip_shares` record: `{ tripId, shareToken, permission: VIEWER, expiresAt: null }`
   - Update `trips.visibility` to `SHARED`
   - Return `{ shareToken, shareUrl }`

2. **Revoke**: `DELETE /api/trips/:tripId/share`
   - Auth: trip owner only
   - Set `trips.shareToken = null`
   - Delete `trip_shares` record
   - Set `trips.visibility = PRIVATE`

3. **Access**: `GET /api/trips/shared/:shareToken`
   - No auth required
   - Lookup trip via `shareToken`
   - Return full trip data: itinerary days, activities (with place data), budget, overview, tips
   - Increment `trip_shares.accessCount` and update `accessedAt`
   - 404 if token invalid or revoked

4. **Duplicate**: `POST /api/trips/shared/:shareToken/duplicate`
   - Auth required (any authenticated user)
   - Deep clone: trip → itinerary_days → activities (with place refs, images)
   - New trip: `ownerId = authenticated user`, `status = DRAFT`, `visibility = PRIVATE`, no shareToken
   - Return new trip ID

#### Architecture (follows existing patterns)

```
tripRoutes.js          → add share routes
TripShareController.js → new controller for share endpoints
TripShareService.js    → token generation, revoke, access logic
TripRepository.js      → add findByShareToken(), updateShareToken() queries
TripDuplicateService.js → deep clone logic (may already exist via /duplicate endpoint)
```

#### Data Flow

```
POST /share → TripShareController → TripShareService.generateToken()
  → TripRepository.updateShareToken(tripId, token)
  → TripShareRepository.create({ tripId, token })
  → return { shareToken, shareUrl }

GET /shared/:token → TripShareController → TripShareService.getSharedTrip()
  → TripRepository.findByShareToken(token) [include full itinerary]
  → TripShareRepository.incrementAccess(token)
  → return tripData (sanitized, no owner PII)
```

### Frontend

#### Shared Trip Page (`/trips/shared/[shareToken]/page.tsx`)

- Layout: full-width, no left chat panel
- Top: trip header (destination, dates, travelers, budget)
- Left: MapboxMap with all markers and routes (read-only)
- Right: TripItineraryTimelineCard (read-only, no edit controls)
- Bottom bar: "Duplicate to my trips" button
  - If not logged in → redirect to login with return URL
  - If logged in → call `POST /api/trips/shared/:shareToken/duplicate` → redirect to new trip
- Error state: 404 page if token invalid

#### ShareTripModal Changes

Current behavior: calls `PATCH /trips/:id { visibility }` only.

New behavior:
- When user selects SHARED:
  1. Call `POST /api/trips/:tripId/share`
  2. Receive `shareUrl` from response
  3. Display share URL for copy/social sharing
- When user selects PRIVATE (was SHARED):
  1. Call `DELETE /api/trips/:tripId/share`
  2. Clear share URL from UI
- Share URL format: `${origin}/trips/shared/${shareToken}`
- Add "Revoke link" button when trip is currently shared

---

## Module 2: Place Enrichment via Serper

### PlaceEnrichmentService

Central service for enriching place data using Serper Search API.

#### Enrichment Levels

**Level 1 — Basic (at trip creation, in DraftCompilerService):**
- Trigger: after DraftCompilerService creates activities from AI draft
- For each activity with coordinates or name+city:
  - Search Serper Places: `query = "{activity.name} {city}"` with `ll` param if coordinates available
  - Extract: photos (first 3-5), rating, ratingCount, address, category, placeId (CID)
  - Create/update `cached_places` record
  - Link `activity.placeId` to cached_places record
- Batch processing: max 10 concurrent Serper calls per trip
- Failure handling: log warning, keep activity without place link

**Level 2 — Full (on-demand, when user clicks):**
- Trigger: `GET /api/places/:placeId/enrich`
- If `cached_places.enrichedData` exists and `expiresAt > now` → return cache
- Otherwise, call Serper with place name + coordinates:
  - Extract: opening hours, website, phone, reviews snippet, amenities, price level
  - Update `cached_places.enrichedData` JSON field
  - Set `expiresAt = now + 7 days`
- Return full enriched data

#### API Endpoints

- `GET /api/places/:placeId/enrich` — returns enriched place, triggers Serper if cache miss
- `GET /api/places/search?query=...&lat=...&lng=...` — search nearby places (for "add activity" feature)

#### Serper Integration

```
SerperPlaceProvider.js (new, in modules/ai/infrastructure/services/providers/)
  - searchPlaces(query, { lat, lng, radius }) → basic place data
  - enrichPlace(placeId, name, { lat, lng }) → full enriched data
  - Uses existing Serper API key from config
```

#### Cache Strategy

- `cached_places` table already has `lastFetchedAt`, `expiresAt` fields
- Level 1 data: expires in 30 days (photos/ratings change slowly)
- Level 2 data: expires in 7 days (opening hours can change)
- Provider field: `SERPER` for new records

#### Data Mapping (Serper → cached_places)

| Serper Field | cached_places Field |
|---|---|
| title | name |
| rating | rating |
| ratingCount | ratingCount |
| address | address |
| latitude/longitude | latitude/longitude |
| category | categories (array) |
| thumbnails/images | photos (array) |
| phone | phone |
| website | website |
| hours | enrichedData.openingHours |
| amenities | enrichedData.amenities |
| price | priceLevel (mapped to enum) |
| reviews | enrichedData.reviewSnippets |

---

## Module 3: UI Enhancements

### Map Interactions

#### Marker Popup (on click)

When user clicks a numbered marker on the map:
- Show Mapbox popup anchored to marker
- Content: thumbnail image (120x80), activity name, type badge, rating (stars + count), "View details" link
- Clicking outside popup or another marker → close popup
- Data source: activity data + cached_places if available

#### Place Detail Side Panel

When user clicks "View details" from popup:
- Replace the right panel (timeline card) with `PlaceDetailPanel`
- Content sections:
  - Image gallery (carousel if multiple photos)
  - Name, type, rating with review count
  - Address with "Open in Google Maps" link
  - Opening hours (today highlighted)
  - Phone, website links
  - Description/reviews snippet
  - Estimated cost from activity
  - Transport from previous activity
- "Back to itinerary" button → restore timeline card
- If place not yet enriched → call `GET /api/places/:placeId/enrich` with loading skeleton
- If no placeId → show available activity data only (name, address, cost, times)

### Inline Editing (TripItineraryTimelineCard)

All edits call existing backend APIs. Only available on owned trips (not shared view).

#### Edit Activity Time
- Click on time display → inline time picker (HH:mm)
- On change → `PATCH /api/trips/:tripId/activities/:activityId { startTime, endTime }`
- Optimistic update with rollback on error

#### Edit Activity Details
- Click edit icon on activity → expand inline form
- Editable fields: name, description, estimatedCost, notes, bookingUrl
- Save/Cancel buttons
- `PATCH /api/trips/:tripId/activities/:activityId { ...fields }`

#### Reorder Activities
- Drag handle on each activity within a day
- Use `@dnd-kit/sortable` (or existing drag library if already in project)
- On drop → `PATCH /api/trips/:tripId/days/:dayId/activities/reorder { activityIds: [...] }`

#### Delete Activity
- Delete icon → confirm dialog "Remove {name} from itinerary?"
- `DELETE /api/trips/:tripId/activities/:activityId`
- Animate removal

#### Add Activity
- "+" button at bottom of each day section
- Opens mini-form:
  - Search box → calls `GET /api/places/search?query=...&lat=...&lng=...` (uses day's city coordinates)
  - Select from results or "Add custom activity"
  - Set: name, type, time, estimated cost
- `POST /api/trips/:tripId/days/:dayId/activities { ...data }`
- New activity appears at end of day, can be reordered

---

## Interface Contracts Between Modules

### Module 1 (Sharing) depends on:
- Existing trip data structure (no changes needed)
- Module 3 components for shared page (reuse read-only versions of MapboxMap + TripItineraryTimelineCard)

### Module 2 (Enrichment) depends on:
- `cached_places` table (already exists)
- Serper API key (already configured for search)

### Module 3 (UI) depends on:
- Module 2's enrichment endpoint for place detail panel
- Existing activity CRUD endpoints (already implemented)
- Graceful degradation: show available data even if enrichment unavailable

### Shared Types

```typescript
// Place data returned by enrichment endpoint
interface EnrichedPlace {
  id: string
  name: string
  type: PlaceType
  latitude: number
  longitude: number
  address: string
  city: string
  country: string
  rating: number | null
  ratingCount: number | null
  priceLevel: string | null
  phone: string | null
  website: string | null
  photos: string[]
  categories: string[]
  openingHours: DayHours[] | null
  amenities: string[] | null
  reviewSnippets: ReviewSnippet[] | null
}

interface DayHours {
  day: string       // "Monday"
  hours: string     // "9:00 AM - 5:00 PM"
  isOpen: boolean   // true if currently open
}

interface ReviewSnippet {
  text: string
  rating: number
  author: string
}

// Share response
interface ShareResponse {
  shareToken: string
  shareUrl: string
}

// Shared trip response (public)
interface SharedTripResponse {
  trip: TripWithItinerary  // existing type, sanitized (no owner email/PII)
  sharedAt: string
  accessCount: number
}
```

---

## Implementation Notes

1. **Duplicate via share token**: Existing `POST /:tripId/duplicate` (TripAdvancedController) handles duplication for trip owners. The new `POST /shared/:shareToken/duplicate` should reuse the same `TripDuplicateService` logic but resolve the trip from the share token instead of tripId, and allow any authenticated user (not just owner).

2. **`trip_shares.sharedWithEmail`**: This column exists in the schema but is unused by this design (we use token-based public sharing only). Leave it nullable and unused — future per-user invite sharing can use it later.

3. **Activity validation**: The existing `addActivityValidation` in tripRoutes.js doesn't validate `bookingUrl` or `notes`. The inline edit form should only submit fields that the backend already accepts. Extend validation if needed during implementation.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid share token | 404 with "Trip not found or link has been revoked" |
| Serper API failure | Log error, return available cached data, show "Limited info available" in UI |
| Serper rate limit | Queue and retry with exponential backoff (max 3 retries) |
| Place not found in Serper | Keep activity data as-is, hide "enriched" sections in UI |
| Duplicate trip fails | Show error toast, don't navigate away |
| Activity edit conflict | Refetch latest data, show conflict message |
| Drag & drop reorder fails | Rollback to original order, show error toast |

---

## Testing Strategy

### Module 1 (Sharing)
- Unit: token generation uniqueness, access control (owner-only share/revoke)
- Integration: full flow — create share → access via token → duplicate
- Edge: revoked token returns 404, duplicate preserves all activity data

### Module 2 (Enrichment)
- Unit: Serper response mapping to cached_places schema
- Integration: enrichment on cache miss, cache hit returns stored data
- Edge: Serper failure fallback, expired cache re-fetch, activity without coordinates

### Module 3 (UI)
- Component: popup renders with partial data, side panel loading state
- Integration: edit → API call → UI update, reorder → API → UI
- Edge: rapid edits don't race, delete + undo, empty day after all activities deleted
