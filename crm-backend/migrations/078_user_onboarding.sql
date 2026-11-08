-- Onboarding state per user: welcome sheet, product tours, checklist.
-- NULL means nothing seen yet. Shape: { welcomed_at, tours: { [id]: { done_at | skipped_at, step } },
-- checklist_dismissed_at, last_seen_version }.
ALTER TABLE users ADD COLUMN onboarding JSON NULL AFTER nav_access;
