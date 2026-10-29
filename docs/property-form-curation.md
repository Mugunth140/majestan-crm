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
