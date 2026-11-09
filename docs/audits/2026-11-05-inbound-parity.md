# Inbound module parity audit — 5 November 2026

## Scope and evidence

Reference: production `crm.prismark.in` Inbound screens, inspected read-only, and the repository `master` version of the old UI. Target: local `localhost:4000`, current `redesign/crm-v2` working tree. Production records were not created or modified. The working tree already contained an uncommitted change to `crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx`; this audit describes that working-tree behavior, not necessarily the committed version. Do not discard that change without checking its owner.

Created local-only record I00017, `AUDIT TEST - Commercial Shop`, with a commercial shop/rent, Gym, Coimbatore/Peelamedu, coordinates, rental and floor pricing, owner, alternate and visit/key contacts, brokerage, and flags. Created and edited one local follow-up. The record remains available at http://localhost:4000/inbound/17. No external communications were sent. A temporary invalid email and a blank title were saved during validation checks, then restored. Other existing local records were not edited.

## Findings to fix

### 1. Existing record edits bypass creation validation — reproduced

On I00017, Data → Email: enter `invalid-email` and blur. The interface reports `Saved`; the create form rejects that format. Data → Title: clear the title and blur. It reports `Saved`, even though title is required on the full create form and the old edit form. The backend update DTO is a partial create DTO and optional validators accept null; the email DTO only checks string type. Check the other required and formatted fields (owner name, mobile, state, city, locality, access choices, brokerage accepted, numeric and coordinate constraints) for consistent create/edit behavior, while accommodating intentionally incomplete quick-capture records.

Relevant: `crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx` (`saveText`, contact fields and inline fields); `crm-frontend/src/lib/inbound-form.ts` (`checkInbound`); `crm-frontend/src/components/record/inline-field.tsx` (blur saves without native form submission); `crm-backend/src/modules/inbounds/dto/update-inbound.dto.ts` and `create-inbound.dto.ts`.

### 2. Follow-up edit loses controls present in old CRM — reproduced

Open I00017 → Conversation → the follow-up's actions → Edit. The redesigned dialog exposes notes, next follow-up, and priority. Old `FollowUpPanel` also exposes the original follow-up date/time, contacted-via, and RNR status. These values are retained in the outgoing edit request but cannot be corrected in the new dialog. Restore equivalent editing and verify save/reload, including clearing values and permission behavior. Relevant: `crm-frontend/src/components/record/conversation.tsx` (`EditFollowUpDialog`); old reference `master:crm-frontend/src/components/shared/follow-up-panel.tsx`.

### 3. Call actions absent — inspected UI and source

Old Inbound detail provides call actions for owner, primary contact, and key holder. The redesigned Data tab contains editable contact fields and Conversation has follow-up/email/WhatsApp/SMS composers, but no equivalent call action. A Call option in the follow-up composer logs a follow-up and is not the old contact action. Restore the appropriate call/contact logging flow, respecting contact visibility and permissions. Relevant: `crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx`, `crm-frontend/src/components/record/conversation.tsx`; old detail `master:crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx`.

### 4. Legacy map coordinates are hidden and may remain stale — source-confirmed for current working tree

The old edit form derives coordinates from `google_map_location` using `readStoredCoordinates` and clears the legacy value when coordinates change. The current local detail page reads only latitude/longitude for display and only saves the changed coordinate, leaving a legacy map value untouched. A record whose only location is a legacy link therefore has no map shown, and editing a coordinate can leave conflicting old location data. The existing uncommitted diff specifically removes fallback/cleanup logic from this page; establish intent before editing. Test a legacy-link-only record, one coordinate update, clearing, and reload. Relevant: `crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx` (`hasMap`, `saveCoordinate`), `crm-frontend/src/lib/image-coordinates.ts`, and old form in `master:crm-frontend/src/app/(dashboard)/inbound/new/page.tsx`.

### 5. Some existing stored values can be hidden — source-confirmed risk

Old detail displays a non-null sale price regardless of category/purpose, and a stored floor number whenever present. New Pricing renders sale price only for residential Sale and floor only for listed applicable types. If legacy or previously changed records contain these values outside those conditions, users cannot see them. Likewise, verify that category-dependent BHK and special-purpose data remain inspectable after category changes. This does not establish how many production records are affected. Relevant: `crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx` (`pricing`, Property card); compare old detail in `master`.

## Field and workflow inventory

- List: All Inbound, Queue, Action Required, Closed; search, date/status/category/type and staff filters; assignment and bulk selection; columns ID, category/type, mobile, uploader, assignee, address, inbound status, status. The redesigned list exposes the corresponding controls. Search/filter correctness for every combination and role was not exercised.
- Full create: title, category, type, purpose, status, inbound status; conditional residential BHK and commercial special purposes; state, city, locality, area, landmark, coordinates; conditional rent, sale price, advance, rent/sq ft, floor and commercial floor rows; owner name/mobile/WhatsApp/email, alternate number, other contact, preferred time, address, PAN/GST; primary contact and conditional contact name/number, key holder and conditional name/number, appointment; brokerage acceptance, payer, type and amount/percentage/days/remarks; photo and three flags. Options and conditional rules were compared with the old form source. Full-form required checks cover title/category/type/purpose/status, state/city/locality, owner/mobile, primary contact/key holder, brokerage; email and coordinate checks are in `checkInbound`.
- Mobile quick capture: source comparison shows category, type, mobile, inbound status, alternate/other contact, photo and background location capture are present. Not exercised on a phone viewport or with device GPS/camera.
- Saved detail: for I00017, property/category/type/purpose, location, coordinates and map link, owner and access fields, brokerage/flags, rent/advance/floor and the floor-row values displayed after save; the data page remained populated after reload. The test selected Gym and Owner/Tenant payer, but the collapsed controls were not independently reopened after reload to verify those selections. Photo, preferred time and availability were left empty.
- Follow-up: local Call/RNR follow-up was created and its notes edited; conversation displayed it and the update succeeded. RNR selection replaced the drafted notes with the generated RNR text; the old form contains similar behavior. Date, priority, delete, history permissions and reload persistence were not comprehensively exercised.
- Old emails/contact actions have corresponding Conversation areas for email, SMS and WhatsApp. Actual sending, external apps, contact logs, attachment/photo upload, status/assignment transitions, deletion, and role restrictions were not exercised. A generated local email draft was visible but not sent.

## Validation and follow-up checks for the fixing model

1. Add focused regression tests for full and quick creation, inline edits, invalid email/mobile/coordinate/number values, required-field clearing, legacy maps, and preservation of populated fields when changing dependent selections.
2. Exercise all category/type and Sale/Rent/Lease branches, BHK/special-purpose options, all brokerage types, primary/key contact combinations, multiple floor rows, photo replacement and failed upload, and create/edit/reload on local records.
3. Check roles and permissions, queue/assignment, filters, status changes, follow-up create/edit/delete and contact/email flows with safe local fixtures. Do not test writes against production.
4. Compare legacy display records including unknown category/type, non-residential sale price, old map links and incomplete quick captures. Confirm data is not hidden or silently overwritten.

Executed `npm test -- --run src/lib/inbound-form.test.ts src/lib/inbound-queue.test.ts src/lib/inbound-action-required.test.ts src/lib/inbound-location-queue.test.ts`: 4 files, 35 tests passed. These tests do not establish complete UI or API parity. This report intentionally distinguishes verified failures from source-inferred risks and identifies untested branches; it is not a claim that every possible data combination or role has been tested.
