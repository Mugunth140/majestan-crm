-- Follow-up reminders: each follow-up remembers the due slot ('YYYY-MM-DD HH:MM')
-- it was last announced for, so the reminder fires once, and again only if the
-- follow-up is moved to a new time.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lead_follow_ups' AND COLUMN_NAME = 'reminded_for');
SET @sql := IF(@has = 0, 'ALTER TABLE lead_follow_ups ADD COLUMN reminded_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inbound_follow_ups' AND COLUMN_NAME = 'reminded_for');
SET @sql := IF(@has = 0, 'ALTER TABLE inbound_follow_ups ADD COLUMN reminded_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_follow_ups' AND COLUMN_NAME = 'reminded_for');
SET @sql := IF(@has = 0, 'ALTER TABLE agent_follow_ups ADD COLUMN reminded_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hr_follow_ups' AND COLUMN_NAME = 'reminded_for');
SET @sql := IF(@has = 0, 'ALTER TABLE hr_follow_ups ADD COLUMN reminded_for VARCHAR(16) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
