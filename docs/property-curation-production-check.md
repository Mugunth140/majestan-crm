> Follow-up: the confirmed curation issues in this historical review have been fixed locally. See [fixes and validation](property-curation-fixes.md) for current results and remaining release checks.

# Property curation: data safety, migrations and mapping audit

31 October 2026. Branch: `feat/property-type-form-curation` in CRM and site API.

## Release decision

**Do not release the current changes yet.** The new columns and mappings are present and the builds pass, but existing edit behavior can delete attachments, change private document visibility, and produce incorrect public area labels. The four issues recorded in `property-curation-review.md` also remain unresolved. Some hazards predate the latest refinements; they still matter because these forms edit existing live properties.

No production connections, live rows, uploads or deployments were used. No application code, migrations or deployment configuration was modified during this check. This report and the accompanying field-mapping CSV are the deliverables.

## Data risks requiring fixes

### [P1] Ordinary edits can permanently remove attachments the form does not show

For types other than Co-Working, the form loads only the first document in each of five typed slots. The outgoing replacement list contains those entries and recognized floor plans. Additional legal documents, `other`, `video_tour`, and other unsupported entries disappear from that list during an unrelated edit.

The site API interprets missing keys as intentional deletion: it removes the file/link records and schedules storage deletion. This is more serious than a display issue.

Confirmed with the actual form submit handler, the CRM mapping, and the site update service against disposable MySQL: three existing documents (two legal documents plus one `other`) became one, and the storage mock received both omitted keys for deletion. No real storage service was called.

Sources: `crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx:647`, `:660`, `:1745`; site API `src/modules/admin/properties/admin-properties.service.ts:1082`–`:1105`.

Required correction: preserve every existing attachment unless the user explicitly removes it; only send a replacement set when attachments change, or merge retained records safely. Apply the preservation already used for ordinary Co-Working edits to other types, with deliberate removal tracked separately.

### [P1] A retained private document becomes public on save

The CRM detail adapter does not return `isPublic` in its document shape. The CRM payload builder then hardcodes `isPublic: true` for all submitted documents. A private retained document is recreated as public by the site API.

Confirmed against disposable MySQL: the retained document started with `is_public = false` and ended with `true`. This also affects a Co-Working floor-plan edit that resubmits preserved general attachments; an ordinary Co-Working edit omitting documents is protected.

Sources: CRM `crm-backend/src/modules/properties/properties.service.ts:360` and `:654`; site API `src/modules/admin/properties/admin-properties.service.ts:1326`.

Required correction: carry visibility and existing file metadata through reads and edits, preserve existing visibility for retained keys, and require an intentional action to change it. Avoid recreating retained files with default MIME type and zero file size.

### [P2] Public website mislabels canonical Plot Area using the generic Area unit

New named measurements are saved in canonical square feet, with their display units separately recorded in `measurementUnits`. The CRM editor and CRM details page honor this. The public website still labels `plotArea` using the unrelated `areaUnit`.

Confirmed example: a Commercial property with general Area = 1 acre and Plot Area = 1 acre saves `plotArea = 43560`, `areaUnit = Acres`, and `measurementUnits.plotArea = Acres`. The public grouped details render **43560 acres** instead of 1 acre or 43,560 sqft.

Sources: public frontend `src/lib/property-detail-groups.ts:394` and `:443`; `src/lib/property-sections.ts:165`–`:172`.

Required correction: update public consumers to use the new per-field metadata and canonical base, with a legacy fallback for records without metadata. Do not globally reinterpret historical values or run an unverified blanket data conversion.

### Other confirmed issues still open

- [P2] Clearing all Industrial Property Use / certificate selections, or common Approvals, does not clear persisted values.
- [P2] Unchecking Hypothecation omits the new state; the old Yes survives and dependent Finance fields reappear.
- [P2] Generic Area lacks decimal step support, blocking ordinary browser submission of fractional Acres/Cents/Sqm.
- [P2] The CRM read-only page still renders some preserved sale-only values on Rent records instead of consistently applying shared visibility rules.

Reproduction details and source locations are in `property-curation-review.md`.

## Migration coverage

The SQL copies in `infra/migrations/` and tracked `crm/crm-backend/migrations/` are byte-for-byte identical for 058, 059 and 060.

| Database change | SQL migration | Site API fallback | Result |
| --- | --- | --- | --- |
| `property_details.measurement_units` JSON | 058 | PropertySpecificationRefinements | Covered, nullable |
| `plot_facing` VARCHAR(100) | 058 | Same | Covered, nullable |
| `has_ground_floor` TINYINT(1) | 058 | Same | Covered, nullable |
| `number_of_portions` INT | 058 | Same | Covered, nullable |
| `funded_by` VARCHAR(100) | 058 | Same | Covered, nullable |
| `container_access` VARCHAR(30) | 059 | IndustrialLandAndFarmHouse | Covered, nullable |
| `labor_rooms`, `toilets`, `borewell_count` INT | 059 | Same | Covered, nullable |
| `plot_boundaries` JSON | 059 | Same | Covered, nullable |
| `special_purpose` VARCHAR(255) | 060 | CommercialRentalSpecialPurpose | Covered, nullable |
| `property_use` VARCHAR(255) → TEXT | 059 | IndustrialLandAndFarmHouse | Covered; accommodates all multi-selections |
| `building_approval_cert` VARCHAR(50) → TEXT | 059 | Same | Covered; accommodates long certificate selections |
| `price_per_sqft` DECIMAL(15,2) → DECIMAL(24,10) | 059; original column in 056 | Same; original AddPropertyPricePerSqft migration | Covered; increases fractional precision and integer range |
| `farm_house` property type enum | 059 | IndustrialLandAndFarmHouse | Covered for the expected existing enum |
| Farm House row in CRM `property_types` | 059 | **No equivalent CRM registry seed in the site fallback** | Must ship and apply infra SQL 059 |

Alternative owner contacts, area columns, lifts, parking, furnishing status, use/accessibility, verification and approval fields reuse existing columns. Changed labels do not require database renames. Derived rental rates use existing rent/area; no new stored column is necessary. Investment Property and PG / Service Apartment use the earlier migrations already present in the branch history.

### Actual migration tests

A separate MySQL 8.0 container was created with no production credentials or storage. Only local schema definitions were copied; no property rows or customer data were copied. The schema was rewound to the pre-058 shape **inside this disposable database only**.

Synthetic records covered all 11 preexisting enum values, NULLs, Unicode text, existing approvals and RERA, small prices, and the maximum old rate `9999999999999.99`.

Verified:

1. SQL 058–060 run successfully on the old shape.
2. All sampled old values across all 11 records remain identical, with decimal values compared numerically at their original scale.
3. Running the same SQL a second time preserves those values.
4. All 11 new nullable detail columns exist.
5. Farm House inserts succeed; long use/certificate values fit; explicit zero/false and native JSON save successfully.
6. Running the three TypeORM fallback migrations after the SQL path is safe.
7. TypeORM correctly writes and hydrates native JSON used by its `simple-json` entities, including directional boundary arrays and measurement maps.
8. A property-only update preserves the details row; newer fields survive a details replacement from an older client omitting them.

Limits: these are correctness tests on a small fixture, not a production load or lock-duration test. SQL 059 hardcodes the expected enum; the TypeORM fallback appends to the observed enum. A production schema drift check is necessary before running the hardcoded SQL. Column alterations can hold metadata locks or rebuild tables. Rollback methods preserve added data instead of dropping columns; application rollback must account for records created under new types.

## Frontend mapping audit

The accompanying `property-curation-field-mapping.csv` lists **202 explicit form payload keys** and their CRM/site destinations. No form payload key was absent from the CRM DTO. All **133 distinct mapped detail destinations** were declared in the site details DTO. The array handlers for documents, FAQs and amenities were checked separately because they use casted property access rather than ordinary `dto.field` syntax.

Important mappings checked:

| Form control / key | Site field / storage | Read/edit behavior |
| --- | --- | --- |
| `builtUpArea` | `details.buildUpArea` → entity `builtUpArea` → `built_up_area` | Rename verified, canonical sqft |
| `plotArea`, `carpetArea`, `superBuiltUpArea`, `udsArea`, `coveredArea`, `openArea` | Existing decimal detail columns | Named values canonical sqft; selected units in JSON |
| `plotSizeCents` | `details.plotSizeCents` → `plot_size_cents` | Canonical cents; selected units retained separately |
| `areaSqft`, `areaUnit` | `details.areaSqft`, `details.areaUnit` | Generic numeric area plus unit; hidden general area derived from built-up area where intended |
| Plot `pricePerSqft` + selected rate basis | Property `price_per_sqft`; basis in measurement JSON | Converts input rate to canonical per-sqft and restores basis in CRM |
| Villa automatic rate | Property `price_per_sqft`, calculated from total sale price / built-up sqft | Actual submit test confirms independence from Plot Area |
| Rent per sqft | Derived from existing property `price` / measured sqft | Read-only calculation; Co-Working excluded |
| Industrial Property Use | Frontend industrial state → `propertyUse` → `details.propertyUse` → TEXT | Multi-selection fits; clearing remains defective |
| Industrial certificates | `buildingApprovalCert` → `details.buildingApprovalCert` → TEXT | Long selections fit; clearing remains defective |
| `numberOfPortions`, `hasGroundFloor`, `plotFacing`, `fundedBy` | Corresponding detail columns from 058 | DTO, mapping, entity, save/read checked |
| `containerAccess`, `laborRooms`, `toilets`, `boreWellCount`, `plotBoundaries` | Corresponding detail columns from 059 | Zero counts and boundary JSON checked |
| Commercial `specialPurpose` | `details.specialPurpose` → `special_purpose` | Separate from Property Use; persisted and included in filter |
| Commercial Property Accessibility | `details.accessibility` → existing `accessibility` column | Reuses existing field |
| Alternate owner contact fields | Existing property-level alternate columns | API mapping present; protected by existing contact permissions |
| Amenities / furnishing item IDs | Relation arrays | Empty visible arrays are forwarded; hidden furnishing items omitted |
| Floor / Ground Plans | Documents with `documentType = floor_plan` | Plan title handling retained; other attachments need the fixes above |

A temporary submit-handler harness exercised all 11 types plus four edge cases (15 submissions). Those real outgoing form payloads passed the CRM validator/mapping and a partial site DTO validator. They were then saved by the real site update service into disposable MySQL. Storage, search, frontend revalidation and location resolution were excluded/stubbed; no upload or external side effect occurred. This is not an authenticated browser walkthrough.

### Public website coverage gap

CRM editor/read-only mappings were checked separately from the customer-facing website. The public `SeoPropertyDetails` type and renderers do not yet consume the new measurement map, boundary array, labor/toilet/borewell counts, special purpose and other newly added detail keys. The public grouped-details router also lacks an explicit Farm House hybrid profile and treats it as generic home content. This will not necessarily crash a page, but it does mean CRM curation is not fully reflected publicly. The unit-label issue above is a confirmed incorrect result, not merely a missing optional row.

## Production and deployment checks

- CRM frontend production build: passed.
- CRM backend production build: passed.
- Site backend production build: passed.
- Type checks for all three: passed.
- Existing CRM frontend tests: 49 files, **487 passed**.
- Existing site backend tests: 70 suites, **425 passed**.
- Existing CRM backend tests: 65 suites loaded, **454 tests passed**; **two other suites failed to load** in SMS/WhatsApp because Jest cannot parse the installed ESM `@nestjs/axios`. These failures are outside the property changes; the full backend test run is therefore not clean.
- Public property group/row tests: **29 existing tests passed**. An additional temporary characterization test reproduced the wrong Acres label.
- Extra temporary probes: 15 real form submissions, 15 cross-API contract cases, six database checks including a batch of 15 mapped saves, and one database attachment-risk reproduction. Observed-bug probes assert the defective current behavior; they are not evidence that the defect is fixed.
- Temporary probes were archived outside the repositories and removed; the disposable database/container was removed after collecting results.

### Required release order and outstanding evidence

1. Fix attachment preservation/privacy, public measurement labeling and the existing edit bugs, with regression coverage.
2. Stage a restore of a production-like backup and check schema drift, migration lock duration, imported document types, and representative older property records. No live-data claim can be made from synthetic fixtures alone.
3. Ship and apply infra SQL 058–060 before exposing the new CRM forms. Confirm the Farm House registry row exists. The tracked SQL copies inside the CRM repository are not copied into the running infra directory by its current CI workflow, and its backend Docker image does not run these SQL files.
4. Deploy the updated site API before the CRM that submits the new fields; its startup registers the TypeORM fallbacks, but those do not seed the CRM registry. Both repositories currently auto-deploy on `master`, not `main`; verify the actual release branch rather than assuming a merge to main deploys anything.
5. Take a database backup and preserve affected file storage before release. Reverting SQL cannot recover deleted objects or undo a private-to-public flag change safely.
6. Complete authenticated browser create/edit/reopen checks for Buy/Rent switching, all new field groups, retained private/duplicate documents, fractional areas, cleared selections and concurrent edits.

No commit, push, merge, deployment or live write was performed during this audit.
