-- Phase 1: Core Features Migration
-- Date: 2026-02-06
-- Description: Add overview, transportation, bookings, and budget tracking
-- Status: APPLIED ✓

-- ═══════════════════════════════════════════════════════════════
-- 1. TRIPS TABLE: Add overview and metadata
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "overview" JSONB;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

COMMENT ON COLUMN "trips"."overview" IS 'Trip overview: { summary, highlights, weather, culturalNotes, bestTimeToVisit }';
COMMENT ON COLUMN "trips"."metadata" IS 'Trip metadata: { tips, budgetBreakdown, packingList, emergencyInfo }';

-- ═══════════════════════════════════════════════════════════════
-- 2. ACTIVITIES TABLE: Add transportation info
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "transportFromPrevious" JSONB;

COMMENT ON COLUMN "activities"."transportFromPrevious" IS 'Transportation from previous activity: { distance, duration, mode, cost, instructions, routePolyline }';

-- ═══════════════════════════════════════════════════════════════
-- 3. TRIP_BOOKINGS TABLE: Manage all bookings
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "trip_bookings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "tripId" TEXT NOT NULL,
  "activityId" TEXT,
  "bookingType" TEXT NOT NULL, -- 'HOTEL', 'FLIGHT', 'RESTAURANT', 'TOUR', 'TRANSPORT'
  "provider" TEXT, -- 'Booking.com', 'Agoda', 'Klook', etc.
  "providerBookingId" TEXT,
  "confirmationCode" TEXT,
  "bookingUrl" TEXT,
  "status" TEXT DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'CANCELLED'

  -- Common fields
  "title" TEXT NOT NULL,
  "description" TEXT,
  "checkInDate" TIMESTAMP,
  "checkOutDate" TIMESTAMP,
  "checkInTime" TIME,
  "checkOutTime" TIME,

  -- Financial
  "totalCost" DECIMAL(12, 2),
  "currency" TEXT DEFAULT 'USD',
  "paymentStatus" TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PAID', 'REFUNDED'

  -- Participants
  "guestsCount" INTEGER DEFAULT 1,
  "guestNames" TEXT[],

  -- Location
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,

  -- Contact
  "contactPhone" TEXT,
  "contactEmail" TEXT,

  -- Additional details (type-specific data)
  "details" JSONB, -- { roomType, flightNumber, tourGuide, etc. }

  -- Files
  "attachments" TEXT[], -- URLs to confirmation emails, tickets, etc.

  -- Timestamps
  "bookingDate" TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "deletedAt" TIMESTAMP,

  CONSTRAINT "fk_trip_bookings_trip" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_trip_bookings_activity" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_trip_bookings_tripId" ON "trip_bookings"("tripId");
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_activityId" ON "trip_bookings"("activityId");
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_type" ON "trip_bookings"("bookingType");
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_status" ON "trip_bookings"("status");
CREATE INDEX IF NOT EXISTS "idx_trip_bookings_checkIn" ON "trip_bookings"("checkInDate");

-- ═══════════════════════════════════════════════════════════════
-- 4. ACCOMMODATION_ACTIVITIES TABLE: Extended hotel/lodging details
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "accommodation_activities" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "activityId" TEXT UNIQUE NOT NULL,

  -- Accommodation details
  "accommodationType" TEXT, -- 'HOTEL', 'HOSTEL', 'APARTMENT', 'RESORT', 'GUESTHOUSE'
  "roomType" TEXT, -- 'Single', 'Double', 'Suite', etc.
  "bedType" TEXT, -- 'King', 'Queen', 'Twin', etc.

  -- Check-in/out
  "checkInTime" TIME,
  "checkOutTime" TIME,
  "earlyCheckInAvailable" BOOLEAN DEFAULT false,
  "lateCheckOutAvailable" BOOLEAN DEFAULT false,

  -- Amenities
  "amenities" TEXT[], -- ['WiFi', 'Breakfast', 'Pool', 'Gym', 'Parking', 'AC', ...]
  "breakfastIncluded" BOOLEAN DEFAULT false,

  -- Policies
  "cancellationPolicy" TEXT,
  "petPolicy" TEXT,
  "smokingAllowed" BOOLEAN DEFAULT false,

  -- Nearby
  "nearbyPlaces" JSONB, -- [{ name, type, distance, walkingTime }]

  -- Additional info
  "specialRequests" TEXT,
  "notes" TEXT,

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT "fk_accommodation_activities_activity" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_accommodation_activities_activityId" ON "accommodation_activities"("activityId");

-- ═══════════════════════════════════════════════════════════════
-- 5. ITINERARY_DAYS TABLE: Add daily summary metadata
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

COMMENT ON COLUMN "itinerary_days"."metadata" IS 'Day metadata: { totalDistance, totalTravelTime, theme, tips, weatherData }';

-- ═══════════════════════════════════════════════════════════════
-- 6. Create Enums for type safety (optional - can use TEXT with constraints)
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE "BookingType" AS ENUM ('HOTEL', 'FLIGHT', 'RESTAURANT', 'TOUR', 'TRANSPORT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AccommodationType" AS ENUM ('HOTEL', 'HOSTEL', 'APARTMENT', 'RESORT', 'GUESTHOUSE', 'VILLA', 'CAMPING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TransportMode" AS ENUM ('WALK', 'TAXI', 'BUS', 'TRAIN', 'SUBWAY', 'CAR', 'BIKE', 'BOAT', 'FLIGHT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 7. Sample data structure comments (for reference)
-- ═══════════════════════════════════════════════════════════════

-- trips.overview example:
-- {
--   "summary": "A perfect 7-day trip exploring Munich and Berlin...",
--   "highlights": ["Oktoberfest", "Brandenburg Gate", "Neuschwanstein Castle"],
--   "weather": { "avgTemp": 22, "condition": "Partly cloudy", "season": "Summer" },
--   "culturalNotes": "Germany is known for...",
--   "bestTimeToVisit": "May to September"
-- }

-- trips.metadata example:
-- {
--   "tips": {
--     "general": ["Bring comfortable shoes", "Download offline maps"],
--     "transportation": ["Buy Bayern ticket for trains", "Use MVV app"],
--     "food": ["Try traditional beer gardens", "Book restaurants in advance"],
--     "safety": ["Watch for pickpockets at tourist spots"],
--     "budget": ["Supermarkets are cheaper than restaurants"]
--   },
--   "budgetBreakdown": {
--     "accommodation": { "total": 3500000, "perDay": 500000 },
--     "food": { "total": 2100000, "perDay": 300000 },
--     "transportation": { "total": 700000, "perDay": 100000 },
--     "activities": { "total": 1400000, "perDay": 200000 },
--     "miscellaneous": { "total": 350000, "perDay": 50000 }
--   },
--   "packingList": {
--     "clothes": ["4 sets of clothes", "Light jacket", "Walking shoes"],
--     "essentials": ["Passport", "Phone charger", "Cash/cards"],
--     "accessories": ["Sunscreen", "Hat", "Sunglasses"]
--   }
-- }

-- activities.transportFromPrevious example:
-- {
--   "distance": 2.5,
--   "distanceUnit": "km",
--   "duration": 15,
--   "durationUnit": "minutes",
--   "mode": "WALK",
--   "cost": 0,
--   "currency": "VND",
--   "instructions": "Walk south on Đinh Tiên Hoàng, turn left on Lê Thái Tổ",
--   "routePolyline": "encodedPolylineString..."
-- }

-- itinerary_days.metadata example:
-- {
--   "totalDistance": 12.5,
--   "totalTravelTime": 90,
--   "theme": "Cultural exploration",
--   "tips": ["Start early to avoid crowds", "Wear comfortable shoes"],
--   "weatherData": { "temp": 28, "condition": "Sunny", "humidity": 65 }
-- }
