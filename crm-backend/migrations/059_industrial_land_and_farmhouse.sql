-- Industrial and land specification refinements. Existing values are preserved.
SET @property_enum = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type');
SET @property_enum_ddl = IF(LOCATE("'farm_house'", @property_enum) > 0, 'SELECT 1', CONCAT('ALTER TABLE `majestan`.`properties` MODIFY `property_type` ', LEFT(@property_enum, CHAR_LENGTH(@property_enum) - 1), ",'farm_house') NOT NULL DEFAULT 'other'"));
PREPARE property_enum_stmt FROM @property_enum_ddl;
EXECUTE property_enum_stmt;
DEALLOCATE PREPARE property_enum_stmt;
ALTER TABLE `majestan`.`properties` MODIFY `price_per_sqft` DECIMAL(24,10) NULL;
ALTER TABLE `majestan`.`property_details` MODIFY `property_use` TEXT NULL, MODIFY `building_approval_cert` TEXT NULL;

SET @spec_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'container_access');
SET @spec_ddl = IF(@spec_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `container_access` VARCHAR(30) NULL', 'SELECT 1');
PREPARE spec_stmt FROM @spec_ddl;
EXECUTE spec_stmt;
DEALLOCATE PREPARE spec_stmt;

SET @spec_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'labor_rooms');
SET @spec_ddl = IF(@spec_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `labor_rooms` INT NULL', 'SELECT 1');
PREPARE spec_stmt FROM @spec_ddl;
EXECUTE spec_stmt;
DEALLOCATE PREPARE spec_stmt;

SET @spec_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'toilets');
SET @spec_ddl = IF(@spec_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `toilets` INT NULL', 'SELECT 1');
PREPARE spec_stmt FROM @spec_ddl;
EXECUTE spec_stmt;
DEALLOCATE PREPARE spec_stmt;

SET @spec_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'borewell_count');
SET @spec_ddl = IF(@spec_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `borewell_count` INT NULL', 'SELECT 1');
PREPARE spec_stmt FROM @spec_ddl;
EXECUTE spec_stmt;
DEALLOCATE PREPARE spec_stmt;

SET @spec_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'plot_boundaries');
SET @spec_ddl = IF(@spec_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `plot_boundaries` JSON NULL', 'SELECT 1');
PREPARE spec_stmt FROM @spec_ddl;
EXECUTE spec_stmt;
DEALLOCATE PREPARE spec_stmt;

INSERT IGNORE INTO `property_types` (`name`, `value`, `is_active`) VALUES ('Farm House', 'farm_house', 1);
