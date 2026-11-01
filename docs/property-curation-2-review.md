# Property Curation 2 — requirement review

Reviewed against `Property_Curation2.md` and the user's subsequent answers. Status applies to `feat/property-curation-2`, not the deployed production application.

## User clarifications applied

- Remove Document & Verification only when the property is **residential AND Rent**. Keep Approvals. Apartment Buy keeps Approvals, Finance and Funded By in its details section.
- Calculate building rates from built-up area; Plot/Farmland retain a dedicated land-area input.
- Plot Rent suitability uses land uses, not Family/Bachelor.
- Co-working uses Rent per Seat alone, without a calculated monthly total.

## Requirement coverage

Every row below was traced through rendering, submission and the applicable API/storage or public display mapping. No requested item remains deferred.

| Requirement | Result |
| --- | --- |
| Owner primary name/phone/email and two alternatives with Care Taker/Security/Manager roles | Implemented; first alternative also maps to legacy columns, second is preserved in private JSON |
| Agent primary name/phone/email and one alternative | Implemented; new contacts obey CRM contact permissions and are excluded from default public ORM selection |
| Individual/attached bathrooms and combined website total | Implemented; existing unsplit totals are preserved rather than guessed |
| Automatic price per sqft across Buy profiles | Implemented using built-up area for buildings and land area for land; zero/missing denominators do not calculate a rate |
| Water supply options and Individual/Company/Joint ownership | Implemented |
| Residential Rent verification removal and Approvals retention | Implemented using the clarified AND condition; Buy and commercial/industrial Rent retain applicable fields |
| Manual room length × width | Implemented in feet, included in drafts; unparseable legacy measurements survive ordinary edits |
| Boundaries and facing preview for Independent House, Villa, Investment Property and Farm House | Implemented; also retained for Plot and added for Farmland |
| Additional amenity notes renamed Additional Notes | Implemented in residential and commercial sections |
| Remove the duplicate unspaced Farmhouse selector entry | Implemented; canonical Farm House remains Buy-only |
| BHK configuration/count rows wherever No of Portions appears | Implemented; counts validated against total; partial API updates derive missing legacy totals |
| Remove normal Area input everywhere | Implemented; dedicated land-area input retained per clarification; canonical search area is maintained |
| Apartment Buy: remove Expected Sale Price, automatic rate, NBFC, lifts | Implemented; Finance/Funded By remain as clarified |
| Apartment Rent: remove UDS and Outdoor Spaces | Implemented |
| Commercial Buy: expected monthly sqft rate and electricity choices | Implemented; expected monthly rent divided by built-up sqft; Single Phase/Three Phase choices |
| Commercial Buy: remove Documents Required, add portions and structured Car/Bike Open/Covered counts | Implemented; structured parking also maintains legacy totals |
| Commercial Rent: remove UDS, tenant mix, lift facility, Plot Area and duplicate furnished checkbox | Implemented |
| Commercial Rent: passenger/service lifts; hide cabins/conference/seaters for Bareshell | Implemented; only fully/semi-furnished selections show these fields |
| Commercial Rent: multi-select utilities, special purpose and property use; dimensions in feet | Implemented; selections stored as typed arrays; comma-containing utility names now round-trip intact |
| Farm House: remove Plot Area, floor/unit number, available portion and RERA; ground floor plus boundaries | Implemented with combined agricultural/residential profile |
| Farmland: remove RERA, Expected Sale Price and boundary wall; Price per Area and boundaries | Implemented; sqft/sqm/cents/acres/grounds units retained through save/reopen and public display |
| Farmland: all ten storage capacity options and six irrigation choices | Implemented; old tank presence remains compatible with unknown capacity |
| Farmland: Agriculture EB 1/2/3, Mud/Tar Road choices | Implemented; “Thar” interpreted as Tar Road |
| Farmland: only Tax Receipt and Approvals in verification | Implemented |
| Independent House: ground-floor flag; Rent available floor numbers replacing available portion | Implemented |
| Investment: automatic rate, structured parking, total and expected monthly rent | Implemented; income/parking facts mapped to detail views |
| Plot Buy: zoning beside property type | Implemented |
| Plot Rent: remove Total Project Area, No of Plots and SF Number; suitability and relocated zoning | Implemented; dedicated Land Area remains per clarification |
| Industrial: General Storage use, remove heavy/truck access and counts, ownership proof and other legal clearance | Implemented for Buy and Rent |
| Industrial: 25/50/75/100/125/150 HP, High Density and canteen | Implemented; numeric legacy HP synchronized; High Density does not retain stale numeric HP |
| Co-working: remove built-up/carpet/lease/monthly/incremental/electricity charges | Implemented |
| Co-working: Fully Furnished default, conditional restroom count and free refreshment | Implemented; default applies to new forms, existing furnishing choices survive edits |

## Preservation and migration review

- Two guarded nullable JSON additions; no drops, backfill or rewrite of existing property data.
- Registered TypeORM migration and required infra SQL migration both exist.
- Local migration and rolled-back MySQL round-trip checks passed previously; production records were not modified.
- Partial updates preserve omitted legacy measurements, attachments, flags and counts. Structured aggregates are recalculated only when relevant refinements are supplied.
- Hidden form values stay stored. Public details prefer current structured selections while older records retain fallbacks.
- New owner/agent contact JSON is private; public specification JSON contains no contacts.
- Deploy the site API/schema before the new CRM. The feature is not merged or deployed.

## Validation

- CRM frontend: 607 tests passed, including all profile render checks, real control interactions, save payloads, draft restoration and the comma-containing utility regression.
- CRM API: 495 tests passed.
- Site API: 462 tests passed.
- Website: 765 passed; four failures remain the previously confirmed unchanged-master baseline issues in the basic-info wizard fixture, ProjectGallery and Step3Location.
- Both frontend and both API production builds passed in the implementation run; the CRM production build was repeated after the multi-select fix.

The review covers the checked-out source, automated tests and local database evidence. It is not a claim that this branch has been verified on the production deployment.
