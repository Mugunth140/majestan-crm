# Commercial area preservation investigation

Reported record: CRM property #2696 (CS2696, Kiran, Commercial Rent).

Read-only live UI inspection on 2 November 2026 confirmed the edit form's built-up and carpet inputs are blank. The CRM detail view omits those measurements, shows a saved rent rate of ₹75/sqft, and displays both created/updated dates as 31 October 2026. No draft restoration prompt appeared.

The published page at https://www.majestanrealty.com/kiran-cs2696 still shows Total Area of 1,900 sq.ft. Its sidebar labels the same fallback as Built-Up Area; source inspection shows the sidebar can use general `areaSqft` when dedicated built-up area is missing. That label does not prove a dedicated built-up value exists. The public page may be cached; no authenticated raw API response/database snapshot was inspected. Do not infer deletion or historical dedicated measurements from this UI evidence alone.

## Confirmed bug

The curated form omits the general Area input, then reintroduced `areaSqft` and `areaUnit` from built-up area at submission. For a saved commercial record with general area 3200 sqft, built-up 2500 sqft and carpet 2100 sqft, an unrelated edit submitted general area 2500 sqft. Regression tests reproduced this for Buy and Rent before the fix.

The form now preserves an existing general area and its unit when that field is hidden. New building records (or records without a saved general area) can still seed searchable area from built-up area. Plot/farmland land-area inputs remain editable. Rate calculations continue using built-up area for buildings. No general area is relabeled as built-up or carpet area.

## Checked paths

- Commercial Buy and Rent currently render separate built-up and carpet inputs and initialize them from `propertyDetails.builtUpArea` / `carpetArea`.
- CRM bridge maps `builtUpArea` to site API `buildUpArea`; carpet area passes independently. A regression covers retaining all three distinct measurements through a partial edit.
- Site update preservation protects omitted stored measurements when recreating its detail row.
- Curation Two migration only adds nullable JSON contact/specification columns; it does not drop or backfill area columns.

## Remaining live investigation

The local CRM now displays a positive saved commercial general area as a read-only reference in the edit form and detail page. It remains excluded from automatic classification as built-up/carpet area.

Compare the record's raw saved values with a pre-deployment backup/audit trail, or confirm the previous measurements with the operator. If the stored measurements are missing or were overwritten, compare a pre-deployment backup/audit trail before preparing a narrow restoration. Do not bulk copy general area into built-up or carpet area: they represent different measurements.

No live record or schema was modified. This local fix prevents a confirmed overwrite path; it does not establish or repair the reported live carpet/built-up values.

## Expanded scope: every property profile

The general Area visibility rule applies globally, so #2696 is not an isolated case. Saved general measurements now appear as read-only references across building edit/detail views (Apartment, Villa, Individual Portion, Investment Property, Farm House, Commercial, Industrial, Co-working and PG / Service Apartment). Plot and Farmland retain their editable land-area controls instead. No saved general measurement is inferred to be built-up or carpet area.

The save regression matrix covers all 14 allowed building Buy/Rent combinations, plus all four Plot/Farmland combinations. The bridge regression covers omitted general/built-up/carpet/super-built-up/plot values across all 11 types. This checks application behavior; it is not a census of live inventory or evidence that earlier values were never deleted.

`property-area-audit.sql` provides a read-only inventory report grouped by type and listing, plus up to 100 candidate records for backup comparison. It has not been run against production. Counts of currently missing fields cannot establish historical loss without a prior snapshot. No bulk copy/backfill is included.

## Latest verification

- CRM frontend: all 669 tests in 64 files passed.
- CRM property bridge: 36 tests passed, including all-profile area preservation.
- CRM production build and whitespace checks passed.
- Updated an older Apartment Rent test to reflect the separately requested parking combinations UI, replacing its old scalar-parking expectation.
- A wider live sample inspection could not continue because the browser control connection returned an unavailable-session error. No production database connection/SSH alias is configured in this workspace. A pre-curation backup/current snapshot is requested for a full data comparison.
- Changes remain local and uncommitted; no production data writes, deployment, or push.

## Follow-up local database audit

A read-only audit of the available 949-property local database is now complete; see `property-area-local-audit.md`. All 759 commercial entries already have positive general Area and NULL built-up/carpet fields in this earlier dataset. Local and live #2696 are different properties, so numeric ID/generated property code cannot be used as a safe restoration key. Five legacy source records contain potential built-up values; none were applied. Current production inventory still needs a current snapshot and identity-verified comparison.

## Production audit completed

After receiving the production SSH destination, a read-only live database/backup comparison was completed on 2 November 2026. See `property-area-production-audit.md` for the authoritative production findings. The 1,587 matching records have unchanged general/built-up/carpet values against the 28 October inventory backup. Three Plot Area discrepancies and four absent IDs need separate review; no restoration was performed.
