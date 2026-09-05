-- Tracks whether a login has ever redeemed its set-password link, so the admin screen can tell
-- "invited but has not created a password yet" apart from "active and using the account" instead
-- of guessing from a login-history field the platform has never recorded.
ALTER TABLE app_user ADD COLUMN password_set_at TIMESTAMPTZ;

-- Every login the demo seeder creates is already usable, so it counts as set from the start.
UPDATE app_user SET password_set_at = created_at WHERE password_set_at IS NULL;
