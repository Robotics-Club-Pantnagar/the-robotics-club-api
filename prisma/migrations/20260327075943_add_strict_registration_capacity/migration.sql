/*
  Warnings:

  - Added the required column `registrationDeadline` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "events" ADD COLUMN     "maxParticipants" INTEGER,
ADD COLUMN     "registrationDeadline" TIMESTAMP(3) NOT NULL;

-- maxParticipants, when provided, must be positive.
ALTER TABLE "events"
ADD CONSTRAINT "events_maxParticipants_positive_check"
CHECK ("maxParticipants" IS NULL OR "maxParticipants" > 0);

-- Block registrations after registrationDeadline and once event capacity is reached.
CREATE OR REPLACE FUNCTION validate_event_registration_window_and_capacity()
RETURNS TRIGGER AS $$
DECLARE
  reg_deadline TIMESTAMP(3);
  max_participants INTEGER;
  current_count INTEGER;
BEGIN
  SELECT e."registrationDeadline", e."maxParticipants"
  INTO reg_deadline, max_participants
  FROM "events" e
  WHERE e."id" = NEW."eventId";

  IF reg_deadline IS NULL THEN
    RAISE EXCEPTION 'Registration deadline is not configured for event %', NEW."eventId";
  END IF;

  IF now() > reg_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed for event %', NEW."eventId";
  END IF;

  IF max_participants IS NOT NULL THEN
    SELECT COUNT(*)
    INTO current_count
    FROM "event_participants" ep
    WHERE ep."eventId" = NEW."eventId"
      AND ep."id" <> COALESCE(NEW."id", '');

    IF current_count >= max_participants THEN
      RAISE EXCEPTION 'Event % is full (max=%)', NEW."eventId", max_participants;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_event_registration_window_and_capacity
BEFORE INSERT ON "event_participants"
FOR EACH ROW
EXECUTE FUNCTION validate_event_registration_window_and_capacity();
