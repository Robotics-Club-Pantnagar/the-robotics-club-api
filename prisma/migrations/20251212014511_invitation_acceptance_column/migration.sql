-- AlterTable
ALTER TABLE "members" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "invitationAccepted" BOOLEAN NOT NULL DEFAULT false;
