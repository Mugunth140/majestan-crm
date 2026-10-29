-- Store per-square-foot rates independently from existing total sale amounts.
SET @price_per_sqft_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'price_per_sqft'
);
SET @price_per_sqft_ddl = IF(@price_per_sqft_exists = 0,
  'ALTER TABLE `majestan`.`properties` ADD COLUMN `price_per_sqft` DECIMAL(15,2) NULL AFTER `expected_sale_price`',
  'SELECT 1');
PREPARE property_price_stmt FROM @price_per_sqft_ddl;
EXECUTE property_price_stmt;
DEALLOCATE PREPARE property_price_stmt;
