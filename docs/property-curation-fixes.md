# Property curation fixes and validation

31 October 2026. Implemented locally on `feat/property-type-form-curation` in CRM, site API and public frontend. No commit, push or deployment performed.

## Fixed

| Confirmed issue | Correction |
| --- | --- |
| Unrelated edits delete hidden/duplicate documents | Form omits the document replacement when nothing changed. Explicit slot edits reconcile against the complete original attachment list, preserving duplicates and unsupported types. Floor-plan edits preserve general attachments. |
| Private documents become public or lose metadata | CRM no longer forces public visibility. Site API retains existing file/link IDs, visibility, MIME type, size and filename. Only explicit plan title/order changes update retained links. |
| Storage files removed before failed saves roll back | Update cleanup runs only after successful commit. Shared files are kept while another property still references them. Failed transactions leave existing storage objects intact. |
| Empty multi-select values restore the old selection | Visible Property Use, certificates and Approvals send explicit empty values; the CRM mapping preserves these instead of treating them as omitted. Hidden fields remain omitted and retain their historical data. |
| Unchecking Hypothecation fails to persist | Unchecked saves explicit No. Historical finance amounts/funding source remain stored privately and hidden while the saved flag is No. |
| Fractional generic areas cannot submit | Generic Area accepts fractional increments and validates finite nonnegative input. |
| Rental detail pages show hidden sale-only values | The CRM details page now applies the shared visibility rules to the affected pricing and verification rows. |
| Public website mislabels canonical sqft as acres | Public plot-area consumers use per-field measurement metadata when present, with the original interpretation retained for legacy records without metadata. |
| Legacy Plot Area changes physical size on edit | The editor restores legacy values in their historical general unit, then explicitly stores canonical sqft with per-field metadata. No bulk conversion or backfill was performed. Default units are recorded even if a user never touches the unit selector. |
| Public profiles omit new facts/types | Public DTO/types include new fields; Farm House uses hybrid home/agriculture details, Investment uses Independent House, and PG uses Apartment. Additional curated facts render without exposing private CRM finance/contact data. |
| Farm House registry absent when only site fallback runs | CRM bootstrap inserts missing curated registry values with INSERT IGNORE. SQL 061 provides the same idempotent seed. Existing staff labels and inactive settings are preserved. |
| SQL 059 replaces the existing enum list | It now appends Farm House to the observed enum instead of replacing other values. The tracked CRM and infra copies remain identical. |

## Validation completed

- CRM frontend: **516 tests passed** across 51 files.
- CRM property backend: **59 tests passed** across 11 suites.
- Site backend: **429 tests passed** across 71 suites.
- Public changed-property suites plus SEO retry: **101 tests passed** across four files.
- Production builds passed for CRM frontend, CRM backend, site API and public frontend. Both frontend builds include TypeScript validation; both backend builds also passed.
- Targeted lint and whitespace checks passed.
- Eighteen real form submit payloads were exercised, then passed through the actual CRM mapping and site update service into isolated MySQL. External storage/search/revalidation were mocked, and unrelated location resolution was excluded.
- A real-database attachment test verified retained private file identity, MIME/size/filename, plan title updates, and explicit removal. Storage deletion was mocked; no real files were accessed.
- Regression tests cover omitted replacements, duplicate attachments, explicit removals, privacy protection against older client defaults, rollback safety, shared references, clearing selections, unchecked finance, legacy units, default units, and rental display filtering.
- SQL 058–060 preserved all 11 synthetic legacy property types and existing values and passed a rerun. SQL 059 preserved an additional custom enum value and its row. SQL 061 reruns preserved customized/inactive registry entries.
- The required local infrastructure migration runner applied 061 successfully: **1 applied, 61 skipped, 0 failed**. Only the local development database was used.

## Remaining verification limits

The broad public frontend test run had four failures that were reproduced from an isolated copy of the unchanged committed source: property-wizard schema, two ProjectGallery tests, and Step3Location label matching. An additional SEO test timed out under the full parallel run and passed when retried with the changed property tests. These are outside the curation changes; the complete public test suite cannot be described as fully green.

The previously recorded CRM SMS/WhatsApp Jest/ESM loading failures were not changed; this fix pass ran the complete CRM frontend suite, the complete site backend suite and focused CRM property suites.

No authenticated browser create/edit/reopen walkthrough or production-size migration/load rehearsal was performed. Coordinate site API/schema deployment before the new CRM frontend, verify production backups and registry availability, and perform staging smoke checks before release. Runtime registry seeding closes the missing selector-entry gap; it does not deploy the site API or shared schema for you.

All migration/CRUD experiments used synthetic records in a separate disposable MySQL container. That container was removed. No live rows, customer files or production connections were used.
