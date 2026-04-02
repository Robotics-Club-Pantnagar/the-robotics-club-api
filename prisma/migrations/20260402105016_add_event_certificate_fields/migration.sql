-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "certificate" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "certificateTemplate" TEXT;
