-- A BEFORE DELETE trigger must return OLD. The original returned NEW, which is NULL on
-- delete, so PostgreSQL silently cancelled every row deletion from app_user instead of
-- only protecting break-glass accounts.
CREATE OR REPLACE FUNCTION protect_break_glass() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_break_glass THEN
            RAISE EXCEPTION 'break-glass user cannot be deleted';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_break_glass AND NEW.active = FALSE THEN
        RAISE EXCEPTION 'break-glass user cannot be deactivated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
