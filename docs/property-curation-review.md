> Follow-up: the confirmed curation issues in this historical review have been fixed locally. See [fixes and validation](property-curation-fixes.md) for current results and remaining release checks.

# Property curation review — 31 October 2026

Reference: `/home/zendex/Documents/GenOffice/Majestan/Property_Curation.md`.
Branch: `feat/property-type-form-curation` (CRM and site API).

## Result

The requested form controls, option lists, and main visibility rules are implemented. This is **not a clean sign-off**: the save path still cannot persist some intentional removals, the generic area field blocks fractional measurements on ordinary form submission, and the read-only property page does not consistently apply the form’s visibility rules.

This was a source review plus focused automated checks. No production data was changed. No authenticated browser create/edit/reopen walkthrough was performed. The reference document was treated as the requirements checklist; existing conversation clarifications were retained (Villa rate uses built-up area; Commercial/Industrial deposits and lock-in remain for Rent).

## Findings

### 1. [P2] Removing all multi-select selections does not clear the saved values

Affected: Industrial Property Use and Building Approval Certificates; common Approvals has the same form-side omission problem.

Reproduce: edit an Industrial property with General Warehousing and Fire NOC; deselect everything; save and reopen. The old selections return. The form serializes blank selections as undefined and removes them. Even explicit empty strings are dropped by the details builder, and the update merges back the existing values.

Evidence: `crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx:1715`, `:1885` and `:1914`; `crm-backend/src/modules/properties/properties.service.ts:532` and `:730`. A temporary backend reproduction verified that `{ propertyUse: "", buildingApprovalCert: "", areaSqft: 1000 }` restores the old use/certificates in the outgoing update.

Fix direction: distinguish unchanged/hidden fields from deliberately cleared visible fields. Use an explicit clearing contract through both APIs, while retaining preservation for omitted fields. Add save/reopen regressions for deselecting the final selection.

### 2. [P2] Hypothecation cannot be turned off after saving Yes

Affected: Buy forms with Hypothecation enabled.

Reproduce: open a property with Hypothecation Yes, a Finance amount, and Funded By; uncheck Hypothecation; save and reopen. The checkbox sets an empty string, submission converts it to undefined, and the update omits the flag. The stored Yes remains, so Finance and Funded By reappear.

Evidence: `crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx:4520` and `:1717`. A temporary backend reproduction confirmed that the outgoing request omits hypothecation and retains the stored funding source.

Fix direction: persist an explicit No when unchecked. Decide explicitly whether dependent finance values are retained privately or cleared; they must stay hidden while the saved flag is No.

### 3. [P2] General Area rejects fractional Acres/Cents/Sqm

Affected: types using the general Area input, including Plot Total Project Area and Farmland. Named measurement controls such as Plot Area and Built Up Area already use `step="any"`.

Reproduce: enter 2.5 and choose Acres in the general Area field, then use Create/Update. The input is native type number with min 0 and no step, which defaults to whole-number increments; ordinary browser constraint validation blocks submission. This also affects reopening existing fractional values.

Evidence: `crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx:2279`. The shared Input passes through to a native input, and the surrounding form does not disable native validation.

Fix direction: allow decimal increments and apply finite, nonnegative validation to the generic area, as is already done for named measurement fields. Add a browser submission test using a fractional acreage value.

### 4. [P2] Rental details still display hidden sale-only values

Affected: read-only property details for imported records or listings switched from Buy to Rent; add/edit visibility is already curated.

Reproduce: view a Rent property with legacy Booking Amount, Hypothecation, or Deviation values. These still render on the details page despite being hidden in the rental form. A retained Buy monthly-income value also renders as Monthly Rent, which can contradict the actual rental price.

Evidence: `crm-frontend/src/app/(dashboard)/properties/[id]/page.tsx:358`, `:362`, `:638`, `:639`. These fields bypass the shared visibility helper. Co-Working’s verification card is separately hidden, so the verification example concerns other rental types.

Fix direction: apply the shared rules to each corresponding details field; do not erase the preserved legacy data merely to hide it.

## Requirements checklist

“Implemented” below means present in the rendering/payload rules reviewed, with focused test coverage where available; it does not imply every combination was manually exercised in a browser.

| Requirement group | Result |
| --- | --- |
| Rent type filtering; no Farm House; RERA hidden; Builder/Project only Apartment and Villa | Implemented. Farmland also remains Buy-only under the earlier curation. |
| Automatic rent per sqft; Co-Working rent per seat | Implemented; unit conversion helpers covered. |
| Sqft, Sqm, Cents, Acres measurement choices | Implemented, including Grounds; fractional generic Area has finding 3. |
| Alternative owner name, phone, email | Implemented in form and both API contracts. |
| Room Dimensions inside Floor Plans; details merged into property-specific form sections | Implemented in add/edit. Read-only Room Dimensions remains a separate section. |
| Tenant Occupied checkbox only Rent | Implemented. |
| Furnishing items only Fully/Semi Furnished, never Commercial/Industrial | Implemented. |
| Approvals multi-select with the five requested choices | Implemented; clearing all selections has finding 1. |
| Finance in words, conditional Funded By with Bank/NDFC/Local finance | Implemented; switching Hypothecation off has finding 2. |
| Verification and availability dropdowns | Implemented, including industrial ownership proof and legal clearance. |
| Apartment Rent: possession/super-built-up/general Area removed; lifts and numeric parking | Implemented. |
| Villa: expected sale price removed, automatic sqft rate based on built-up area, general Area removed | Implemented. Main Sale Price remains the calculation input. |
| Villa: Plot Area units, plot facing, Ground Floor checkbox before Total Floors | Implemented. |
| Independent House: portions and sqft price | Implemented, also inherited by Investment Property. |
| Commercial: Expected Monthly Rent on Buy, Plot/Built Up/Carpet/UDS areas, Floor Occupied removed, Available Floor Number | Implemented in form. Read-only visibility has finding 4. |
| Industrial: areas, building types, multi-select uses, flooring, container access, labor rooms/toilets | Implemented with requested option sets. |
| Industrial: pollution categories, multi-select certificates, no Available Visit Time or Blueprint/Layout | Implemented. Certificate storage widened to TEXT; clearing has finding 1. |
| Plot: no Open Sides/Topography/Fencing; zoning choices; No of Plots; amenities | Implemented. |
| Plot: rate basis selector for input and display, Total Project Area label | Implemented; precision-preserving rate storage and conversions covered. |
| Plot: four directional boundaries with diagonal direction choices and live visualization | Implemented as live labels on a fixed outline, explicitly marked not to scale. |
| Farmland: Plot Sizing/Zoning hidden, crop and plantation choices, conditional borewell count | Implemented. |
| Farm House: Buy-only mix of agricultural and Independent House fields | Implemented in forms, DTOs, entity, and migrations. |
| Commercial Rent: requested Property Use/Special Purpose/Accessibility options | Implemented. |
| Commercial Rent: furnished-only conference/cabin/seater counts; no Construction Date/Documents Required | Implemented. |
| Co-Working: documents/verification, generic Area/Open Sides, possession fields removed | Implemented. Available From is treated as possession date; floor plans and named areas remain. |

## Verification

- Frontend property/rental suites: **225 tests passed** across 13 files.
- CRM backend property suites: **56 tests passed** across 10 suites.
- Site API admin-property suites: **45 tests passed** across 10 suites.
- Two temporary characterization tests reproduced findings 1 and 2; both passed and were removed after execution. They assert the observed defective behavior, not correctness.
- Total existing focused tests: **326 passed**. These do not provide a full interactive create/edit/reopen check; current form tests primarily render markup and exercise helpers.
- No application fixes, commits, merges, or pushes were made during this review. Only this report was added.
