-- Read-only current-state audit. Run against the site inventory database.
-- Missing measurements are NOT proof of deletion; compare with a prior backup.
START TRANSACTION READ ONLY;
SELECT p.property_type, p.listing_type,
       COUNT(*) AS total_properties,
       SUM(d.property_id IS NULL) AS missing_details_row,
       SUM(COALESCE(d.area_sqft, 0) > 0) AS has_general_area,
       SUM(COALESCE(d.built_up_area, 0) > 0) AS has_built_up_area,
       SUM(COALESCE(d.carpet_area, 0) > 0) AS has_carpet_area,
       SUM(COALESCE(d.area_sqft, 0) > 0 AND COALESCE(d.built_up_area, 0) <= 0) AS general_area_without_built_up,
       SUM(COALESCE(d.area_sqft, 0) > 0 AND COALESCE(d.built_up_area, 0) <= 0 AND COALESCE(d.carpet_area, 0) <= 0) AS general_area_only
FROM properties p
LEFT JOIN property_details d ON d.property_id = p.id
GROUP BY p.property_type, p.listing_type
ORDER BY p.property_type, p.listing_type;

-- Bounded sample to identify records for comparison with a backup.
SELECT p.id, p.property_type, p.listing_type,
       d.area_sqft, d.area_unit, d.built_up_area, d.carpet_area, d.super_built_up_area, d.plot_area
FROM properties p
LEFT JOIN property_details d ON d.property_id = p.id
WHERE d.property_id IS NULL
   OR (COALESCE(d.area_sqft, 0) > 0 AND COALESCE(d.built_up_area, 0) <= 0)
ORDER BY p.id DESC
LIMIT 100;
COMMIT;
