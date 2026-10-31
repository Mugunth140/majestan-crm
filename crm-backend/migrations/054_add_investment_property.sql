-- Append the supported type without removing types added by standalone site migrations.
SET @current_property_types = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'majestan' AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type');
SET @property_type_ddl = IF(LOCATE("'investment_property'", @current_property_types) > 0,
  'SELECT 1', CONCAT('ALTER TABLE majestan.properties MODIFY property_type ',
    LEFT(@current_property_types, CHAR_LENGTH(@current_property_types) - 1),
    ",'\'investment_property\') NOT NULL DEFAULT 'other'"));
PREPARE property_type_stmt FROM @property_type_ddl;
EXECUTE property_type_stmt;
DEALLOCATE PREPARE property_type_stmt;

INSERT INTO property_types (name, value, is_active)
VALUES ('Investment Property', 'investment_property', 1)
ON DUPLICATE KEY UPDATE name = 'Investment Property', is_active = 1;
