-- Missing curated property types only. Keep existing labels and active settings.
INSERT IGNORE INTO `property_types` (`name`, `value`, `is_active`) VALUES
('Investment Property', 'investment_property', 1),
('PG / Service Apartment', 'pg_service_apartment', 1),
('Farm House', 'farm_house', 1);
