-- Preserve existing pipelines; historical uploaders remain unknown.
ALTER TABLE inbounds
  ADD COLUMN uploaded_by_id INT NULL AFTER assigned_staff_id,
  ADD COLUMN is_queued TINYINT(1) NOT NULL DEFAULT 0 AFTER uploaded_by_id,
  ADD INDEX idx_inbounds_uploader (uploaded_by_id),
  ADD INDEX idx_inbounds_queue (is_queued, created_at);
