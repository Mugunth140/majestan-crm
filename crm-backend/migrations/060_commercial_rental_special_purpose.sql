-- Commercial rental Special Purpose is distinct from Property Use.
SET @special_purpose_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'special_purpose');
SET @special_purpose_ddl = IF(@special_purpose_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `special_purpose` VARCHAR(255) NULL', 'SELECT 1');
PREPARE special_purpose_stmt FROM @special_purpose_ddl;
EXECUTE special_purpose_stmt;
DEALLOCATE PREPARE special_purpose_stmt;
