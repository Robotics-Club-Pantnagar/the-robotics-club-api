/*
  Warnings:

  - You are about to drop the column `githubUrl` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `linkedinUrl` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `githubUrl` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Member" DROP COLUMN "githubUrl",
DROP COLUMN "linkedinUrl",
ADD COLUMN     "github" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "linkedin" TEXT;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "githubUrl",
ADD COLUMN     "githubRepo" TEXT;
