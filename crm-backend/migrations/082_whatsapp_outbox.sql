-- Automatic WhatsApp messages to leads (visit confirmation, reminder, thanks…).
-- An event queues one row per automation and lead; it waits a couple of minutes
-- so quick edits (a visit moved twice) send one message, then goes out with the
-- lead's latest details. dedupe_key is set once sent, so each message goes once.
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id INT AUTO_INCREMENT PRIMARY KEY,
  automation VARCHAR(64) NOT NULL,
  lead_id INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',   -- pending | sending | sent | skipped | failed
  send_after DATETIME NOT NULL,
  dedupe_key VARCHAR(255) NULL,
  template_name VARCHAR(512) NULL,
  wa_message_id VARCHAR(191) NULL,
  reason TEXT NULL,                                 -- why it was skipped or failed
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_whatsapp_outbox_dedupe (dedupe_key),
  KEY idx_whatsapp_outbox_due (status, send_after),
  KEY idx_whatsapp_outbox_lead (lead_id, automation),
  CONSTRAINT fk_whatsapp_outbox_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
