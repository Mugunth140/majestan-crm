# Property uploader column and upload date filters

## Behavior

- The property table shows Uploaded by and Uploaded on.
- Uploaded by is a staff-name selector. Inactive CRM accounts remain selectable so prior uploads can still be found.
- Uploaded from/to are optional date-only filters, inclusive in Asia/Kolkata. One-sided ranges work. The end boundary is the next midnight, exclusive, so sub-second timestamps throughout the selected last day are included.
- Staff/date filters combine with the existing type, listing, location, status, price and area filters. Filtering/counting happens in the inventory database before pagination. Selecting/clearing filters resets the page and the existing per-user saved-view mechanism retains them.
- New CRM creates and bulk uploads record the authenticated CRM user's ID on the site inventory record. Untrusted request bodies cannot choose attribution and edits do not reassign it.
- The site owner ID is a different identity namespace and is never used as the staff uploader.

## Historical data and privacy

The existing production schema had no uploader/created-by staff column, and the CRM activity log query found no property-create history suitable for attribution. The additive migration leaves all old uploader IDs NULL. The UI shows Not recorded, Imported, or Owner submission as appropriate. Missing directory entries retain a Staff #ID label rather than becoming a different staff member. New capture starts only after the application changes are deployed.

The uploader column uses select:false and is selected explicitly only by the authenticated CRM inventory list. Staff names are resolved from the CRM directory in one batched lookup. Directory responses contain only ID, name and active flag; no user contact, credential or HR fields are returned. Existing owner/agent contact redaction remains intact. Optional directory lookup failures degrade to IDs/empty directory without taking down the inventory/form-data response.

## Storage and production migration

`properties.uploaded_by_crm_user_id` is nullable unsigned INT with uploader/date and date indexes. There is no cross-database foreign key or fabricated historical backfill. SQL migration 065 is mirrored in CRM backend migrations; the matching idempotent TypeORM migration is registered in the site API and startup migration list. Down preserves uploader data.

Following the standing user instruction to copy required migrations to production infrastructure and run its migrator:

- Copied `065_property_upload_attribution.sql` to `/home/mugunth/majestan/infra/migrations/` on `mugunth@147.93.168.178`.
- Standard production migrator: applied 1, skipped 65, exit 0.
- Fresh properties backup, gzip verified before applying: `/home/mugunth/crm_backups/pre_property_upload_attribution_20261102T104422Z.sql.gz`.
- Compared all original property fields against that backup after the migration: 1,635 records before/after, zero historical records changed, zero historical creators assigned.
- No application code was deployed, and no Git commit or push was performed. Staff capture and UI require the CRM and site API code deployments.

## Verification

- CRM frontend: 674 tests passed in 66 files.
- CRM backend: 530 tests passed in 74 suites.
- Site API: 490 tests passed in 75 suites.
- All three production builds passed.
- Local standard SQL migrator: applied 1, skipped 65, failed 0.
- Native MySQL boundary fixtures returned exactly rows 2 and 3 for a combined staff/date filter in both UTC and India database session timezones, excluding rows one second before/at the next-day end and another staff member.
- Tests cover authenticated attribution, bulk attribution, spoof prevention, immutable creator on edit, batched name lookup, contact redaction, unknown historical creators, inactive directory entries, directory outage fallback, malformed IDs/dates, inverted ranges, half-open India date boundaries, filter/clear UI behavior and private nullable storage.
