# Projects module audit

Reference: production Projects create form inspected read-only and `master` form source. Target: local redesigned CRM, current working tree. No production data changed. This is a partial functional audit, not certification of every option or workflow.

## Finding: area unit conversion can erase precision

On a new project, Structure → Project Area: enter `2` while Sq Ft is selected, then select Acres. The conversion rounds to two decimal places in the new unit, turning 2 sq ft into 0 acres. Save the project: its overview shows Project area as `—`. The conversion in `crm-frontend/src/app/(dashboard)/projects/_components/ProjectForm.tsx` around the Project Area unit selector rounds before saving. Preserve sufficient precision or retain a canonical square-foot value; test repeated unit switches and small values. Note that the test entered 2 *before* selecting Acres, so it represents 2 sq ft, not 2 acres.

## Coverage and local fixture

Created local draft PA0020, `AUDIT TEST PROJECT` (http://localhost:4000/projects/20), with Coimbatore/Peelamedu, coordinates, custom builder and RERA, description, highlights, a specification, CCTV, structure values, one apartment unit with price/areas/features/parking, one video and one FAQ. Creation succeeded; list showed draft, 2 BHK, one unit and ₹75 L. Detail showed entered builder, RERA, description, highlights, specification, amenity, structure and unit summary. Edited RERA to `AUDIT-RERA-EDIT` and save reported success. Values were not independently checked after a browser reload.

Source label inventory found the old and new ProjectForm labels match, including nested unit sections. Project type options Apartment/Villa/Plot and area units Sq Ft/Cents/Acres/Grounds were inspected locally. Source comparison shows shared option definitions for status, possession, facing, furnishing and parking; master-sourced options depend on each environment's data. Required project name, city, locality and unit-code checks, duplicate floor names and invalid YouTube handling are present in source, but negative cases were not all executed.

Unverified: all dropdown selections and every conditional branch (especially plot and villa), project and unit media uploads/downloads, tower and room rows, floor-plan upload, multiple units, all FAQ sections, nearby/autopopulation, invalid/boundary validation, status transitions, permissions, list filters, concurrency conflicts, save/reload for every value, and production vs local detail parity for identical data. These require local fixture-driven tests; do not write to production.

Ran project-area, project-floor-plans and project-form-draft tests: 3 files, 25 tests passed. No application code changed in this audit.
