-- When a lead was last assigned and when its owner first touched it after
-- that, so the leads list can show who is still waiting for a first call.
-- Triggers keep both current from every code path that assigns a lead or
-- logs a contact; a new owner starts a new wait.
ALTER TABLE leads
  ADD COLUMN assigned_at DATETIME(6) NULL,
  ADD COLUMN first_contacted_at DATETIME(6) NULL,
  ADD COLUMN first_contact_nudged TINYINT NOT NULL DEFAULT 0 COMMENT '0 none, 1 owner reminded, 2 team lead told',
  ADD INDEX IDX_leads_first_contact (assigned_staff_id, first_contacted_at);

DROP TRIGGER IF EXISTS leads_assigned_insert;
DELIMITER $$
CREATE TRIGGER leads_assigned_insert BEFORE INSERT ON leads FOR EACH ROW
BEGIN
  IF NEW.assigned_staff_id IS NOT NULL AND NEW.assigned_at IS NULL THEN
    SET NEW.assigned_at = CURRENT_TIMESTAMP(6);
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS leads_assigned_update;
DELIMITER $$
CREATE TRIGGER leads_assigned_update BEFORE UPDATE ON leads FOR EACH ROW
BEGIN
  IF NOT (NEW.assigned_staff_id <=> OLD.assigned_staff_id) THEN
    SET NEW.assigned_at = IF(NEW.assigned_staff_id IS NULL, NULL, CURRENT_TIMESTAMP(6));
    SET NEW.first_contacted_at = NULL;
    SET NEW.first_contact_nudged = 0;
  END IF;
END$$
DELIMITER ;

-- A call, message, email or share the owner logs. A missed incoming call is
-- the customer reaching out, not the owner, so it doesn't count.
DROP TRIGGER IF EXISTS contact_logs_first_contact;
DELIMITER $$
CREATE TRIGGER contact_logs_first_contact AFTER INSERT ON contact_logs FOR EACH ROW
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.sent_by_id IS NOT NULL
     AND NOT (NEW.contact_type = 'call' AND NEW.call_direction = 'Missed') THEN
    UPDATE leads SET first_contacted_at = NEW.created_at, updated_at = updated_at
     WHERE id = NEW.lead_id AND assigned_staff_id = NEW.sent_by_id
       AND assigned_at IS NOT NULL AND NEW.created_at >= assigned_at
       AND (first_contacted_at IS NULL OR first_contacted_at > NEW.created_at);
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS lead_follow_ups_first_contact;
DELIMITER $$
CREATE TRIGGER lead_follow_ups_first_contact AFTER INSERT ON lead_follow_ups FOR EACH ROW
BEGIN
  IF NEW.created_by_id IS NOT NULL THEN
    UPDATE leads SET first_contacted_at = NEW.created_at, updated_at = updated_at
     WHERE id = NEW.lead_id AND assigned_staff_id = NEW.created_by_id
       AND assigned_at IS NOT NULL AND NEW.created_at >= assigned_at
       AND (first_contacted_at IS NULL OR first_contacted_at > NEW.created_at);
  END IF;
END$$
DELIMITER ;

-- Backfill: the latest hand-over to the current owner, else when the lead was created.
UPDATE leads l
   SET l.assigned_at = COALESCE(
         (SELECT MAX(r.created_at) FROM routing_histories r WHERE r.lead_id = l.id AND r.to_user_id = l.assigned_staff_id),
         l.created_at),
       l.updated_at = l.updated_at
 WHERE l.assigned_staff_id IS NOT NULL;

UPDATE leads l
  JOIN (
    SELECT t.lead_id, MIN(t.ts) AS first_ts FROM (
      SELECT c.lead_id, c.created_at AS ts FROM contact_logs c JOIN leads x ON x.id = c.lead_id
       WHERE c.sent_by_id = x.assigned_staff_id AND c.created_at >= x.assigned_at
         AND NOT (c.contact_type = 'call' AND c.call_direction <=> 'Missed')
      UNION ALL
      SELECT f.lead_id, f.created_at FROM lead_follow_ups f JOIN leads x ON x.id = f.lead_id
       WHERE f.created_by_id = x.assigned_staff_id AND f.created_at >= x.assigned_at
    ) t GROUP BY t.lead_id
  ) first ON first.lead_id = l.id
   SET l.first_contacted_at = first.first_ts, l.updated_at = l.updated_at;

-- Leads already waiting before this went live don't each send a reminder;
-- they show in the list and the evening summary instead.
UPDATE leads SET first_contact_nudged = 2, updated_at = updated_at
 WHERE assigned_staff_id IS NOT NULL AND first_contacted_at IS NULL;
