# Onboarding and product tour: plan

Date: 2026-11-08 · Branch: `redesign/crm-v2` · Status: draft, waiting for go

## Goal

1. A new staff member is working leads on their first day without being walked through it by someone else.
2. Existing staff find what changed in the redesign when they update, rather than by accident.

Everything is tied to role and department. A telecaller never sees the routing or user-access steps.

## What exists today

- **No onboarding at all.** There is no welcome screen, tour, checklist or help menu. `users` has no field for first-run state; `last_login_at` is the only signal.
- **Update notice** (`components/layout/app-update.tsx`). It polls `/app-version` and shows a sidebar card, then a release-notes dialog with an "Updating" screen. It renders only in the desktop sidebar, so **PWA users on phones never see an update notice.** That gap is fixed in phase 1 below.
- **Release notes** live in `lib/release.ts`. The redesign deploy needs a `2.1.0` entry.
- **Stack:** motion and Kumo (Base UI) are installed; no tour library is. Roles are Admin / Manager / Team Lead / Staff; departments are Telecalling, Sales, Sourcing and others (`lib/department.ts`).

## The four pieces

### 1. Welcome (first sign-in, about 60 seconds)

This is a short sheet: a full-screen sheet on phones, a centred dialog on desktop. It has three steps, and each one can be skipped:

1. **Hello, {name}.** One line on what the CRM does for their role.
2. **Set yourself up:** profile photo, phone number, and the light/dark theme.
3. **Stay in the loop:**
   - turn on notifications, using the existing push flow;
   - on phones, add the app to the home screen (an install prompt on Android, instructions on iOS).

It ends with "Take the tour" (primary) or "I'll explore myself".

### 2. Role tour (spotlight coach marks)

A spotlight dims the page except for one element, with a small card beside it ("2 of 6", Back / Next, Skip). Steps target elements by a `data-tour="…"` attribute, never by CSS classes. A step whose target isn't on screen is skipped, so a missing module never breaks the tour.

Each tour has a desktop variant and a phone variant (bottom nav, the floating "+", the inbox).

| Track | Steps (about 5–7 each) |
|---|---|
| Telecalling staff | Leads list and filters → take a lead from the queue → lead record (requirement, call, follow-up) → share a property → Inbox reminders → Progress tab |
| Sales staff | Leads → schedule a site visit → Scheduler → share and download PDFs → Activity "Shared" filter → Progress |
| Sourcing | Properties → add a property → validation and verification statuses → Asset inventory |
| Team Lead / Manager | Dashboard (team filter) → Lead routing → Tasks and targets → leaderboard → team progress |
| Admin | Dashboard and Lead metrics → Analytics → Users and sidebar access → Activity logs → release notes |

The tour can move between pages. The engine routes to the step's page and waits for the target before showing it.

### 3. Getting-started checklist

This is a card at the top of the Dashboard's Progress tab with 4–5 real actions for the role. Each item ticks itself from data that already exists, not from clicks inside the tour. For telecalling, the items are:

- "Log your first call"
- "Set a follow-up"
- "Share a property"
- "Clear your inbox"

The card hides once every item is done or the user dismisses it. Finishing it can unlock an achievement badge (the achievements table from migration 077).

### 4. "What's new" after an update

A release entry in `lib/release.ts` can name a short tour:

```ts
changes: [{ kind: "new", text: "…", tour: "lead-shared-filter" }]
```

After the update reloads the page, a toast says "Updated to 2.1.0 · See what's new". It opens a 2–4 step tour of only the features this user's role can see.

There is also a **"Help" entry** in the workspace menu and on the PWA More page, with three items:

- Take the tour again
- What's new
- Keyboard shortcuts (⌘K)

## How it's built

- **Own engine, no library.** About 300 lines:
  - an SVG mask spotlight with motion for the transitions;
  - a positioned card with Kumo styling;
  - focus kept inside the card; Esc skips the tour; arrow keys move between steps;
  - with reduced motion on, steps cut instead of animating.

  Libraries like driver.js or Joyride bring their own look and fight the design system.
- **Tour definitions** are plain data: `{ id, roles, departments, steps: [{ target, route?, title, body, placement, mobile? }] }`. They live in `lib/tours/*.ts` and are unit-tested to check that every target exists in the markup.
- **State is stored on the server** so it follows the user across phone and desktop.
  - New JSON column `users.onboarding`: `{ welcomed_at, tours: { [id]: { done_at | skipped_at, step } }, checklist_dismissed_at, last_seen_version }`.
  - `GET` and `PATCH /me/onboarding`.
  - Migration `078_user_onboarding.sql`. **Copy it to the server by hand before the deploy**, because CI doesn't ship migrations.
- **Admin:**
  - "Reset onboarding" on the user's page, for re-training;
  - an "Onboarded" column in Users showing the tour completion date.

## Phases

1. **Foundation:**
   - the engine, the `users.onboarding` state and the Welcome sheet;
   - the Telecalling tour on desktop and phone;
   - the Help menu;
   - the PWA update notice (missing today) and the 2.1.0 release notes.
2. **All roles:** Sales, Sourcing, Team Lead/Manager and Admin tours; the getting-started checklist.
3. **What's new:**
   - per-release mini tours and the post-update toast;
   - admin reset and the completion column.

Each phase is checked with Playwright screenshots per role, on desktop and phone, in light and dark themes. Vitest covers step filtering by role, missing targets and resume.

## Open questions

1. Should existing staff get the full tour on their first sign-in after the redesign ships, or only the "What's new" tour?
2. Should the welcome sheet collect a phone number and photo, or keep that in Settings?
3. Should the checklist unlock an achievement badge?
4. Is English only fine for tour copy, or do some teams need Tamil?
