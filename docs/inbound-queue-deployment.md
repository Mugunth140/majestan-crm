# Inbound Queue deployment

Before starting this backend version, copy `crm-backend/migrations/053_inbound_queue.sql` to the deployment's `infra/migrations/053_inbound_queue.sql` and run `docker compose run --rm --no-deps db-migrate` from `infra/`. The infra directory is outside this Git repository; this tracked copy keeps the required migration with the feature commit.

The migration adds uploader and queue fields. Existing records remain outside Queue, and their uploader stays unknown. Never infer the original uploader from the current assignee.

PWA quick captures enter Queue unassigned. Inbound staff and managers can assign them into All Inbound, reassign them, or return them to Queue. The authenticated creator is recorded permanently as uploader. Normal edits cannot alter uploader or queue state.
