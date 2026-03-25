-- CreateEnum
CREATE TYPE "FileUploadStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileUploadType" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "FileUploadCategory" AS ENUM ('INSPIRATION', 'REFERENCE_DOC', 'BOOKING');

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "tripId" TEXT,
    "fileName" VARCHAR(255) NOT NULL,
    "fileType" "FileUploadType" NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "r2Key" VARCHAR(500),
    "r2Bucket" VARCHAR(100),
    "publicUrl" VARCHAR(1000),
    "variants" JSONB,
    "extractedText" TEXT,
    "extractionMeta" JSONB,
    "status" "FileUploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "category" "FileUploadCategory" NOT NULL DEFAULT 'INSPIRATION',
    "persist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "file_uploads_conversationId_idx" ON "file_uploads"("conversationId");

-- CreateIndex
CREATE INDEX "file_uploads_userId_idx" ON "file_uploads"("userId");

-- CreateIndex
CREATE INDEX "file_uploads_tripId_idx" ON "file_uploads"("tripId");

-- CreateIndex
CREATE INDEX "file_uploads_status_persist_createdAt_idx" ON "file_uploads"("status", "persist", "createdAt");

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
