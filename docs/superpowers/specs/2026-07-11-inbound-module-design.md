# Inbound Module Design Spec
## Overview
The Inbound module manages property inventory listings. It mimics the UI/UX of the Leads and Agent Network modules.

## Architecture
- **Database:** PostgreSQL (via TypeORM).
- **Backend:** NestJS.
- **Frontend:** Next.js (App Router), TailwindCSS, shadcn/ui.

## Database Schema (Inbound Entity)
A flat table (`inbounds`) containing all fields:
- `property_id` (Auto-generated prefix e.g., `I00001`)
- `property_category`, `property_type`, `purpose`, `property_title`
- `state`, `city`, `area`, `locality`, `landmark`, `google_map_location`
- `status` (Default: "New Inbound")
- **Owner Info:** `owner_name`, `mobile_number`, `whatsapp_number`, `email`, `address`, `preferred_contact_time`, `alternate_contact`, `pan_available`, `gst_applicable`
- **Contact Info:** `primary_contact`, `building_manager_name`, `manager_mobile`, `caretaker_name`, `caretaker_mobile`, `security_contact`, `key_available_with`, `prior_appointment_required`
- **Brokerage:** `brokerage_accepted`, `brokerage_paid_by` (array), `brokerage_type`, `percentage`, `fixed_amount`, `rental_brokerage`, `brokerage_remarks`
- **Media/Inventory:** `image_url` (R2/S3 - max 5MB), `video_url`, `documents_collected`, `is_exclusive`, `is_prime_location`
- **Platforms:** `listed_on` (array of strings)
- **Score:** `quality_score` (0-100)

## Quality Score Engine
Auto-calculated based on:
- Owner Direct / Primary Contact is Owner (+20)
- Exclusive Listing (+20)
- Complete Documents / Documents Collected (+15)
- Photos Uploaded (+10)
- Video Uploaded (+10)
- Verified Status (+10)
- Brokerage Confirmed / Accepted (+10)
- Prime Location (+5)

## UI Workflows
- **Dynamic Fields:** Caretaker/Manager inputs only show when selected as primary contact. Brokerage amounts only show if Brokerage is accepted.
- **Form Component:** Re-uses `FormSelect`, `DateTimePicker`, `Input`, and `Textarea`. Uses `bun.s3` client for image upload.

