-- Explicitly authorized: classify positive unsplit legacy bathroom totals as individual bathrooms.
-- Preserve totals, recorded zero/partial/full splits and unrelated JSON metadata.
START TRANSACTION;
UPDATE majestan.property_details d
JOIN majestan.properties p ON p.id = d.property_id
SET d.curation_details = JSON_SET(
  CASE WHEN JSON_TYPE(d.curation_details) = 'OBJECT' THEN d.curation_details ELSE JSON_OBJECT() END,
  '$.individualBathrooms', d.bathrooms
), p.updated_at = CURRENT_TIMESTAMP(6)
WHERE d.bathrooms > 0
  AND (d.curation_details IS NULL OR JSON_TYPE(d.curation_details) IN ('OBJECT', 'NULL'))
  AND (JSON_EXTRACT(d.curation_details, '$.individualBathrooms') IS NULL OR JSON_TYPE(JSON_EXTRACT(d.curation_details, '$.individualBathrooms')) = 'NULL')
  AND (JSON_EXTRACT(d.curation_details, '$.attachedBathrooms') IS NULL OR JSON_TYPE(JSON_EXTRACT(d.curation_details, '$.attachedBathrooms')) = 'NULL');
COMMIT;
