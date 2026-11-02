-- Stable server-controlled source for portal push enquiries.
INSERT INTO lead_sources (name, is_active)
VALUES ('99acres', 1)
ON DUPLICATE KEY UPDATE is_active = 1;
