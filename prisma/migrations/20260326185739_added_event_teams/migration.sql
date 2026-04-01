-- AlterTable
ALTER TABLE "event_participants" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "hasTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxTeamMembers" INTEGER;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_teams" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_name_idx" ON "teams"("name");

-- CreateIndex
CREATE INDEX "event_teams_eventId_idx" ON "event_teams"("eventId");

-- CreateIndex
CREATE INDEX "event_teams_teamId_idx" ON "event_teams"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "event_teams_eventId_teamId_key" ON "event_teams"("eventId", "teamId");

-- CreateIndex
CREATE INDEX "event_participants_teamId_idx" ON "event_participants"("teamId");

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce Event.hasTeam/maxTeamMembers consistency
ALTER TABLE "events"
ADD CONSTRAINT "events_hasTeam_maxTeamMembers_check"
CHECK (
    ("hasTeam" = false AND "maxTeamMembers" IS NULL)
    OR
    ("hasTeam" = true AND "maxTeamMembers" IS NOT NULL AND "maxTeamMembers" > 0)
);

-- Ensure event_teams rows are only created for team-enabled events.
CREATE OR REPLACE FUNCTION validate_event_team_has_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "events" e
        WHERE e."id" = NEW."eventId"
            AND e."hasTeam" = true
    ) THEN
        RAISE EXCEPTION 'Cannot add team to a non-team event (eventId=%)', NEW."eventId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_event_team_has_team
BEFORE INSERT OR UPDATE ON "event_teams"
FOR EACH ROW
EXECUTE FUNCTION validate_event_team_has_team();

-- Ensure participant team assignments are valid and capped.
CREATE OR REPLACE FUNCTION validate_event_participant_team_assignment()
RETURNS TRIGGER AS $$
DECLARE
    max_members INTEGER;
    current_count INTEGER;
BEGIN
    -- No team assignment: always allowed.
    IF NEW."teamId" IS NULL THEN
        RETURN NEW;
    END IF;

    -- The assigned team must be linked to the same event.
    IF NOT EXISTS (
        SELECT 1
        FROM "event_teams" et
        WHERE et."eventId" = NEW."eventId"
            AND et."teamId" = NEW."teamId"
    ) THEN
        RAISE EXCEPTION 'Team % is not linked to event %', NEW."teamId", NEW."eventId";
    END IF;

    -- Fetch and validate event team settings.
    SELECT e."maxTeamMembers"
    INTO max_members
    FROM "events" e
    WHERE e."id" = NEW."eventId"
        AND e."hasTeam" = true;

    IF max_members IS NULL THEN
        RAISE EXCEPTION 'Event % is not configured for teams', NEW."eventId";
    END IF;

    -- Enforce max team member count within the event/team.
    SELECT COUNT(*)
    INTO current_count
    FROM "event_participants" ep
    WHERE ep."eventId" = NEW."eventId"
        AND ep."teamId" = NEW."teamId"
        AND ep."id" <> COALESCE(NEW."id", '');

    IF current_count >= max_members THEN
        RAISE EXCEPTION 'Team % for event % is full (max=%)', NEW."teamId", NEW."eventId", max_members;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_event_participant_team_assignment
BEFORE INSERT OR UPDATE ON "event_participants"
FOR EACH ROW
EXECUTE FUNCTION validate_event_participant_team_assignment();
