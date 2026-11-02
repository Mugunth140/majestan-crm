# Read-only local inventory area audit

This is an audit of the local MySQL dataset, not the current production database. No SQL UPDATE, migration, import, or restore was executed.

- Local inventory: 949 properties.
- Latest property creation: 14 October 2026; latest update: 25 October 2026.
- Curation implementation commits inspected are dated 1 November 2026.
- Old site dump: `site/docs/dump.sql`, generated 9 April 2026, legacy schema.

| Type | Listing | Records | General area | Built-up | Carpet |
|---|---|---:|---:|---:|---:|
| apartment | Sell | 5 | 4 | 3 | 2 |
| villa | Sell | 1 | 1 | 0 | 0 |
| plot | Sell | 2 | 2 | 0 | 0 |
| farmland | Sell | 2 | 2 | 0 | 0 |
| commercial | Sell | 8 | 8 | 0 | 0 |
| commercial | Rent | 751 | 751 | 0 | 0 |
| industrial | Sell | 3 | 3 | 3 | 0 |
| industrial | Rent | 175 | 175 | 175 | 0 |
| coworking | Rent | 1 | 1 | 1 | 0 |
| other | Sell | 1 | 0 | 0 | 0 |

## Findings

All 759 commercial records in this earlier local dataset have positive general Area and NULL dedicated built-up/carpet measurements. The blank dedicated fields therefore predate the recent curation in this dataset. Hiding the general Area explains why the measurements can appear to disappear from the curated form. This does not rule out additional losses or edits in current production.

The older unified-schema migration also illustrates a historical collapse: commercial `carpet_area`, `unitsize`, and `plotarea` were coalesced into `property_details.area_sqft`. Because these are distinct concepts, general Area alone cannot safely reconstruct all dedicated measurements. This migration was inspected, not re-run or modified, and is not assumed to be the importer responsible for every current record.

## Identity mismatch: do not restore by numeric ID

Local #2696 is SABARI (`sabari-cs2696`), with general Area 3000 sqft, created 11 October 2026. Live #2696 is Kiran (`kiran-cs2696`), created 31 October 2026, whose public page shows 1900 sqft. Even the generated property code CS2696 is reused. A local row cannot safely overwrite a live row by ID or generated code.

## Legacy sources available locally

The local `commercial_space` legacy table contains 555 records. There are 551 matches using the imported `properties.legacy_source_id` against legacy `common_space_code`, rather than the newer generated property code. Only five matched records have a positive plain-numeric legacy `unitsize`; none of the 555 have a positive plain-numeric `carpet_area`. Non-numeric text is not automatically interpreted as a measurement.

The legacy website displayed `unitsize` as commercial built-up area. These five are potential source measurements for a future review, not approved changes:

| Local ID | Imported source code | Current general area | Legacy unit size | Exact title match |
|---|---|---:|---:|---|
| 2420 | CS423 | 1500.00 | 1500 | 1 |
| 2483 | CS355 | 7000.00 | 7000 | 1 |
| 2558 | CS274 | 45.00 | 1575 | 1 |
| 2637 | CS191 | 1000.00 | 1000 | 1 |
| 2639 | CS189 | 1000.00 | 1000 | 1 |

One candidate differs (45 general Area vs 1575 legacy unit size). Do not infer units or overwrite either number. Four agreeing candidates also require identity and recency checks against production.

## Safe next step

Run `property-area-audit.sql` against a current production snapshot using read-only access. Compare explicit measurements with a recent pre-deployment snapshot and stable source identifiers plus corroborating property identity. Prepare a reviewed, field-specific recovery list for missing values only. Do not bulk copy general Area into built-up or carpet area. A current production snapshot/recent backup has not been found in this workspace.

Application mitigation remains local: preserve the hidden general area and show it as a read-only reference across building forms and detail pages. Earlier verification: 669 frontend tests, 36 bridge tests, and the frontend production build passed.
