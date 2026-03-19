-- Add compile/hydration lifecycle fields for AI drafts
ALTER TABLE "ai_itinerary_drafts"
  ADD COLUMN IF NOT EXISTS "compiledData" JSONB,
  ADD COLUMN IF NOT EXISTS "compileReport" JSONB,
  ADD COLUMN IF NOT EXISTS "compileStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "compiledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ai_itinerary_drafts_compileStatus_idx"
  ON "ai_itinerary_drafts"("compileStatus");
