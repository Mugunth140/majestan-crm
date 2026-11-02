# Production area audit — 2 November 2026

Server: `mugunth@147.93.168.178` (vmi3329350). This audit used read-only SQL transactions against the production `majestan` database. Backup files were parsed as text; no backup SQL was executed, restored, or imported. Only property identities and area columns were extracted for comparison; no contacts or credentials are included in this report.

## Backups found

- `/home/mugunth/crm_backups/pre_migrations_040_045_20261028_101203.sql.gz`: contains site `properties` and `property_details`, with 1,591 property/detail records.
- `/home/mugunth/majestan/infra/backups/pre-blog-migrations-20261026T184156Z.sql.gz`: contains site inventory, with 1,579 properties.
- The later 28 October `pre_migrations_046_052_20261028_174011.sql.gz` contains CRM tables but no site property/detail tables, so it cannot restore these measurements.
- No newer inventory-containing SQL backup was found in the searched home/backup/server application directories. This is not an assertion that no external/provider backup exists.

## Comparison with 28 October

- Current production properties: **1,634**.
- Matched existing property identities: **1,587**; ID, creation timestamp, property type and imported source ID agree. No identity mismatch among present IDs.
- New IDs absent from the backup: **47**. These cannot be checked for earlier measurements using this backup.
- Backup IDs no longer present: **9, 31, 35, 1638**. These are absent IDs, not proof of accidental deletion; intentional deletes, merges or recreations need review.
- Across matching records, **general Area, Built-up Area, Carpet Area, Super Built-up Area, UDS, Covered Area and Open Area are unchanged**.
- Three previously positive Plot Area values are now NULL. No other numeric area-field changes were found.

## Commercial conclusion

The backup has 790 commercial records; 787 remain with matching identities. Their general/built-up/carpet values are unchanged. The backup already contained blank dedicated built-up/carpet fields on many commercial listings. The 3 absent commercial IDs explain the difference between backup and current counts of populated dedicated measurements, rather than cleared fields on matched properties.

Live #2696 (Kiran) currently stores **area_sqft = 1900.00, area_unit = Sq Ft, built_up_area = NULL, carpet_area = NULL**. It was created 31 October and is not in the 28 October or 26 October baseline. This confirms the current field separation and retained general area, but cannot prove whether an earlier edit to that new record ever had dedicated built-up/carpet data.

The curated form hid general Area, so a retained measurement could appear missing while the separate dedicated fields remained blank. The local application fix exposes the saved general value read-only and protects it from overwrite; it does not invent dedicated measurements.

## Plot Area discrepancies

| ID | Type | 28 October Plot Area | Current Plot Area | Current row last updated |
|---|---|---:|---|---|
| 22 | Apartment | 2.00 | NULL | 29 October 2026 |
| 460 | Individual Portion | 1132.00 | NULL | 29 October 2026 |
| 2623 | Villa | 914.00 | NULL | 29 October 2026 |

The 26 October backup also has Plot Area 2.00 for #22 and 1132.00 for #460; #2623 had not been created then. Row update dates suggest earlier edits, but do not identify the specific operation or establish causation. Raw numbers are not a verified unit/classification; #22 especially needs source verification. No values were restored.

## Current production coverage

Counts indicate current data presence, not historical loss. A field may legitimately be inapplicable.

| Type | Listing | Records | General area > 0 | Built-up > 0 | Carpet > 0 |
|---|---|---:|---:|---:|---:|
| apartment | Sell | 391 | 385 | 384 | 307 |
| apartment | Rent | 17 | 12 | 12 | 3 |
| villa | Sell | 61 | 57 | 60 | 40 |
| villa | Rent | 3 | 3 | 3 | 3 |
| plot | Sell | 12 | 7 | 0 | 0 |
| commercial | Sell | 9 | 9 | 2 | 1 |
| commercial | Rent | 787 | 783 | 7 | 7 |
| coworking | Sell | 1 | 1 | 1 | 1 |
| coworking | Rent | 7 | 5 | 2 | 3 |
| farmland | Sell | 2 | 0 | 0 | 0 |
| industrial | Sell | 7 | 6 | 5 | 3 |
| industrial | Rent | 200 | 194 | 31 | 4 |
| individual_portion | Sell | 115 | 107 | 109 | 93 |
| individual_portion | Rent | 22 | 21 | 21 | 15 |

## Actions and limits

- No production records, files, application settings, schema, or deployments were changed.
- Do not bulk copy general Area into built-up or carpet fields: source identity and measurement meaning must be verified.
- Review the 3 Plot Area discrepancies and 4 absent IDs before deciding on recovery. A restore should target verified fields on verified records, never import a whole older database over current data.
- A backup after 31 October or an audit trail is needed to establish historical dedicated measurements for #2696 and the other newly created records.
- The prior 949-record local audit is separate and is not the production audit. Its #2696 is a different property; it must not be used to restore this live record.

## Subsequent authorized mapping

After this read-only audit, the user explicitly requested general Area to Built-up Area mapping for commercial properties. A fresh backup was taken and a targeted migration populated 783 missing built-up values; all existing carpet values and other area fields were preserved. See `commercial-area-production-mapping.md` for the completed production operation. The earlier "nothing changed" statements describe the audit phase, not this later authorized mapping.
