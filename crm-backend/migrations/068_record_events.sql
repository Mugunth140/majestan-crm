-- Append-only history for records other than leads (leads keep lead_events):
-- inbounds first, then the other modules as they get an Activity tab.
-- `entity` names the module ('inbound', …); `entity_id` is that record's id.
CREATE TABLE IF NOT EXISTS record_events (
  id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity      VARCHAR(30)  NOT NULL,
  entity_id   INT          NOT NULL,
  actor_id    INT          NULL,
  type        VARCHAR(40)  NOT NULL,
  field       VARCHAR(60)  NULL,
  from_value  TEXT         NULL,
  to_value    TEXT         NULL,
  meta        JSON         NULL,
  created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_record_events_record (entity, entity_id, created_at),
  KEY idx_record_events_type (entity, type, created_at)
);

-- Backfill creation so every existing inbound's and agent's Activity has a starting point.
INSERT INTO record_events (entity, entity_id, actor_id, type, to_value, meta, created_at)
SELECT 'inbound', i.id, i.uploaded_by_id, 'created', i.status, JSON_OBJECT('backfilled', TRUE), i.created_at
FROM inbounds i
WHERE NOT EXISTS (SELECT 1 FROM record_events e WHERE e.entity = 'inbound' AND e.entity_id = i.id AND e.type = 'created');

INSERT INTO record_events (entity, entity_id, actor_id, type, to_value, meta, created_at)
SELECT 'agent', a.id, NULL, 'created', a.status, JSON_OBJECT('backfilled', TRUE), a.created_at
FROM agents a
WHERE NOT EXISTS (SELECT 1 FROM record_events e WHERE e.entity = 'agent' AND e.entity_id = a.id AND e.type = 'created');
