-- Function to check uniqueness when a team is linked to an event
CREATE OR REPLACE FUNCTION check_team_name_unique_per_event()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM event_teams et
        JOIN teams t ON et."teamId" = t.id
        WHERE et."eventId" = NEW."eventId"
          AND LOWER(t.name) = (SELECT LOWER(name) FROM teams WHERE id = NEW."teamId")
          AND et.id != NEW.id
    ) THEN
        RAISE EXCEPTION 'A team with the same name already exists in this event.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for event_teams inserts and updates
CREATE TRIGGER trg_check_team_name_unique_per_event_et
BEFORE INSERT OR UPDATE ON event_teams
FOR EACH ROW EXECUTE FUNCTION check_team_name_unique_per_event();

-- Function to check uniqueness when a team's name is updated
CREATE OR REPLACE FUNCTION check_team_name_unique_on_team_update()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM event_teams et1
        JOIN event_teams et2 ON et1."eventId" = et2."eventId"
        JOIN teams t ON et2."teamId" = t.id
        WHERE et1."teamId" = NEW.id
          AND LOWER(t.name) = LOWER(NEW.name)
          AND et2."teamId" != NEW.id
    ) THEN
        RAISE EXCEPTION 'This name update conflicts with another team''s name in one of the registered events.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for teams updates
CREATE TRIGGER trg_check_team_name_unique_per_event_on_team_update
BEFORE UPDATE ON teams
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION check_team_name_unique_on_team_update();