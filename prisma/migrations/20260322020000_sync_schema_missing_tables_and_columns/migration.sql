-- Sync schema: add all missing enums, tables, and columns

-- ============================================================
-- 1. Missing ENUM types
-- ============================================================
CREATE TYPE "BookingType" AS ENUM ('HOTEL', 'FLIGHT', 'RESTAURANT', 'TOUR', 'TRANSPORT', 'OTHER');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'REFUNDED');
CREATE TYPE "AccommodationType" AS ENUM ('HOTEL', 'HOSTEL', 'APARTMENT', 'RESORT', 'GUESTHOUSE', 'VILLA', 'CAMPING');
CREATE TYPE "ImageAssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "ImageSourceProvider" AS ENUM ('GOOGLE_MAPS', 'PEXELS', 'UNSPLASH', 'PICSUM', 'MAPBOX', 'USER_UPLOAD');

-- ============================================================
-- 2. Missing TABLES
-- ============================================================

-- image_assets (must come before tables that reference it)
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceProvider" "ImageSourceProvider" NOT NULL,
    "contentHash" TEXT,
    "status" "ImageAssetStatus" NOT NULL DEFAULT 'PENDING',
    "r2Key" TEXT,
    "r2Bucket" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "blurhash" TEXT,
    "variants" JSONB,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "image_assets_contentHash_key" ON "image_assets"("contentHash");
CREATE INDEX "image_assets_sourceUrl_idx" ON "image_assets"("sourceUrl");
CREATE INDEX "image_assets_status_idx" ON "image_assets"("status");
CREATE INDEX "image_assets_contentHash_idx" ON "image_assets"("contentHash");

-- user_follows
CREATE TABLE "user_follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_follows_followerId_followingId_key" ON "user_follows"("followerId", "followingId");
CREATE INDEX "user_follows_followerId_idx" ON "user_follows"("followerId");
CREATE INDEX "user_follows_followingId_idx" ON "user_follows"("followingId");
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- trip_bookings
CREATE TABLE "trip_bookings" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "activityId" TEXT,
    "bookingType" "BookingType" NOT NULL,
    "provider" TEXT,
    "providerBookingId" TEXT,
    "confirmationCode" TEXT,
    "bookingUrl" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "checkInDate" TIMESTAMP(3),
    "checkOutDate" TIMESTAMP(3),
    "checkInTime" TIME(6),
    "checkOutTime" TIME(6),
    "totalCost" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "guestsCount" INTEGER NOT NULL DEFAULT 1,
    "guestNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "details" JSONB,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "trip_bookings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trip_bookings_tripId_idx" ON "trip_bookings"("tripId");
CREATE INDEX "trip_bookings_activityId_idx" ON "trip_bookings"("activityId");
CREATE INDEX "trip_bookings_bookingType_idx" ON "trip_bookings"("bookingType");
CREATE INDEX "trip_bookings_status_idx" ON "trip_bookings"("status");
CREATE INDEX "trip_bookings_checkInDate_idx" ON "trip_bookings"("checkInDate");
ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trip_bookings" ADD CONSTRAINT "trip_bookings_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- accommodation_activities
CREATE TABLE "accommodation_activities" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "accommodationType" "AccommodationType",
    "roomType" TEXT,
    "bedType" TEXT,
    "checkInTime" TIME(6),
    "checkOutTime" TIME(6),
    "earlyCheckInAvailable" BOOLEAN NOT NULL DEFAULT false,
    "lateCheckOutAvailable" BOOLEAN NOT NULL DEFAULT false,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPolicy" TEXT,
    "petPolicy" TEXT,
    "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "nearbyPlaces" JSONB,
    "specialRequests" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accommodation_activities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accommodation_activities_activityId_key" ON "accommodation_activities"("activityId");
CREATE INDEX "accommodation_activities_activityId_idx" ON "accommodation_activities"("activityId");
ALTER TABLE "accommodation_activities" ADD CONSTRAINT "accommodation_activities_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Missing COLUMNS on existing tables
-- ============================================================

-- activities
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "imageAssetId" TEXT;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "transportFromPrevious" JSONB;
CREATE INDEX IF NOT EXISTS "activities_imageAssetId_idx" ON "activities"("imageAssetId");
ALTER TABLE "activities" ADD CONSTRAINT "activities_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "image_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ai_messages
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "clientMessageId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ai_messages_clientMessageId_key" ON "ai_messages"("clientMessageId");
CREATE INDEX IF NOT EXISTS "ai_messages_clientMessageId_idx" ON "ai_messages"("clientMessageId");

-- cached_places
ALTER TABLE "cached_places" ADD COLUMN IF NOT EXISTS "enrichedData" JSONB;

-- travel_profiles
ALTER TABLE "travel_profiles" ADD COLUMN IF NOT EXISTS "personaAnswers" JSONB;

-- itinerary_days
ALTER TABLE "itinerary_days" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- trips
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "coverImageAssetId" TEXT;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "overview" JSONB;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
CREATE INDEX IF NOT EXISTS "trips_coverImageAssetId_idx" ON "trips"("coverImageAssetId");
ALTER TABLE "trips" ADD CONSTRAINT "trips_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "image_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
