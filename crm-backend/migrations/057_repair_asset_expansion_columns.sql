-- Repair schema drift: migration 006 was recorded while the assets expansion columns were absent.
-- Add only missing columns; preserve all existing values and the original migration ledger.
SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'display_id') = 0,
  'ALTER TABLE assets ADD COLUMN display_id VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'source') = 0,
  'ALTER TABLE assets ADD COLUMN source VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'mediator_name') = 0,
  'ALTER TABLE assets ADD COLUMN mediator_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'cp_reference_name') = 0,
  'ALTER TABLE assets ADD COLUMN cp_reference_name VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'visited_date') = 0,
  'ALTER TABLE assets ADD COLUMN visited_date DATE NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'site_visited_done') = 0,
  'ALTER TABLE assets ADD COLUMN site_visited_done VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'reason_rsv') = 0,
  'ALTER TABLE assets ADD COLUMN reason_rsv VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'photos_taken') = 0,
  'ALTER TABLE assets ADD COLUMN photos_taken VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'outcome') = 0,
  'ALTER TABLE assets ADD COLUMN outcome VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'remarks') = 0,
  'ALTER TABLE assets ADD COLUMN remarks TEXT NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'checked_by') = 0,
  'ALTER TABLE assets ADD COLUMN checked_by VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;

SET @asset_column_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'approved_by') = 0,
  'ALTER TABLE assets ADD COLUMN approved_by VARCHAR(255) NULL', 'SELECT 1');
PREPARE asset_column_stmt FROM @asset_column_ddl;
EXECUTE asset_column_stmt;
DEALLOCATE PREPARE asset_column_stmt;
