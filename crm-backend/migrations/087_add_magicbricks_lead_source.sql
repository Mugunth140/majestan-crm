-- Lead source for Magicbricks push enquiries (POST /api/v1/leads/magicbricks).
-- Prod already has "Magic Bricks"; this keeps fresh databases in step.
INSERT INTO lead_sources (name, is_active)
VALUES ('Magic Bricks', 1)
ON DUPLICATE KEY UPDATE is_active = 1;
