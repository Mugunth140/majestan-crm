# Asset Inventory (Land Bank) Module Design

## 1. Overview
The Asset Inventory module (formerly "Land Bank" in the legacy system) tracks comprehensive details about land plots and real estate assets. This includes ownership, location, financials, physical features, visit logs, and related documentation.

## 2. Architecture & Data Model (Backend)

The module follows a highly normalized structure in NestJS/TypeORM to keep tables clean and maintainable.

### Entities
*   **`Asset` (Core Entity):** Tracks base status, owner info, quality score, and approval state.
*   **`AssetLocation` (1:1 with Asset):** Stores geography (district, taluk, village, road name, site location, google pin, distance from main road).
*   **`AssetFinancials` (1:1 with Asset):** Stores commercial details (land price, DTCP price, expectation, outright vs. JV details, payment options, duration).
*   **`AssetFeature` (1:1 with Asset):** Stores physical attributes (extent, soil type, water source/depth, proximity to issues like burial ground/railway/water body, adjacent layouts, classification).
*   **`AssetVisitLog` (1:N with Asset):** Tracks multiple site visits (date, visitor, reason, outcome).
*   **`AssetDocument` (1:N with Asset):** Unified storage for attachments (FMBs, layout plans, site photos).
*   **`AssetFollowUp` (1:N with Asset):** Follow-up notes and next action dates (aligns with `LeadFollowUp` and `InboundFollowUp`).

## 3. API & Data Flow

*   **`POST /asset-inventory`**: Accepts a comprehensive JSON payload and creates the `Asset`, `AssetLocation`, `AssetFinancials`, and `AssetFeature` in a single database transaction.
*   **`GET /asset-inventory`**: Retrieves paginated assets with basic relations joined (e.g., location and financials) for list views.
*   **`GET /asset-inventory/:id`**: Retrieves a single asset with all nested relations.
*   **Sub-resource Endpoints**: Separate endpoints for adding/updating `AssetVisitLog`, `AssetDocument`, and `AssetFollowUp` to an existing asset.

## 4. User Interface (Frontend)

Built in Next.js within `src/app/(dashboard)/asset-inventory`.

*   **List View (`/asset-inventory`)**: A data table displaying core columns (ID, Location, Owner, Status, Price) with search and filtering capabilities.
*   **Creation Wizard (`/asset-inventory/new`)**: A multi-step form to handle the 40+ fields gracefully:
    *   Step 1: Basic Info & Ownership
    *   Step 2: Location Details
    *   Step 3: Land Features & Surroundings
    *   Step 4: Financials & Pricing
*   **Detail View (`/asset-inventory/[id]`)**: A comprehensive dashboard for a single asset utilizing tabs to organize Overview, Location, Features, Financials, Visits, Documents, and Follow-ups.
