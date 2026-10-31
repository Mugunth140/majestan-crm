# Property form curation

The CRM is a rebuild of an older CRM/mobile app. This first pass uses the
existing fields and general property conventions; it does not change the schema
or attempt to recreate every legacy workflow.

## Module context

- Add and edit share `crm-frontend/src/app/(dashboard)/properties/_components/PropertyForm.tsx`.
- Property types come from the CRM master registry. The form has dedicated
  sections for apartment, villa, individual portion, plot, farmland, commercial,
  coworking and industrial listings.
- The form uses Buy internally and sends Sell to the API. Rent stays Rent.
- CRM property operations go through the CRM backend adapter to the site API.
  Public visibility also depends on status and approval.
- Drafts retain unsaved values and record versions protect concurrent edits.
- The site API ignores type changes on edit. The selector is therefore disabled
  for saved listings, including when a draft is restored.

## Initial field decisions

| Type | Curated fields |
| --- | --- |
| Apartment | Bedrooms, bathrooms, BHK/unit details, flat and tower counts, carpet/built/super built areas, UDS, balconies and room dimensions. No whole plot area or available portion. |
| Villa | Home, room, parking, plot area, architectural style and outdoor details. No flat/tower inventory, super built area, UDS or available portion. |
| PG / Service Apartment | Rent only; shares the Apartment rental form fields, payload, details view and FAQ tabs. |
| Investment Property | Buy only; shares the Independent House/individual portion form fields, payload, details view and FAQ tabs. No new specialized fields yet. |
| Individual portion | Home details, floor and available portion, plot area and architectural style. No apartment inventory, super built area or UDS. |
| Plot | Project/builder, plot identifiers, size/dimensions, survey, zoning, land classification, water, boundary, fencing and topography. No soil or irrigation fields. |
| Farmland | Land size, survey/classification, topography, soil, water/irrigation, fencing, crops/plantation, borewell and tank. No project/builder or plotted development identifiers. |
| Commercial | Existing office/retail, capacity, floor, washroom, utility, parking and safety fields. No bedrooms, residential bathrooms or room dimensions. |
| Coworking | Existing workstations, cabins, meeting rooms, amenities and services. Seat pricing, minimum seats, advance rent and lease clauses appear for rentals. No home fields. |
| Industrial | Existing warehouse/factory, yard, loading, vehicle, power, clearance and worker fields. No home rooms or household furnishing section. |

Common identity, location, owner/agent permissions, description, media, documents,
connectivity, FAQs and market information remain available. The plan uploader uses Floor plans
for buildings and Ground plans for plots and farmland. The existing document
keys are retained, so uploads and older attachments remain compatible.

## Sale and rental decisions

- The primary price is labelled Sale price or Monthly rent.
- Booking amount, expected sale price, transaction/sale type, registration
  charges/timeline and building condition appear for sales.
- Security deposit, lock in period, rental agreement and residential tenant
  suitability appear for rentals. There is one deposit field.
- A legacy rental's booking amount was also labelled Security Deposit. When its
  dedicated deposit is empty, that saved amount populates the deposit selector
  as a legacy option. The original amount is retained server-side.
- Current monthly income appears separately only for tenant occupied building
  sales. Rental yield appears for building sales.
- Ownership type, handover date, payment mode (guideline/full account),
  mortgage/finance, registry details and building deviation appear only for sales.
- Maintenance remains available for buildings in either listing mode.
- Coworking appears only under Rent. Switching to Buy clears a selected
  coworking type; switching to Rent clears farmland on new listings. Existing
  types remain fixed on edit, and incompatible listing choices are disabled.
- The old PG/co-living category stays excluded. PG / Service Apartment is a
  separate rental-only category mapped to the Apartment rental form profile.
- Existing rules exclude new farmland rentals. Saved legacy farmland rentals
  remain editable; this pass does not introduce a new commercial policy.

## Preservation and implementation

`property-form-fields.ts` holds the shared field rules for rendering, amount
validation and payload filtering. Switching selections keeps hidden values in
memory and in drafts; switching back restores them. Hidden values are omitted
from the current request.

The site API replaces its property-details row during PATCH. The CRM adapter
therefore merges existing mapped details with explicit incoming changes before
forwarding the request. This preserves imported values that are no longer
shown. Submitted changes, including false and zero, take precedence. No cleanup
migration deletes old fields.

Future business-specific adjustments should update the shared field rules and
rendered-form/adapter regression tests together.

## Dropdown labels

The property form uses a local select wrapper that capitalizes uppercase master
labels and legacy values. Stored values remain exactly as supplied by the master
registry. Technical abbreviations (GST, CMDA, DTCP, BHK, etc.), numeric codes and
mixed-case names are preserved. Other CRM forms are unaffected.

## Commercial and industrial specifications and pricing

Commercial and industrial listings omit residential bedrooms and bathrooms in
both the form and details view. Industrial listings also omit furnished status
and furnishing selections. Security deposit and lock in period appear only for
Rent; Buy views hide them even when old records have saved values.

For commercial and industrial Buy listings, Sqft Price replaces the Expected
Sale Price input. It is a separate optional rupee-per-square-foot rate stored in
`price_per_sqft`, not a relabelled total amount. Existing total sale prices stay
stored as before. Rental pricing continues to use the monthly rent fields.

## Deployment

The shared site backend applies its registered property type and pricing
migrations during production startup before serving requests. Deploy the shared
backend before this CRM version.

Tracked SQL copies are included in `crm-backend/migrations/054_*`, `055_*` and
`056_*`, following the existing inbound migration packaging convention. For an
infra-managed deployment, copy them to `infra/migrations/` and run
`docker compose run --rm --no-deps db-migrate` from `infra/`. The site migrations
check for existing enum values/columns so either migration channel can run first.
The SQL migrations also seed the CRM master registry; apply them before using
the new categories in CRM. They have already been applied locally.

## Rental refinements

Rent options exclude Farm House (including aliases and master labels) as well as
Farmland and Investment Property. Rentals hide RERA; Builder Name and Project
Name appear only for Apartment and Villa rentals. Hidden saved values remain
stored, including RERA when a partial rental save omits it.

All rental types except Coworking show a read-only Rent per sqft value derived
from the current monthly rent and Area. Square metres, acres and cents are
converted to square feet before division. Missing/invalid rent, area or unknown
legacy units leave the rate empty. The rate is recalculated from saved inputs
on the details page rather than persisted as a second potentially stale amount.
Coworking retains its existing Rent per Seat field.

## Specification and verification refinement

- Common specifications are embedded in each type's details card. Room
  dimensions and floor plans share a single section. Alternate contact name,
  phone and email appear under Owner with existing contact permissions.
- All area inputs offer sqft, sqm, cents and acres. Named measurements are saved
  as canonical sqft (plot size remains canonical cents) with their chosen units
  in `measurement_units`; changing units converts the value. The searchable
  base area is derived from built-up area where its standalone input is hidden.
- Tenant Occupied appears only on rentals. Commercial and industrial omit the
  furnishing items section; their existing selections are preserved on edits.
- Apartment rentals omit possession status, super built-up area and general
  Area; they add numeric lift and parking counts. PG / Service Apartment
  inherits that Apartment rental specification profile.
- Villa omits general Area and Expected Sale Price. Its automatic rate uses
  sale price divided by built-up area, as confirmed, while plot area has a
  separate unit selector and facing. Includes ground floor is stored separately
  from Total Floors.
- Independent House (and its Investment Property profile) adds No of Portions.
- Commercial adds plot, built-up, carpet and UDS measurements, omits Floors
  Occupied, labels floor number Available Floor Number, and labels sale income
  Expected Monthly Rent.
- Approvals is a multiselect with CMDA, LPA, DTCP, Corporation Approved and
  Village Panchayat; legacy approvals remain selectable. Ownership verification
  uses N/A, Yes and No; availability fields use Available and Not Available.
  Finance uses the existing price-in-words input; Funded By is visible alongside
  Finance with Bank, NDFC and Local finance options.

Migration `058_property_specification_refinements.sql` adds nullable detail
columns for measurement units, plot facing, ground floor, portions and funding
source. It is tracked in CRM, applied locally through infra and registered in
site startup migrations for deployment. No existing records are deleted.

## Industrial, Plot, Farmland and Farm House refinements

- Industrial includes Plot Area, Built Up Area and Carpet Area. Building Type,
  Floor Type, Container Access and pollution category use the specified option
  lists. Property Use and Building Approval Certificates allow multiple choices.
  Their existing string columns are widened to TEXT; old selections remain
  available. Labor room and toilet counts are numeric. Available Visit Time and
  Blueprint / Layout are omitted from both forms and details.
- Plot hides open sides, topography and fencing, labels Plot Nos as No of Plots,
  and labels its main area Total Project Area. Zoning offers Industrial Plot,
  Commercial Plot and Residential Plot. Amenities are enabled for Plot.
- Plot replaces length/width controls with four direction/length/unit rows.
  Direction choices include all eight compass directions; lengths use feet or
  metres. The live SVG sketch is explicitly not to scale. Saved old rectangular
  dimensions restore into four sides; no area is inferred from side lengths.
- Plot sale rates can be entered and displayed per sqft, sqm, cent, acre or
  ground. The chosen unit is retained in measurement metadata; the rate is
  stored canonically per sqft with increased decimal precision to preserve
  conversion accuracy. The total asking price is independent.
- Grounds use 2,400 sqft, consistent with the [Greater Chennai Corporation's
  tax assessment conversion](https://chennaicorporation.gov.in/gcc/online-services/property-tax/tax-assessment/).
- Farmland omits Plot Size and Zoning. Crop Suitability and Existing Plantation
  use the requested lists. No of Borewells appears only while Bore Well is
  checked.
- Farm House is a separate Buy-only category combining the current Farmland
  agricultural controls with the Independent House profile. Independent House
  and its Investment Property profile also expose the sale rate per sqft.
- Furnishing Items is shown and submitted only when Furnishing Status is Fully
  Furnished or Semi Furnished, for applicable residential/coworking types.
  Commercial and Industrial never expose this section. Hidden saved selections
  are retained rather than deleted.

Migration 059 seeds Farm House, adds boundary/container/count fields, widens the
multiselect storage, and increases rate precision. Its tracked CRM SQL copy and
registered site startup migration support deployment; it is applied locally.

## Commercial Rent and Co-Working refinement

Commercial rental Property Use is a single select with the specified sixteen
uses. Special Purpose is a separate fifteen-choice select stored in
`property_details.special_purpose`, and Property Accessibility uses the existing
accessibility field with On Road, Cut Road and Inside Colony choices. The CRM
Special Purpose search checks the new field and the legacy Property Use field.

For Commercial rentals, conference hall, cabin and seater counts appear and are
submitted only with Fully Furnished or Semi Furnished status. Construction Date
and Documents Required are hidden and omitted. These restrictions do not alter
the Commercial Buy form.

Co-Working hides Documents & Verification and general document uploads. It also
omits general Area, Open Sides, possession status, handover and Available From
(the possession/move-in date). Named built-up/carpet measurements, floor plans,
listing status and rent per seat remain available. Ordinary edits omit document
updates entirely; when plans change, existing non-plan attachments are retained.
Hidden verification fields and office counts are preserved in stored records.

Migration 060 adds the nullable Special Purpose field. Its CRM SQL copy is
tracked, it is registered in site startup migrations, and it is applied locally.
