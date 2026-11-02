-- Nullable creator attribution in the CRM user namespace; never infer historical staff.
SET @upload_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='majestan' AND TABLE_NAME='properties' AND COLUMN_NAME='uploaded_by_crm_user_id');
SET @upload_ddl = IF(@upload_exists=0, 'ALTER TABLE majestan.properties ADD COLUMN uploaded_by_crm_user_id INT UNSIGNED NULL', 'SELECT 1');
PREPARE upload_stmt FROM @upload_ddl; EXECUTE upload_stmt; DEALLOCATE PREPARE upload_stmt;
SET @upload_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='majestan' AND TABLE_NAME='properties' AND INDEX_NAME='idx_properties_uploaded_date');
SET @upload_ddl = IF(@upload_exists=0, 'CREATE INDEX idx_properties_uploaded_date ON majestan.properties (uploaded_by_crm_user_id, created_at)', 'SELECT 1');
PREPARE upload_stmt FROM @upload_ddl; EXECUTE upload_stmt; DEALLOCATE PREPARE upload_stmt;
SET @upload_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='majestan' AND TABLE_NAME='properties' AND INDEX_NAME='idx_properties_upload_date');
SET @upload_ddl = IF(@upload_exists=0, 'CREATE INDEX idx_properties_upload_date ON majestan.properties (created_at)', 'SELECT 1');
PREPARE upload_stmt FROM @upload_ddl; EXECUTE upload_stmt; DEALLOCATE PREPARE upload_stmt;
