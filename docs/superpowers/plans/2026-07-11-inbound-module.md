# Inbound Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Inbound property inventory module mirroring the existing Leads/Agent workflow, complete with a flat-table backend, dynamic Next.js UI, and auto-calculated Quality Score.

**Architecture:** NestJS REST API with TypeORM on a flat `inbounds` table. Next.js App Router for frontend UI with dynamic form components.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Next.js, TailwindCSS, shadcn/ui.

## Global Constraints
- `status` default must be "New Inbound".
- Image upload max size is 5MB via existing `bun.s3` client.
- Auto-calculated Property Score (/100).
- Re-use `FormSelect`, `DateTimePicker`, `Input`, and `Textarea` components.

---

### Task 1: Backend Database Entity & Migration

**Files:**
- Create: `crm/crm-backend/src/database/entities/inbound.entity.ts`
- Create: `crm/crm-backend/src/modules/inbounds/inbounds.module.ts`
- Create: `crm/crm-backend/src/modules/inbounds/inbounds.service.ts`
- Create: `crm/crm-backend/src/modules/inbounds/inbounds.controller.ts`
- Modify: `crm/crm-backend/src/app.module.ts`
- Modify: `crm/crm-backend/src/database/data-source.ts`

**Interfaces:**
- Produces: `Inbound` TypeORM entity with all flat columns.
- Produces: REST endpoints `GET /inbounds`, `POST /inbounds`, `GET /inbounds/:id`, `PUT /inbounds/:id`.

- [ ] **Step 1: Write backend entity with auto-ID and scoring**
Create `inbound.entity.ts` with all 35+ columns. Include `@BeforeInsert()` and `@BeforeUpdate()` hooks to calculate the `quality_score` and `@BeforeInsert()` hook to generate the `property_id` (e.g., I00001).
- [ ] **Step 2: Create the NestJS Module, Service, and Controller**
Scaffold the `inbounds` REST API module. Add the `Inbound` entity to TypeORM `forFeature`.
- [ ] **Step 3: Register in App Module**
Add `InboundsModule` to `app.module.ts`. Add `Inbound` to `data-source.ts`.
- [ ] **Step 4: Commit**
Commit the backend changes.

### Task 2: Frontend Routing & Listing Page

**Files:**
- Create: `crm/crm-frontend/src/app/(dashboard)/inbound/page.tsx`

**Interfaces:**
- Consumes: `GET /inbounds` API.

- [ ] **Step 1: Create Listing Page**
Implement a data table for Inbounds (similar to Leads) displaying Property ID, Title, Status, and a color-coded Quality Score badge.
- [ ] **Step 2: Commit**
Commit listing page.

### Task 3: Frontend Add/Edit Form UI

**Files:**
- Create: `crm/crm-frontend/src/app/(dashboard)/inbound/new/page.tsx`
- Create: `crm/crm-frontend/src/app/(dashboard)/inbound/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /inbounds` and `PUT /inbounds/:id`.

- [ ] **Step 1: Build the massive form layout**
Include Basic Info, Owner Info, Contact Info, Brokerage Details, and Media. Use `FormSelect`, `Input`, `Textarea`.
- [ ] **Step 2: Implement dynamic rendering logic**
Show/hide Caretaker, Manager, Security, and Brokerage fields based on primary selections.
- [ ] **Step 3: Integrate File Upload**
Connect the existing `bun.s3` client component for `image_url` (max 5MB).
- [ ] **Step 4: Form Submission**
Hook up the form `onSubmit` to call the NestJS backend `POST/PUT /inbounds`.
- [ ] **Step 5: Commit**
Commit frontend forms.
