-- User-authorized commercial mapping: preserve general area and existing dedicated values.
-- Only canonical square-foot sources are eligible; other units require a separate review.
START TRANSACTION;
UPDATE majestan.property_details d
JOIN majestan.properties p ON p.id = d.property_id
SET d.built_up_area = d.area_sqft
WHERE p.property_type = 'commercial'
  AND (d.built_up_area IS NULL OR d.built_up_area = 0)
  AND d.area_sqft > 0
  AND d.area_unit = 'Sq Ft';
COMMIT;
