/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[username]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Made the column `imageUrl` on table `Member` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `imageUrl` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "imageUrl" SET NOT NULL;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "imageUrl" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Member_username_key" ON "Member"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_username_key" ON "Participant"("username");
