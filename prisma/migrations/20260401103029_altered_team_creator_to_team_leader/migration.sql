/*
  Warnings:

  - Added the required column `leaderId` to the `teams` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "leaderId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "teams_leaderId_idx" ON "teams"("leaderId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
