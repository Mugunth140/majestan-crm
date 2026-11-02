# Commercial area mapping applied — 2 November 2026

The user explicitly requested mapping normal/general Area to Built-up Area for commercial properties and retaining/mapping Carpet Area where available.

## Production outcome

Server: `mugunth@147.93.168.178`. Applied through the existing infrastructure migration runner, restricted to `063_commercial_general_area_mapping.sql`. No application deployment or Git push was performed.

- **783** commercial records received `built_up_area = area_sqft`.
- Only NULL/zero built-up values, positive general measurements and `area_unit = 'Sq Ft'` were eligible. Every live commercial record used Sq Ft.
- The **9** existing positive commercial built-up values were preserved.
- The **8** existing positive commercial carpet values were preserved. Other blank carpet values were left blank; no carpet measurements were invented from general area.
- General area, its unit, all other area columns and non-commercial records were unchanged in the before/after comparison.
- Zero eligible records remain; zero unexpected area changes were detected.
- #2696 now stores general Area 1900.00 sqft, Built-up Area 1900.00 sqft, Carpet Area NULL.

## Source review

The retained `porting/out/commercial_normalized.json` on the server has 759 source records and no separate carpet-area field. `commercial_normalize.py` maps original `Unit Size` into `details.areaSqft`; this explains why those imported measurements previously populated the general field. There is no live legacy `commercial_space` table to supply additional carpet values. Existing dedicated carpet values were already in their correct field and required no copy.

## Backup

Immediately before applying the migration, a fresh consistent dump of production `properties` and `property_details` was created and its gzip integrity verified:

`/home/mugunth/crm_backups/pre_commercial_area_mapping_20261102T092738Z.sql.gz`

It contains 1,634 properties and corresponding details. Recovery should use a field-specific review against this backup; do not import the entire backup over newer production data.

## Validation and deployment tracking

- Local standard infrastructure runner: applied 1 migration, skipped 63, failed 0.
- Local MySQL temporary-table fixtures verified NULL/zero mapping, existing-value preservation, carpet preservation, other-type exclusion, unknown-unit exclusion, empty-source exclusion and safe repetition; failed expectations 0, remaining eligible 0.
- Site API production build passed.
- Production standard runner: applied 1 migration, skipped 0, exit 0. `majestan_crm.schema_migrations` records the filename.
- Production comparison checked all eight numeric area columns and area unit against the fresh backup; exactly 783 expected built-up changes and no unexpected changes.
- A matching idempotent TypeORM migration is registered for future application deployments; its `down` deliberately does not erase mapped or subsequently corrected measurements.
- Infrastructure SQL is mirrored under CRM backend migrations so the operation is reviewable in Git. All repository changes remain uncommitted and unpushed.
