/*
  Warnings:

  - The primary key for the `recommendation_history` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "file_uploads" DROP CONSTRAINT "file_uploads_userId_fkey";

-- AlterTable
ALTER TABLE "recommendation_history" DROP CONSTRAINT "recommendation_history_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "draftId" SET DATA TYPE TEXT,
ADD CONSTRAINT "recommendation_history_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
