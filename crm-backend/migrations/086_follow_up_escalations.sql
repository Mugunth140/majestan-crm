-- Missed follow-ups: each follow-up remembers the due slot ('YYYY-MM-DD HH:MM')
-- its owner's team lead was told about, so a missed follow-up is escalated once,
-- and again only if it is moved to a new time and missed again.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_follow_ups' AND COLUMN_NAME = 'escalated_for');
SET @sql := IF(@has = 0, 'ALTER TABLE lead_follow_ups ADD COLUMN escalated_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inbound_follow_ups' AND COLUMN_NAME = 'escalated_for');
SET @sql := IF(@has = 0, 'ALTER TABLE inbound_follow_ups ADD COLUMN escalated_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_follow_ups' AND COLUMN_NAME = 'escalated_for');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_follow_ups ADD COLUMN escalated_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_follow_ups' AND COLUMN_NAME = 'escalated_for');
SET @sql := IF(@has = 0, 'ALTER TABLE hr_follow_ups ADD COLUMN escalated_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Follow-ups already due today count as escalated, so the first run doesn't send a burst.
UPDATE lead_follow_ups SET escalated_for = reminded_for WHERE reminded_for IS NOT NULL;
UPDATE inbound_follow_ups SET escalated_for = reminded_for WHERE reminded_for IS NOT NULL;
UPDATE agent_follow_ups SET escalated_for = reminded_for WHERE reminded_for IS NOT NULL;
UPDATE hr_follow_ups SET escalated_for = reminded_for WHERE reminded_for IS NOT NULL;
