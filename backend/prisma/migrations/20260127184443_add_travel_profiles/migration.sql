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

-- AddForeignKey
ALTER TABLE "travel_profiles" ADD CONSTRAINT "travel_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
