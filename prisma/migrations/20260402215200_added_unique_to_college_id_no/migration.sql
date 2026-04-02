/*
  Warnings:

  - A unique constraint covering the columns `[collegeIdNo]` on the table `members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[collegeIdNo]` on the table `participants` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "members_collegeIdNo_key" ON "members"("collegeIdNo");

-- CreateIndex
CREATE UNIQUE INDEX "participants_collegeIdNo_key" ON "participants"("collegeIdNo");
