-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'REJECTED');

-- CreateTable
CREATE TABLE "team_join_requests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_join_requests_eventId_participantId_idx" ON "team_join_requests"("eventId", "participantId");

-- CreateIndex
CREATE INDEX "team_join_requests_teamId_status_idx" ON "team_join_requests"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_join_requests_eventId_teamId_participantId_key" ON "team_join_requests"("eventId", "teamId", "participantId");

-- AddForeignKey
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
