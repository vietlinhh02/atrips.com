-- CreateTable
CREATE TABLE "recommendation_history" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "placeKey" VARCHAR(255) NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "placeName" VARCHAR(255) NOT NULL,
    "draftId" UUID,
    "recommendedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_history_userId_destination_idx" ON "recommendation_history"("userId", "destination");

-- AddForeignKey
ALTER TABLE "recommendation_history" ADD CONSTRAINT "recommendation_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
