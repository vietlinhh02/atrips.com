/*
  Warnings:

  - Added the required column `otp` to the `email_verification_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "email_verification_tokens" ADD COLUMN     "otp" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "travel_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "travelCompanions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "locationPlaceId" TEXT,
    "spendingHabits" TEXT,
    "dailyRhythm" TEXT,
    "socialPreference" TEXT,
    "travelerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personaTitle" TEXT,
    "personaDescription" TEXT,
    "personaSuggestedQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_profiles_userId_key" ON "travel_profiles"("userId");

-- CreateIndex
CREATE INDEX "email_verification_tokens_email_otp_idx" ON "email_verification_tokens"("email", "otp");

-- AddForeignKey
ALTER TABLE "travel_profiles" ADD CONSTRAINT "travel_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
