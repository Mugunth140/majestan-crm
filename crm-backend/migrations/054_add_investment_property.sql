-- Independent House field profile, stored as its own Buy-only property type.
-- The site API writes majestan.properties; its ENUM must accept the new type.
-- Also supported by the registered site TypeORM migration for standalone deploys.
ALTER TABLE `majestan`.`properties`
  MODIFY `property_type` ENUM('apartment','villa','individual_portion','plot','farmland','commercial','industrial','coworking','other','investment_property') NOT NULL DEFAULT 'other';

INSERT INTO `property_types` (`name`, `value`, `is_active`)
VALUES ('Investment Property', 'investment_property', 1)
ON DUPLICATE KEY UPDATE `name` = 'Investment Property', `is_active` = 1;
