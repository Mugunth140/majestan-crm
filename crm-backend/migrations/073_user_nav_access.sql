-- Which sidebar modules each user sees. NULL keeps the defaults for their role
-- and department; a list replaces them. Admins always see everything.
ALTER TABLE users ADD COLUMN nav_access JSON NULL AFTER avatar_url;
