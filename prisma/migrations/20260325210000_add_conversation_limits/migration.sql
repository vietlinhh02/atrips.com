-- AlterTable: add conversation tracking fields
ALTER TABLE "ai_conversations"
ADD COLUMN "messageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "summary" TEXT,
ADD COLUMN "continuedFromId" TEXT;

-- CreateIndex
CREATE INDEX "ai_conversations_continuedFromId_idx" ON "ai_conversations"("continuedFromId");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_continuedFromId_fkey" FOREIGN KEY ("continuedFromId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add per-conversation limits to subscriptions
ALTER TABLE "subscriptions"
ADD COLUMN "conversationMessageLimit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "conversationTokenLimit" INTEGER NOT NULL DEFAULT 200000;
