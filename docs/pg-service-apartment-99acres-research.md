# PG / Service Apartment — researched field mapping

Verified directly in the signed-in [99acres posting form](https://www.99acres.com/post-property), through Basic Details, Location, Property Profile, Photos and Pricing & Others. The PG → Serviced Apartment path was inspected, including conditional controls. No final listing submission was made.

## Reference fields and implementation

| Observed reference                                                                                                           | CRM mapping                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PG residential categories: Flat/Apartment, Independent House/Villa, Builder Floor, 1 RK/Studio Apartment, Serviced Apartment | Accommodation category within the existing Rent-only PG / Service Apartment type                                                                                      |
| Bedrooms, bathrooms, balconies                                                                                               | Existing bedroom and balcony columns; PG uses the total bathroom input, matching the reference                                                                        |
| Sharing / Private                                                                                                            | Room type; monthly base rent is per bed for Sharing and per room for Private                                                                                          |
| Sharing count: 2, 3, 4, 4+                                                                                                   | Whole-number people-sharing input, minimum two                                                                                                                        |
| Total beds / beds available, or total rooms / rooms available                                                                | Capacity labels change with room type; changing type clears incompatible counts; available capacity cannot exceed a known total                                       |
| Attached bathroom / balcony                                                                                                  | Optional booleans; unknown is not silently converted to No                                                                                                            |
| Carpet, built-up, super built-up area, at least one required                                                                 | Existing canonical-sqft measurements and display-unit selectors; new PG entries require at least one; normal Area remains removed                                     |
| Pooja, Study, Servant and Store rooms                                                                                        | Other rooms multi-select                                                                                                                                              |
| Furnished, Semi-furnished, Un-furnished; room and common-area furnishings                                                    | Existing furnishing status; dedicated furnishing count lists; only fully/semi-furnished selections show the lists, preserving the user's earlier rule                 |
| In-room items                                                                                                                | AC, TV, Beds, Wardrobe, Light, Fans, Geyser, Fridge, Curtains, Study Table                                                                                            |
| Common-area items                                                                                                            | TV, AC, Light, Fans, Sofa, Wardrobe, Geyser, Washing Machine, Stove, Fridge, Water Purifier, Microwave, Modular Kitchen, Chimney, Dining Table, Curtains, Exhaust Fan |
| Covered / Open parking                                                                                                       | Separate counts                                                                                                                                                       |
| Total floors, property floor, age and available date                                                                         | Existing fields retained                                                                                                                                              |
| Girls / Boys / Any                                                                                                           | Available for dropdown                                                                                                                                                |
| Students / Working Professionals                                                                                             | Suitable for multi-select                                                                                                                                             |
| Expected Rent                                                                                                                | Existing primary monthly price; per-bed/per-room labels in CRM and website; no per-sqft PG rental rate                                                                |
| Maintenance, booking amount, membership charge                                                                               | Dedicated PG price fields; maintenance period Monthly, Annually, One Time, Per Unit/Monthly                                                                           |
| Security deposit Fixed / Multiple of Rent / None                                                                             | Conditional amount or month count; deposit multiple capped at 30, as shown by the reference                                                                           |
| Laundry, Electricity, Water, Wifi, Housekeeping, DTH included or excluded                                                    | One status per service: Included in rent, Not available, Available for extra charge; avoids contradictory inclusion/exclusion selections                              |
| Extra-charge basis Fixed amount / On consumption basis                                                                       | Conditional amount; no fabricated fixed charge for consumption-based services                                                                                         |
| Food Available / Not Available                                                                                               | Conditional meal section                                                                                                                                              |
| Only Veg / Veg & Non Veg                                                                                                     | Meal type dropdown                                                                                                                                                    |
| Weekday / weekend Breakfast, Lunch, Dinner                                                                                   | Separate multi-select schedules                                                                                                                                       |
| Food Included in rent / Per meal basis / Fixed monthly amount                                                                | Conditional breakfast/lunch/dinner amounts or monthly amount                                                                                                          |
| Minimum contract 0–36 months; notice None / 1–6 months                                                                       | Month dropdowns, with zero representing None                                                                                                                          |
| Early leaving None / Fixed / Multiple of Rent                                                                                | Conditional amount or month count                                                                                                                                     |
| Pets, Visitors, Smoking, Alcohol, Party/Event Yes / No                                                                       | Independent optional rule dropdowns                                                                                                                                   |
| Last entry time 7 PM through midnight in half-hour increments                                                                | Dropdown storing 24-hour values                                                                                                                                       |
| Other rules and property description                                                                                         | Other house rules and existing description field                                                                                                                      |
| Photos, video and email                                                                                                      | Existing upload/video controls and main contact email; alternative contacts retain name/phone only, as requested                                                      |

The reference has no generic apartment project inventory, UDS, No of Lifts, generic rental deposit/lock-in duplicates or approvals in the inspected PG profile. Those fields are hidden for this type. Existing CRM identity, contact permissions, workflow and publishing controls remain shared. Previously removed Expected Sale Price, normal Area and residential Rent verification are not restored.

## Storage and compatibility

New typed data is stored at `property_details.curation_details.pgDetails`. Both APIs validate it with nested DTOs. No additional entity columns or migrations are needed beyond the existing Property Curation 2 JSON migration.

The site API merges partial PG updates, preserves omitted measurements and old records, and rejects inconsistent capacity. Legacy apartment-profile values remain stored even when hidden. Older PG records may be edited without requiring an immediate complete recapture; required accommodation/capacity/area checks apply to new listings. Existing deposits remain available as a read-only website fallback until the new deposit mode is supplied.

The CRM saves and restores these fields in drafts, submits typed values, and shows them in its detail view. Public detail and search views display per-bed/per-room rent for explicitly classified new records; legacy records retain their previous monthly label. Public detail groups for the new profile show the researched PG facts rather than stale apartment inventory.

Deploy the updated site API before the CRM API/frontend so nested DTO whitelisting accepts the new fields. No production data was modified. The user subsequently authorized committing and pushing this work on the feature branch.

## Additional public evidence

- [Shared PG with capacity and room specifications](https://www.99acres.com/paying-guest-pg-for-rent-in-iyyappanthangal-chennai-west-spid-U94080224)
- [PG with included services, weekday/weekend meals and house rules](https://www.99acres.com/paying-guest-pg-for-rent-in-anna-nagar-chennai-north-r3-spid-G86551532)
- [PG results showing per-bed and private-room prices](https://www.99acres.com/paying-guest-pg-in-chennai-ffid)

The signed-in form is the primary source for implemented options. Public listing descriptions were used only to verify published meanings, not as substitutes for unobserved posting controls.

## Verification results

- CRM frontend: 63 files, 638 tests passed, including real room-type controls, dependent food fields, charge placement, furnishing counts and final save payloads.
- CRM API: 73 suites, 507 tests passed, including typed nested validation and preserving hidden negotiability on partial edits.
- Site API: 74 suites, 477 tests passed, including PG partial merges and capacity consistency.
- Website: 773 tests passed; four failures remain the previously verified unchanged-master baseline failures (wizard basic-info fixture, two ProjectGallery expectations and Step3Location City-label query).
- All four production builds passed.
- Local MySQL PG JSON round-trip passed with capacity, meal schedules, services and explicit false values. Transaction rollback restored the original data.
- A static local rendering was visually checked; monthly food and early-leaving charges were verified to appear once in their correct sections. Dynamic controls are covered by client interaction tests.

The only non-PG test expectation updated was the older plot-preview caption assertion, which still expected the superseded “layout not to scale” caption from before the user's live-shape change. Plot implementation was not changed by this task.

## Full review follow-up

Reviewed field visibility, new/legacy save paths, draft persistence, nested DTO validation, partial updates, public detail/search mappings and schema compatibility.

Three issues were fixed with regression coverage:

1. A partial API room-type change could relabel old bed capacity as private-room capacity. The site API now clears omitted incompatible counts when the unit changes, while retaining explicitly supplied replacement counts and unrelated facilities.
2. Legacy `Furnished` values were not recognized alongside `FULLY FURNISHED` and `Semi Furnished`. The PG controls, saved search boolean and both detail views now recognize the legacy value without treating `Unfurnished` as furnished.
3. Hidden furnishing drafts could block an Unfurnished save. Furnishing counts are now validated and submitted only when the selected status supports them; the unsaved draft remains intact when switching status.

No new columns, migrations, publication or production data changes were required by these fixes. These fixes are included in the PG feature changes.


## Services layout refinement

Replaced the sparse service rows with responsive service cards: three columns on desktop, two on tablet and one on mobile. Each card keeps its optional charge basis and amount together. The basis selector now has an associated label. Desktop and 390px mobile layouts were checked visually; switching a service from an extra charge to included rent is covered by a client interaction regression test.
