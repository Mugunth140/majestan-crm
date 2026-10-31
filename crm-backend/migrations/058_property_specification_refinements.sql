-- Property specification refinements; all columns are nullable for legacy records.
SET @refinement_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'measurement_units');
SET @refinement_ddl = IF(@refinement_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `measurement_units` JSON NULL', 'SELECT 1');
PREPARE refinement_stmt FROM @refinement_ddl;
EXECUTE refinement_stmt;
DEALLOCATE PREPARE refinement_stmt;

SET @refinement_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'plot_facing');
SET @refinement_ddl = IF(@refinement_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `plot_facing` VARCHAR(100) NULL', 'SELECT 1');
PREPARE refinement_stmt FROM @refinement_ddl;
EXECUTE refinement_stmt;
DEALLOCATE PREPARE refinement_stmt;

SET @refinement_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'has_ground_floor');
SET @refinement_ddl = IF(@refinement_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `has_ground_floor` TINYINT(1) NULL', 'SELECT 1');
PREPARE refinement_stmt FROM @refinement_ddl;
EXECUTE refinement_stmt;
DEALLOCATE PREPARE refinement_stmt;

SET @refinement_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'number_of_portions');
SET @refinement_ddl = IF(@refinement_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `number_of_portions` INT NULL', 'SELECT 1');
PREPARE refinement_stmt FROM @refinement_ddl;
EXECUTE refinement_stmt;
DEALLOCATE PREPARE refinement_stmt;

SET @refinement_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'property_details' AND COLUMN_NAME = 'funded_by');
SET @refinement_ddl = IF(@refinement_exists = 0, 'ALTER TABLE `majestan`.`property_details` ADD COLUMN `funded_by` VARCHAR(100) NULL', 'SELECT 1');
PREPARE refinement_stmt FROM @refinement_ddl;
EXECUTE refinement_stmt;
DEALLOCATE PREPARE refinement_stmt;
