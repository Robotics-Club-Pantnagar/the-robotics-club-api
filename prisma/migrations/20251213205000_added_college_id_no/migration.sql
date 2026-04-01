/*
  Warnings:

  - Added the required column `collegeIdNo` to the `members` table without a default value. This is not possible if the table is not empty.
  - Added the required column `collegeIdNo` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "members" ADD COLUMN     "collegeIdNo" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "collegeIdNo" INTEGER NOT NULL;
