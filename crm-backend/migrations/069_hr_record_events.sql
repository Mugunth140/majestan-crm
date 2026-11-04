-- HR candidates get an Activity tab: backfill creation so every existing
-- candidate's history has a starting point (record_events comes from 068).
INSERT INTO record_events (entity, entity_id, actor_id, type, to_value, meta, created_at)
SELECT 'hr', c.id, NULL, 'created', c.status, JSON_OBJECT('backfilled', TRUE), c.createdAt
FROM hr_candidates c
WHERE NOT EXISTS (SELECT 1 FROM record_events e WHERE e.entity = 'hr' AND e.entity_id = c.id AND e.type = 'created');
