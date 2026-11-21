-- Where an inbound came from (99acres, Magic Bricks, a walk-in...), picked from
-- the lead sources list in Master Registry. Stored as the source's name.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inbounds' AND COLUMN_NAME = 'source');
SET @sql := IF(@has = 0, 'ALTER TABLE inbounds ADD COLUMN source VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
