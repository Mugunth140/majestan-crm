-- Append-only history of what happened to a lead: creation, status changes,
-- field and requirement edits, visits and documents. Assignment history stays
-- in routing_histories. Feeds the lead Timeline and the DuckDB analytics.
CREATE TABLE IF NOT EXISTS lead_events (
  id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lead_id     INT          NOT NULL,
  actor_id    INT          NULL,
  type        VARCHAR(40)  NOT NULL,
  field       VARCHAR(60)  NULL,
  from_value  TEXT         NULL,
  to_value    TEXT         NULL,
  meta        JSON         NULL,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_lead_events_lead (lead_id, created_at),
  KEY idx_lead_events_type (type, created_at)
);

-- Backfill creation so every existing lead's timeline has a starting point.
-- Status history before this migration was never stored and can't be rebuilt.
INSERT INTO lead_events (lead_id, actor_id, type, to_value, meta, created_at)
SELECT l.id, NULL, 'created', l.status, JSON_OBJECT('source', l.lead_source, 'backfilled', TRUE), l.created_at
FROM leads l
WHERE NOT EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.type = 'created');
