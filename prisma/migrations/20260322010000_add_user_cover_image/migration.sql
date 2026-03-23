-- Add cover image fields to User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "coverImageOffsetY" INTEGER NOT NULL DEFAULT 50;
