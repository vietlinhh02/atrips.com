-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('WALK', 'TAXI', 'BUS', 'TRAIN', 'SUBWAY', 'CAR', 'BIKE', 'BOAT', 'FLIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "DestinationRegion" AS ENUM ('SOUTHEAST_ASIA', 'EAST_ASIA', 'SOUTH_ASIA', 'EUROPE', 'AMERICAS', 'MIDDLE_EAST', 'AFRICA', 'OCEANIA');

-- AlterTable
ALTER TABLE "ai_conversations" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ai_itinerary_drafts" ALTER COLUMN "conversationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "destinations" (
    "id" TEXT NOT NULL,
    "cachedPlaceId" TEXT NOT NULL,
    "region" "DestinationRegion" NOT NULL,
    "tagline" TEXT,
    "bestSeasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avgDailyBudget" DECIMAL(10,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImageAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "destinations_region_idx" ON "destinations"("region");

-- CreateIndex
CREATE INDEX "destinations_isActive_idx" ON "destinations"("isActive");

-- CreateIndex
CREATE INDEX "destinations_popularityScore_idx" ON "destinations"("popularityScore");

-- CreateIndex
CREATE INDEX "destinations_cachedPlaceId_idx" ON "destinations"("cachedPlaceId");

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_cachedPlaceId_fkey" FOREIGN KEY ("cachedPlaceId") REFERENCES "cached_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
