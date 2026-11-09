-- "Sales"/"Sales Department", "Telecalling"/"Telecalling Department" and
-- "HR"/"HR Department" were the same teams twice: the boot seed added the
-- suffixed names next to older short ones. Move everyone onto the older row,
-- drop the newer one, and give the survivor the suffixed name the seed uses.
CREATE TEMPORARY TABLE dept_merge AS
SELECT dup.id AS dup_id, keep.id AS keep_id, dup.name AS full_name
FROM departments dup
JOIN departments keep
  ON keep.id < dup.id
 AND LOWER(TRIM(keep.name)) = LOWER(TRIM(REGEXP_REPLACE(dup.name, '[[:space:]]+(Department|Dept)$', '')))
WHERE dup.name REGEXP '[[:space:]]+(Department|Dept)$';

UPDATE users u JOIN dept_merge m ON u.department_id = m.dup_id SET u.department_id = m.keep_id;
UPDATE task_templates t JOIN dept_merge m ON t.department_id = m.dup_id SET t.department_id = m.keep_id;
DELETE d FROM departments d JOIN dept_merge m ON d.id = m.dup_id;
UPDATE departments d JOIN dept_merge m ON d.id = m.keep_id SET d.name = m.full_name;

DROP TEMPORARY TABLE dept_merge;
