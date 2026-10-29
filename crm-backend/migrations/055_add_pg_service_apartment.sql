-- PG / Service Apartment uses the Apartment rental field profile.
-- Extend the shared site enum before enabling the CRM master option.
ALTER TABLE `majestan`.`properties`
  MODIFY `property_type` ENUM('apartment','villa','individual_portion','plot','farmland','commercial','industrial','coworking','other','investment_property','pg_service_apartment') NOT NULL DEFAULT 'other';

INSERT INTO `property_types` (`name`, `value`, `is_active`)
VALUES ('PG / Service Apartment', 'pg_service_apartment', 1)
ON DUPLICATE KEY UPDATE `name` = 'PG / Service Apartment', `is_active` = 1;
