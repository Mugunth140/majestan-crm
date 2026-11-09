-- The Activity Logs page reads one person's history across modules: look
-- events up by who made them.
SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_events' AND INDEX_NAME = 'idx_lead_events_actor');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_lead_events_actor ON lead_events (actor_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'record_events' AND INDEX_NAME = 'idx_record_events_actor');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_record_events_actor ON record_events (actor_id, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
