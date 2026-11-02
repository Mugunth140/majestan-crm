# Legacy bathroom split mapping and Commercial Buy boundaries

## Explicit user request

Show plot boundaries for Commercial Buy. For all property types, temporarily classify the existing bathroom total as Individual Bathrooms on production after the split UI change.

## Production mapping completed — 2 November 2026

Server: `mugunth@147.93.168.178`. The existing infrastructure migration runner applied only `064_legacy_individual_bathrooms.sql`, with exit 0. No application deployment or Git push was performed.

**628** positive unsplit bathroom totals were copied into `curation_details.individualBathrooms`:

| Property type | Mapped records |
|---|---:|
| apartment | 399 |
| commercial | 8 |
| coworking | 1 |
| individual_portion | 136 |
| industrial | 21 |
| villa | 63 |

- Existing `bathrooms` totals are unchanged.
- Existing individual/attached counts, including explicit zero and partial splits, are preserved.
- NULL/missing split keys (including JSON nulls) qualify; malformed/non-object metadata is excluded.
- No attached count is invented. All unrelated JSON keys are retained.
- Property update timestamps are advanced for changed records so already-open edit forms must refresh through existing version conflict protection before overwriting the new split.
- The before/after comparison against the fresh backup found exactly 628 expected metadata changes, unchanged totals and zero unexpected metadata changes.
- Commercial/industrial bathroom field visibility remains as previously curated; this mapping does not reintroduce fields the user previously requested removed. It preserves/classifies any legacy total still stored.

Fresh consistent backup of `properties` and `property_details`, gzip integrity verified before migration:

`/home/mugunth/crm_backups/pre_individual_bathrooms_mapping_20261102T093453Z.sql.gz`

## Commercial Buy UI

Local changes expose the existing four-sided plot boundary editor and realtime shape preview only for Commercial Buy. The preview uses commercial Property Facing when no separate Plot Facing is stored. Commercial Rent keeps the boundary section hidden, and its payload omits the boundaries so existing stored data is preserved by the partial-update bridge. No new storage column is needed.

This UI change is local, uncommitted and unpushed. The production bathroom mapping is already applied and can be seen after refreshing the CRM form.

## Verification

- All 671 CRM frontend tests in 64 files passed, including Commercial Buy rendering/facing and Buy-versus-Rent boundary payload cases.
- CRM frontend and site API production builds passed.
- Local infrastructure runner applied migration 064 successfully.
- Local MySQL temporary-table fixtures verified absent and JSON-null metadata, preserved unrelated keys, existing zero/partial/full split protection, zero totals, safe repetition and root JSON null handling; failed expectations 0.
- Migration 064 is mirrored in CRM backend migrations and registered as the idempotent TypeORM migration `LegacyIndividualBathrooms1786500000000` for later deployments. Down deliberately preserves classified/user-corrected data.
