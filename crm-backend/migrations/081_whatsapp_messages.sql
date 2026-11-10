-- WhatsApp Cloud API messages received through the Meta webhook, plus the delivery
-- status of messages the CRM sends. wa_message_id is Meta's id (wamid.*), so a
-- webhook Meta retries is stored once.
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wa_message_id VARCHAR(191) NOT NULL,
  direction VARCHAR(10) NOT NULL,              -- in | out
  phone VARCHAR(32) NOT NULL,                  -- the customer's number, digits only
  phone_number_id VARCHAR(64) NULL,            -- our business number's Meta id
  contact_name VARCHAR(255) NULL,
  lead_id INT NULL,
  message_type VARCHAR(32) NOT NULL,           -- text | image | document | audio | video | location | button | ...
  body TEXT NULL,
  media_id VARCHAR(191) NULL,
  status VARCHAR(20) NOT NULL,                 -- received | sent | delivered | read | failed
  error TEXT NULL,
  sent_at DATETIME NULL,                       -- Meta's timestamp for the message
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_whatsapp_messages_wamid (wa_message_id),
  KEY idx_whatsapp_messages_lead (lead_id),
  KEY idx_whatsapp_messages_phone (phone),
  CONSTRAINT fk_whatsapp_messages_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
);
