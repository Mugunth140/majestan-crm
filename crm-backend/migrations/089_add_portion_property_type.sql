-- "Individual Portion": one floor or part of a house, separate from Independent House
-- (individual_portion). Appends to the site's property_type enum without removing types
-- added by standalone site migrations; keep in sync with the site migration
-- 1786800000000-AddPortionPropertyType.
SET @current_property_types = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type');
SET @property_type_ddl = IF(LOCATE("'portion'", @current_property_types) > 0,
  'SELECT 1', CONCAT('ALTER TABLE majestan.properties MODIFY property_type ',
    LEFT(@current_property_types, CHAR_LENGTH(@current_property_types) - 1),
    ",'portion') NOT NULL DEFAULT 'other'"));
PREPARE property_type_stmt FROM @property_type_ddl;
EXECUTE property_type_stmt;
DEALLOCATE PREPARE property_type_stmt;

INSERT INTO property_types (name, value, is_active)
SELECT 'Individual Portion', 'portion', 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM property_types WHERE value = 'portion');
