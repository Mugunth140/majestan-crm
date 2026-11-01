# Property curation 2

Source: `/home/zendex/Documents/GenOffice/Majestan/Property_Curation2.md`.

## Confirmed choices

- Plot and Farmland retain a dedicated land-area field. Building price/rent calculations use built-up area.
- Plot rentals use Parking, Storage Yard, Nursery, Agriculture, Commercial Use and Other suitability options.
- Co-working requires Rent per Seat. It does not calculate a monthly total from minimum seats.
- Document & Verification is removed when a property is **both residential and Rent**. Buy forms and commercial/industrial rentals retain their applicable verification fields. Apartment Buy keeps Approvals, Finance and Funded By in General Details.

## Scope

- Primary owner plus two role-based alternatives; primary agent name/phone/email plus one alternative.
- Individual/attached bathroom counts, a combined total for existing API/search consumers and a website breakdown. Old totals remain unclassified until staff enter a split.
- Automatic sale/rent rates using canonical sqft; selected land area and rate units survive save/reopen. No standalone normal Area input remains.
- Manual room length × width in feet. Old unparseable dimension text remains until staff replace it.
- Shared boundaries and facing previews for land, Villa, Independent House, Investment Property and Farm House.
- BHK portion configurations, parking combinations, commercial rental multi-selects and passenger/service lifts.
- Updated ownership, water, electricity, agriculture, storage and industrial power options; NBFC; duplicate Farmhouse filtering.
- Requested per-type visibility changes, ground-floor controls, investment income fields, industrial canteen and co-working refreshment/restroom controls.
- Fully Furnished is the default for new co-working listings. Editing an existing listing retains its furnishing choice. Unknown legacy facility values remain unset until staff explicitly choose them.

Expected Sale Price is removed for Apartment/Farmland and types where it was already removed. Other existing fields not mentioned for removal retain their previous behavior.

## Storage and preservation

Two nullable site-database JSON columns are added:

| Column                              | Purpose                                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties.contact_details`        | New alternatives and agent contacts. Excluded from default/public queries; explicitly read by the authenticated admin API and protected by the CRM contact permission. |
| `property_details.curation_details` | Typed counts, portion/parking rows, facilities, structured commercial selections and new agriculture/industrial specifications.                                        |

The existing first owner-alternative columns remain compatible. Structured bathroom, lift and parking counts update legacy aggregate columns only when explicitly supplied. Unknown legacy splits are not guessed. An ordinary edit retains unknown legacy parking totals; No Parking explicitly clears them. Partial updates preserve omitted legacy measurements, flags and counts. Older clients can change a bathroom total without retaining a contradictory split.

No old columns or records are dropped or rewritten by the migration. Hidden values and attachments remain stored. Measurements retain canonical sqft for search and calculation, while `measurementUnits.landArea` and the existing per-field units preserve display units.

## Migration and rollout

- Infra SQL: `/run/media/zendex/Dev/work/Majestan/infra/migrations/062_property_curation_two.sql`.
- Versioned site migration: `PropertyCurationTwo1786300000000`, registered in the data source and startup schema runner.
- Both paths check for existing columns; rollback does not delete entered property data.
- Deploy the site API/schema before the updated CRM. The public frontend handles both new and older records.
- The infra directory is not a Git repository in this workspace. SQL remains at its required location; the registered TypeORM migration is versioned in the site API for standalone deployments.

Local verification used `cd infra && docker compose run --rm db-migrate`. The new migration applied successfully; existing rows had NULL in both added columns. No production database records were used for write tests.

An additional local MySQL transaction verified that default property queries exclude private contact JSON, explicit authenticated selection reads it, and specification values round-trip. The transaction was rolled back and the original values were verified.

## Validation

- CRM frontend: 59 files, 606 tests passed, including real dropdown/input interactions, every type/listing profile, draft restoration and save payloads.
- CRM API: 72 suites, 495 tests passed.
- Site API: 73 suites, 462 tests passed, including partial edits, legacy aggregate compatibility, contact permissions/storage and idempotent migration checks. Malformed nested rows receive a validation error rather than crashing the API.
- Public frontend: 765 tests passed; four existing failures reproduce on an unchanged master checkout. They concern the property-wizard basic-info fixture, two ProjectGallery expectations and the Step3Location City-label query. The changed property mapping and area/rate tests pass.
- Production builds passed for both frontends and both APIs.

The four unrelated website test failures are baseline issues; this branch does not claim a completely green website suite. This feature has not been merged to master or deployed to production.

Follow-up review: reproduced and fixed a partial-update edge case where adding BHK configurations to an older record with a NULL portion total restored NULL over the derived total. A regression test now checks that two 3-BHK portions and one 2-BHK portion derive a total of three without losing other legacy details. Rechecked all CRM frontend/API tests, the site API suite and 86 website mapping/measurement tests.
