-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis" WITH VERSION "3.4.3";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TripVisibility" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TripMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('HOTEL', 'RESTAURANT', 'ATTRACTION', 'TRANSPORT', 'FLIGHT', 'ACTIVITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('HOTEL', 'RESTAURANT', 'ATTRACTION', 'ACTIVITY', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "PriceLevel" AS ENUM ('FREE', 'BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY');

-- CreateEnum
CREATE TYPE "GuideHireStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "GuideVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TRIP_UPDATE', 'TRIP_INVITE', 'HIRE_STATUS', 'GUIDE_MESSAGE', 'PAYMENT', 'SYSTEM', 'PROMOTION');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL');

-- CreateEnum
CREATE TYPE "AffiliateProvider" AS ENUM ('BOOKING', 'AGODA', 'KLOOK', 'AIRBNB', 'SKYSCANNER', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('ACCOMMODATION', 'FOOD', 'TRANSPORT', 'ACTIVITY', 'SHOPPING', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "TenantUserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PointAction" AS ENUM ('TRIP_CREATED', 'TRIP_COMPLETED', 'REVIEW_POSTED', 'PHOTO_UPLOADED', 'REFERRAL', 'DAILY_LOGIN', 'BADGE_EARNED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "travelStyle" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetRange" TEXT,
    "dietaryRestrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessibilityNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_auth_providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "aiQuotaUsed" INTEGER NOT NULL DEFAULT 0,
    "aiQuotaLimit" INTEGER NOT NULL DEFAULT 10,
    "tripsCreated" INTEGER NOT NULL DEFAULT 0,
    "tripsLimit" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
    "eventType" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "travelersCount" INTEGER NOT NULL DEFAULT 1,
    "budgetTotal" DECIMAL(12,2),
    "budgetCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "TripVisibility" NOT NULL DEFAULT 'PRIVATE',
    "shareToken" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cities" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "placeId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_days" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cityName" TEXT,
    "dayNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "weatherData" JSONB,

    CONSTRAINT "itinerary_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "itineraryDayId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT,
    "startTime" TIME,
    "endTime" TIME,
    "duration" INTEGER,
    "placeId" TEXT,
    "customAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "estimatedCost" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bookingUrl" TEXT,
    "bookingConfirmation" TEXT,
    "notes" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_votes" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_members" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TripMemberRole" NOT NULL DEFAULT 'VIEWER',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "trip_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_shares" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "sharedWithEmail" TEXT,
    "permission" "TripMemberRole" NOT NULL DEFAULT 'VIEWER',
    "shareToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "accessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_status_history" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "trip_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_exports" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "trip_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cached_places" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlaceType" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "priceLevel" "PriceLevel",
    "phone" TEXT,
    "website" TEXT,
    "openingHours" JSONB,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place_reviews" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "place_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "placeId" TEXT,
    "provider" "AffiliateProvider" NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "userId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "referrer" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "conversionValue" DECIMAL(10,2),
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "countryCode" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER,
    "verificationStatus" "GuideVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(10,2),
    "dailyRate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_portfolio_items" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_follows" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_reviews" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hireRequestId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_hire_requests" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "tripId" TEXT,
    "status" "GuideHireStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "guestsCount" INTEGER NOT NULL DEFAULT 1,
    "proposedRate" DECIMAL(10,2),
    "agreedRate" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "responseMessage" TEXT,
    "respondedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_hire_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_content" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "coverImage" TEXT,
    "places" JSONB,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_analytics" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalHires" INTEGER NOT NULL DEFAULT 0,
    "completedHires" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyViews" INTEGER NOT NULL DEFAULT 0,
    "monthlyHires" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_earnings" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_places" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "notes" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_chat_rooms" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT,
    "tripId" TEXT,
    "storyId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "caption" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_likes" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_comments" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_tags" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "story_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "title" TEXT,
    "totalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_itinerary_drafts" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sourcePrompt" TEXT NOT NULL,
    "generatedData" JSONB NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "appliedToTripId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_itinerary_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_optimization_requests" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "result" JSONB,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_optimization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_inputs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "transcript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "pushSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "eventType" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_searches" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departDate" DATE NOT NULL,
    "returnDate" DATE,
    "passengers" INTEGER NOT NULL DEFAULT 1,
    "cabinClass" TEXT NOT NULL DEFAULT 'economy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_trackings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departDate" DATE NOT NULL,
    "returnDate" DATE,
    "priceThreshold" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastPrice" DECIMAL(10,2),
    "lastCheckedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_activities" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departAirport" TEXT NOT NULL,
    "departTime" TIMESTAMP(3) NOT NULL,
    "arriveAirport" TEXT NOT NULL,
    "arriveTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "bookingRef" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "flight_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_forecasts" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "tempMin" DOUBLE PRECISION NOT NULL,
    "tempMax" DOUBLE PRECISION NOT NULL,
    "humidity" INTEGER,
    "precipitation" DOUBLE PRECISION,
    "condition" TEXT NOT NULL,
    "icon" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_events" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "provider" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "venue" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "category" TEXT,
    "ticketUrl" TEXT,
    "priceRange" TEXT,
    "imageUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "local_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "localName" TEXT,
    "countryCode" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "baseAmount" DECIMAL(10,2),
    "baseCurrency" TEXT,
    "exchangeRate" DOUBLE PRECISION,
    "receiptUrl" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_splits" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shareAmount" DECIMAL(10,2) NOT NULL,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_packages" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataVersion" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_map_regions" (
    "id" TEXT NOT NULL,
    "north" DOUBLE PRECISION NOT NULL,
    "south" DOUBLE PRECISION NOT NULL,
    "east" DOUBLE PRECISION NOT NULL,
    "west" DOUBLE PRECISION NOT NULL,
    "minZoom" INTEGER NOT NULL,
    "maxZoom" INTEGER NOT NULL,
    "tilesCount" INTEGER NOT NULL,
    "sizeBytes" INTEGER,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "offline_map_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "points" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PointAction" NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventName" TEXT NOT NULL,
    "properties" JSONB,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB NOT NULL,
    "trafficPercent" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "customDomain" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantUserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_queue" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "reason" TEXT,
    "reportedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_deletedAt_idx" ON "users"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_auth_providers_userId_idx" ON "user_auth_providers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_providers_provider_providerUserId_key" ON "user_auth_providers"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_email_idx" ON "email_verification_tokens"("email");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expiresAt_idx" ON "email_verification_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeCustomerId_key" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_tier_status_idx" ON "subscriptions"("tier", "status");

-- CreateIndex
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_stripeEventId_key" ON "payment_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "payment_events_subscriptionId_idx" ON "payment_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "payment_events_eventType_idx" ON "payment_events"("eventType");

-- CreateIndex
CREATE INDEX "payment_events_createdAt_idx" ON "payment_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trips_shareToken_key" ON "trips"("shareToken");

-- CreateIndex
CREATE INDEX "trips_ownerId_idx" ON "trips"("ownerId");

-- CreateIndex
CREATE INDEX "trips_tenantId_idx" ON "trips"("tenantId");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trips_visibility_idx" ON "trips"("visibility");

-- CreateIndex
CREATE INDEX "trips_startDate_endDate_idx" ON "trips"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "trips_createdAt_idx" ON "trips"("createdAt");

-- CreateIndex
CREATE INDEX "trips_deletedAt_idx" ON "trips"("deletedAt");

-- CreateIndex
CREATE INDEX "trip_cities_tripId_idx" ON "trip_cities"("tripId");

-- CreateIndex
CREATE INDEX "trip_cities_cityName_idx" ON "trip_cities"("cityName");

-- CreateIndex
CREATE UNIQUE INDEX "trip_cities_tripId_orderIndex_key" ON "trip_cities"("tripId", "orderIndex");

-- CreateIndex
CREATE INDEX "itinerary_days_tripId_idx" ON "itinerary_days"("tripId");

-- CreateIndex
CREATE INDEX "itinerary_days_date_idx" ON "itinerary_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_days_tripId_date_key" ON "itinerary_days"("tripId", "date");

-- CreateIndex
CREATE INDEX "activities_itineraryDayId_idx" ON "activities"("itineraryDayId");

-- CreateIndex
CREATE INDEX "activities_placeId_idx" ON "activities"("placeId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_orderIndex_idx" ON "activities"("orderIndex");

-- CreateIndex
CREATE INDEX "activities_deletedAt_idx" ON "activities"("deletedAt");

-- CreateIndex
CREATE INDEX "activity_votes_activityId_idx" ON "activity_votes"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_votes_activityId_userId_key" ON "activity_votes"("activityId", "userId");

-- CreateIndex
CREATE INDEX "trip_members_tripId_idx" ON "trip_members"("tripId");

-- CreateIndex
CREATE INDEX "trip_members_userId_idx" ON "trip_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_members_tripId_userId_key" ON "trip_members"("tripId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_shares_shareToken_key" ON "trip_shares"("shareToken");

-- CreateIndex
CREATE INDEX "trip_shares_tripId_idx" ON "trip_shares"("tripId");

-- CreateIndex
CREATE INDEX "trip_shares_shareToken_idx" ON "trip_shares"("shareToken");

-- CreateIndex
CREATE INDEX "trip_shares_sharedWithEmail_idx" ON "trip_shares"("sharedWithEmail");

-- CreateIndex
CREATE INDEX "trip_status_history_tripId_idx" ON "trip_status_history"("tripId");

-- CreateIndex
CREATE INDEX "trip_status_history_changedAt_idx" ON "trip_status_history"("changedAt");

-- CreateIndex
CREATE INDEX "trip_exports_tripId_idx" ON "trip_exports"("tripId");

-- CreateIndex
CREATE INDEX "trip_exports_createdAt_idx" ON "trip_exports"("createdAt");

-- CreateIndex
CREATE INDEX "cached_places_type_idx" ON "cached_places"("type");

-- CreateIndex
CREATE INDEX "cached_places_city_idx" ON "cached_places"("city");

-- CreateIndex
CREATE INDEX "cached_places_latitude_longitude_idx" ON "cached_places"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "cached_places_rating_idx" ON "cached_places"("rating");

-- CreateIndex
CREATE INDEX "cached_places_lastFetchedAt_idx" ON "cached_places"("lastFetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cached_places_provider_externalId_key" ON "cached_places"("provider", "externalId");

-- CreateIndex
CREATE INDEX "place_reviews_placeId_idx" ON "place_reviews"("placeId");

-- CreateIndex
CREATE INDEX "place_reviews_userId_idx" ON "place_reviews"("userId");

-- CreateIndex
CREATE INDEX "place_reviews_rating_idx" ON "place_reviews"("rating");

-- CreateIndex
CREATE INDEX "place_reviews_status_idx" ON "place_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "place_reviews_placeId_userId_key" ON "place_reviews"("placeId", "userId");

-- CreateIndex
CREATE INDEX "affiliate_links_placeId_idx" ON "affiliate_links"("placeId");

-- CreateIndex
CREATE INDEX "affiliate_links_provider_idx" ON "affiliate_links"("provider");

-- CreateIndex
CREATE INDEX "affiliate_clicks_affiliateLinkId_idx" ON "affiliate_clicks"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_userId_idx" ON "affiliate_clicks"("userId");

-- CreateIndex
CREATE INDEX "affiliate_clicks_clickedAt_idx" ON "affiliate_clicks"("clickedAt");

-- CreateIndex
CREATE INDEX "affiliate_clicks_converted_idx" ON "affiliate_clicks"("converted");

-- CreateIndex
CREATE UNIQUE INDEX "guides_userId_key" ON "guides"("userId");

-- CreateIndex
CREATE INDEX "guides_city_idx" ON "guides"("city");

-- CreateIndex
CREATE INDEX "guides_verificationStatus_idx" ON "guides"("verificationStatus");

-- CreateIndex
CREATE INDEX "guides_ratingAvg_idx" ON "guides"("ratingAvg");

-- CreateIndex
CREATE INDEX "guides_isAvailable_isActive_idx" ON "guides"("isAvailable", "isActive");

-- CreateIndex
CREATE INDEX "guide_portfolio_items_guideId_idx" ON "guide_portfolio_items"("guideId");

-- CreateIndex
CREATE INDEX "guide_follows_guideId_idx" ON "guide_follows"("guideId");

-- CreateIndex
CREATE INDEX "guide_follows_userId_idx" ON "guide_follows"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "guide_follows_guideId_userId_key" ON "guide_follows"("guideId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "guide_reviews_hireRequestId_key" ON "guide_reviews"("hireRequestId");

-- CreateIndex
CREATE INDEX "guide_reviews_guideId_idx" ON "guide_reviews"("guideId");

-- CreateIndex
CREATE INDEX "guide_reviews_rating_idx" ON "guide_reviews"("rating");

-- CreateIndex
CREATE INDEX "guide_reviews_status_idx" ON "guide_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "guide_reviews_guideId_userId_key" ON "guide_reviews"("guideId", "userId");

-- CreateIndex
CREATE INDEX "guide_hire_requests_guideId_idx" ON "guide_hire_requests"("guideId");

-- CreateIndex
CREATE INDEX "guide_hire_requests_requesterId_idx" ON "guide_hire_requests"("requesterId");

-- CreateIndex
CREATE INDEX "guide_hire_requests_tripId_idx" ON "guide_hire_requests"("tripId");

-- CreateIndex
CREATE INDEX "guide_hire_requests_status_idx" ON "guide_hire_requests"("status");

-- CreateIndex
CREATE INDEX "guide_hire_requests_startDate_endDate_idx" ON "guide_hire_requests"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "guide_content_guideId_idx" ON "guide_content"("guideId");

-- CreateIndex
CREATE INDEX "guide_content_type_idx" ON "guide_content"("type");

-- CreateIndex
CREATE INDEX "guide_content_status_idx" ON "guide_content"("status");

-- CreateIndex
CREATE INDEX "guide_content_publishedAt_idx" ON "guide_content"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "guide_analytics_guideId_key" ON "guide_analytics"("guideId");

-- CreateIndex
CREATE INDEX "guide_earnings_guideId_idx" ON "guide_earnings"("guideId");

-- CreateIndex
CREATE INDEX "guide_earnings_status_idx" ON "guide_earnings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "guide_earnings_guideId_period_key" ON "guide_earnings"("guideId", "period");

-- CreateIndex
CREATE INDEX "collections_userId_idx" ON "collections"("userId");

-- CreateIndex
CREATE INDEX "collections_isPublic_idx" ON "collections"("isPublic");

-- CreateIndex
CREATE INDEX "saved_places_userId_idx" ON "saved_places"("userId");

-- CreateIndex
CREATE INDEX "saved_places_placeId_idx" ON "saved_places"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_places_collectionId_placeId_key" ON "saved_places"("collectionId", "placeId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_chat_rooms_tripId_key" ON "trip_chat_rooms"("tripId");

-- CreateIndex
CREATE INDEX "chat_messages_chatRoomId_idx" ON "chat_messages"("chatRoomId");

-- CreateIndex
CREATE INDEX "chat_messages_userId_idx" ON "chat_messages"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "photos_userId_idx" ON "photos"("userId");

-- CreateIndex
CREATE INDEX "photos_placeId_idx" ON "photos"("placeId");

-- CreateIndex
CREATE INDEX "photos_tripId_idx" ON "photos"("tripId");

-- CreateIndex
CREATE INDEX "photos_status_idx" ON "photos"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stories_slug_key" ON "stories"("slug");

-- CreateIndex
CREATE INDEX "stories_userId_idx" ON "stories"("userId");

-- CreateIndex
CREATE INDEX "stories_slug_idx" ON "stories"("slug");

-- CreateIndex
CREATE INDEX "stories_status_idx" ON "stories"("status");

-- CreateIndex
CREATE INDEX "stories_publishedAt_idx" ON "stories"("publishedAt");

-- CreateIndex
CREATE INDEX "story_likes_storyId_idx" ON "story_likes"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "story_likes_storyId_userId_key" ON "story_likes"("storyId", "userId");

-- CreateIndex
CREATE INDEX "story_comments_storyId_idx" ON "story_comments"("storyId");

-- CreateIndex
CREATE INDEX "story_comments_userId_idx" ON "story_comments"("userId");

-- CreateIndex
CREATE INDEX "story_comments_parentId_idx" ON "story_comments"("parentId");

-- CreateIndex
CREATE INDEX "story_comments_status_idx" ON "story_comments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "story_tags_tagId_idx" ON "story_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "story_tags_storyId_tagId_key" ON "story_tags"("storyId", "tagId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_tripId_idx" ON "ai_conversations"("tripId");

-- CreateIndex
CREATE INDEX "ai_conversations_createdAt_idx" ON "ai_conversations"("createdAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_messages_createdAt_idx" ON "ai_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ai_itinerary_drafts_conversationId_idx" ON "ai_itinerary_drafts"("conversationId");

-- CreateIndex
CREATE INDEX "ai_optimization_requests_tripId_idx" ON "ai_optimization_requests"("tripId");

-- CreateIndex
CREATE INDEX "ai_optimization_requests_status_idx" ON "ai_optimization_requests"("status");

-- CreateIndex
CREATE INDEX "voice_inputs_userId_idx" ON "voice_inputs"("userId");

-- CreateIndex
CREATE INDEX "voice_inputs_status_idx" ON "voice_inputs"("status");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_channel_eventType_key" ON "notification_preferences"("userId", "channel", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "flight_searches_userId_idx" ON "flight_searches"("userId");

-- CreateIndex
CREATE INDEX "flight_searches_origin_destination_idx" ON "flight_searches"("origin", "destination");

-- CreateIndex
CREATE INDEX "flight_searches_departDate_idx" ON "flight_searches"("departDate");

-- CreateIndex
CREATE INDEX "flight_trackings_userId_idx" ON "flight_trackings"("userId");

-- CreateIndex
CREATE INDEX "flight_trackings_origin_destination_idx" ON "flight_trackings"("origin", "destination");

-- CreateIndex
CREATE INDEX "flight_trackings_isActive_idx" ON "flight_trackings"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "flight_activities_activityId_key" ON "flight_activities"("activityId");

-- CreateIndex
CREATE INDEX "weather_forecasts_city_date_idx" ON "weather_forecasts"("city", "date");

-- CreateIndex
CREATE INDEX "weather_forecasts_expiresAt_idx" ON "weather_forecasts"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "weather_forecasts_latitude_longitude_date_key" ON "weather_forecasts"("latitude", "longitude", "date");

-- CreateIndex
CREATE INDEX "local_events_city_startTime_idx" ON "local_events"("city", "startTime");

-- CreateIndex
CREATE INDEX "local_events_category_idx" ON "local_events"("category");

-- CreateIndex
CREATE INDEX "local_events_startTime_idx" ON "local_events"("startTime");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "holidays_countryCode_idx" ON "holidays"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_countryCode_name_key" ON "holidays"("date", "countryCode", "name");

-- CreateIndex
CREATE INDEX "expenses_tripId_idx" ON "expenses"("tripId");

-- CreateIndex
CREATE INDEX "expenses_createdById_idx" ON "expenses"("createdById");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expense_splits_userId_idx" ON "expense_splits"("userId");

-- CreateIndex
CREATE INDEX "expense_splits_isSettled_idx" ON "expense_splits"("isSettled");

-- CreateIndex
CREATE UNIQUE INDEX "expense_splits_expenseId_userId_key" ON "expense_splits"("expenseId", "userId");

-- CreateIndex
CREATE INDEX "currency_rates_expiresAt_idx" ON "currency_rates"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "currency_rates_baseCurrency_targetCurrency_key" ON "currency_rates"("baseCurrency", "targetCurrency");

-- CreateIndex
CREATE INDEX "offline_packages_userId_idx" ON "offline_packages"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "offline_packages_tripId_userId_key" ON "offline_packages"("tripId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "badges_slug_key" ON "badges"("slug");

-- CreateIndex
CREATE INDEX "user_badges_userId_idx" ON "user_badges"("userId");

-- CreateIndex
CREATE INDEX "user_badges_earnedAt_idx" ON "user_badges"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "points_ledger_userId_idx" ON "points_ledger"("userId");

-- CreateIndex
CREATE INDEX "points_ledger_action_idx" ON "points_ledger"("action");

-- CreateIndex
CREATE INDEX "points_ledger_createdAt_idx" ON "points_ledger"("createdAt");

-- CreateIndex
CREATE INDEX "leaderboard_entries_scope_period_rank_idx" ON "leaderboard_entries"("scope", "period", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_scope_period_userId_key" ON "leaderboard_entries"("scope", "period", "userId");

-- CreateIndex
CREATE INDEX "analytics_events_userId_idx" ON "analytics_events"("userId");

-- CreateIndex
CREATE INDEX "analytics_events_eventName_idx" ON "analytics_events"("eventName");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_idx" ON "analytics_events"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "experiments_name_key" ON "experiments"("name");

-- CreateIndex
CREATE INDEX "experiments_status_idx" ON "experiments"("status");

-- CreateIndex
CREATE INDEX "experiment_assignments_experimentId_idx" ON "experiment_assignments"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experimentId_userId_key" ON "experiment_assignments"("experimentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "funnels_name_key" ON "funnels"("name");

-- CreateIndex
CREATE INDEX "activity_logs_tripId_idx" ON "activity_logs"("tripId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_customDomain_idx" ON "tenants"("customDomain");

-- CreateIndex
CREATE INDEX "tenants_isActive_idx" ON "tenants"("isActive");

-- CreateIndex
CREATE INDEX "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "background_jobs_type_status_idx" ON "background_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "background_jobs_scheduledAt_idx" ON "background_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "background_jobs_status_idx" ON "background_jobs"("status");

-- CreateIndex
CREATE INDEX "moderation_queue_contentType_contentId_idx" ON "moderation_queue"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "moderation_queue_status_idx" ON "moderation_queue"("status");

-- CreateIndex
CREATE INDEX "moderation_queue_createdAt_idx" ON "moderation_queue"("createdAt");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cities" ADD CONSTRAINT "trip_cities_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_days" ADD CONSTRAINT "itinerary_days_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_itineraryDayId_fkey" FOREIGN KEY ("itineraryDayId") REFERENCES "itinerary_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "cached_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_votes" ADD CONSTRAINT "activity_votes_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_votes" ADD CONSTRAINT "activity_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_status_history" ADD CONSTRAINT "trip_status_history_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_exports" ADD CONSTRAINT "trip_exports_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_reviews" ADD CONSTRAINT "place_reviews_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "cached_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_reviews" ADD CONSTRAINT "place_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "cached_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_portfolio_items" ADD CONSTRAINT "guide_portfolio_items_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_follows" ADD CONSTRAINT "guide_follows_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_follows" ADD CONSTRAINT "guide_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_reviews" ADD CONSTRAINT "guide_reviews_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_reviews" ADD CONSTRAINT "guide_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_reviews" ADD CONSTRAINT "guide_reviews_hireRequestId_fkey" FOREIGN KEY ("hireRequestId") REFERENCES "guide_hire_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_hire_requests" ADD CONSTRAINT "guide_hire_requests_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_hire_requests" ADD CONSTRAINT "guide_hire_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_hire_requests" ADD CONSTRAINT "guide_hire_requests_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_content" ADD CONSTRAINT "guide_content_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_analytics" ADD CONSTRAINT "guide_analytics_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_earnings" ADD CONSTRAINT "guide_earnings_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "cached_places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_chat_rooms" ADD CONSTRAINT "trip_chat_rooms_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "trip_chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "cached_places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_comments" ADD CONSTRAINT "story_comments_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_comments" ADD CONSTRAINT "story_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_comments" ADD CONSTRAINT "story_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "story_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_itinerary_drafts" ADD CONSTRAINT "ai_itinerary_drafts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_inputs" ADD CONSTRAINT "voice_inputs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_activities" ADD CONSTRAINT "flight_activities_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_packages" ADD CONSTRAINT "offline_packages_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_packages" ADD CONSTRAINT "offline_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
