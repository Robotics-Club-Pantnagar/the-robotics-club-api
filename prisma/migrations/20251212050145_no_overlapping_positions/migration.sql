/*
  Warnings:

  - You are about to drop the column `year` on the `member_positions` table. All the data in the column will be lost.
  - Added the required column `startMonth` to the `member_positions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startYear` to the `member_positions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "member_positions_memberId_year_key";

-- DropIndex
DROP INDEX "member_positions_year_idx";

-- AlterTable
ALTER TABLE "member_positions" DROP COLUMN "year",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endMonth" INTEGER,
ADD COLUMN     "endYear" INTEGER,
ADD COLUMN     "startMonth" INTEGER NOT NULL,
ADD COLUMN     "startYear" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "member_positions_memberId_idx" ON "member_positions"("memberId");

-- CreateIndex
CREATE INDEX "member_positions_startYear_idx" ON "member_positions"("startYear");

-- Create function to check for overlapping position intervals
CREATE OR REPLACE FUNCTION check_overlapping_positions()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INT;
BEGIN
  -- Check if this position overlaps with any existing position for the same member
  -- Two intervals overlap if:
  -- NOT (interval1.end < interval2.start OR interval2.end < interval1.start)
  -- 
  -- For our case (with nullable end dates meaning "ongoing"):
  -- Position1: startYear1-startMonth1 to endYear1-endMonth1 (or null = ongoing)
  -- Position2: startYear2-startMonth2 to endYear2-endMonth2 (or null = ongoing)
  
  SELECT COUNT(*)
  INTO overlapping_count
  FROM "member_positions"
  WHERE "memberId" = NEW."memberId"
    AND id != NEW.id  -- Exclude the current record (important for updates)
    AND NOT (
      -- Condition 1: New position ends before existing position starts
      (
        NEW."endYear" IS NOT NULL 
        AND NEW."endMonth" IS NOT NULL
        AND (
          NEW."endYear" < "startYear"
          OR (NEW."endYear" = "startYear" AND NEW."endMonth" < "startMonth")
        )
      )
      OR
      -- Condition 2: New position starts after existing position ends
      (
        "endYear" IS NOT NULL
        AND "endMonth" IS NOT NULL
        AND (
          "endYear" < NEW."startYear"
          OR ("endYear" = NEW."startYear" AND "endMonth" < NEW."startMonth")
        )
      )
    );

  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'A member cannot have overlapping position intervals. Member already has a position during this time period.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_check_overlapping_positions ON "member_positions";

-- Create trigger to run the check before insert or update
CREATE TRIGGER trigger_check_overlapping_positions
BEFORE INSERT OR UPDATE ON "member_positions"
FOR EACH ROW
EXECUTE FUNCTION check_overlapping_positions();
