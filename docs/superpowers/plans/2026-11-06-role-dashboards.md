# Role-based Dashboard: plan

Status: plan only, nothing implemented. Written 2026-11-06 against `redesign/crm-v2`. The decisions in §9 override earlier sections where they differ.

## 1. Goal

One Dashboard page whose content depends on who is looking at it and who they selected:

| Viewer | Opens on | Can pick |
| --- | --- | --- |
| Admin | Whole business | Everyone, any department, any person |
| Manager | Whole business, plus a **My work** tab | Same as Admin. Delete actions stay Admin-only |
| Team Lead | Their department | Their department, any person in it, themselves |
| Staff | Their own progress, gamified | Nobody else |

The dashboard should show **where the business is falling behind and where it's doing well**, not just counts. Every warning links to the records behind it.

Top bar (desktop `PageActions` and the mobile header):

- **Subject picker**: one searchable select, grouped. *Everyone*, then *Departments* (for example "Sales — all"), then *People* grouped by department, each showing their role and photo. Team Leads see only their department. Staff don't get the picker.
- **Range**: Today · 7 days · 30 days · 6 months, plus *This month*, because targets are monthly. Every number is compared with the previous period of the same length.
- The subject and range are kept in the URL (`?subject=user:42&range=30d`), so a link opens the same view.
- All day boundaries use Asia/Kolkata time.
- Chart buckets depend on the range: hourly for Today, daily for 7 and 30 days, weekly for 6 months.

## 2. What exists today

### Tasks (targets)

- `task_templates` holds one template per person per month. `task_metric_targets` holds a monthly target per metric, split into four weeks (days 1–7, 8–14, 15–21, 22–end). `task_metric_progress` holds the achieved count per week.
- The metric sets are hard-coded per department in `DEPARTMENT_METRICS` (`tasks.service.ts`): telecalling, sales, collection, designing, digital and hr. Auto-tracked metrics are updated from lead status changes (`LEAD_STATUS_METRIC_MAP`). Everything else is entered by hand through `/tasks/:id/log`.

**Problems the dashboard depends on. Fix these first (Phase 0):**

1. **Sourcing has no metric set.** `createTaskTemplate` throws "No metrics defined" for the Sourcing Department, so sourcing staff can't be given tasks at all.
2. **"Call Count" doesn't count calls.** It goes up when a lead's status is set to Contacted or RNR, not from the call logger (`contact_logs`). It drifts from the real call count in both directions.
3. **Credit goes to the lead's owner, not the person who did the work.** `autoIncrementFromLeadStatus` credits `lead.assigned_staff_id`. When a Team Lead or Manager updates a lead, the owner gets the credit.
4. **Double counting.** The increment runs on every status save, even when the status didn't change. There's no `previousStatus` check, although the event emitter just below it has one. Reopening a lead and moving it forward also counts again.
5. **Month and week use the server clock**, through `new Date()` in `getCurrentMonth` and `getWeeksInMonth`, not India time. Near midnight on the 1st, work can land in the wrong month.
6. Manual logs always go into the *current* week, even when the template is for an earlier month.
7. **No daily targets.** There's no daily target, and tasks can only be created for the current month, so next month can't be planned ahead.
8. Sales `sourcing`, `validation` and `verification` are triggered by unrelated statuses (lead creation, Qualified, Property Shared). Their meaning needs confirming.

### Dashboard

- **Committed:** `CoachingDashboard` with a staff picker and 7/30/90 days. It reads from the DuckDB mirror (`AnalyticsStoreService`, re-synced from MySQL every 60 s), with scopes organization / department / self. It covers open leads, overdue/due/unscheduled, untouched leads, 3+ RNR, activity by channel, visit and win events, and monthly target progress. The older `AdminDashboard`, `TeamLeadDashboard` and `StaffDashboard` (rings, badges, calendar) are rendered below it as "legacy".
- **Uncommitted, in the working tree:**
  - `BusinessDashboard.tsx`, `SalesRecords`, `WeeklyIncentives` and `ReportingCharts`.
  - Backend `dashboard.service.ts` (825 lines) and `dashboard.controller.ts`: visits, bookings, brokerage, monthly and weekly incentives, call outcomes.
  - Migrations `071–074_dashboard_*.sql` in `infra/migrations`.
  - `app/(dashboard)/page.tsx` has been reduced to `return null`, and `BusinessDashboard` isn't mounted anywhere. **The Dashboard is blank in this working tree.**
  - **Migration number clash:** `crm-backend/migrations` already has different 071–073 files (staff activity indexes, follow-up reminders, nav access).

### Data we can measure from (all mirrored to DuckDB)

| Source | What it gives |
| --- | --- |
| `contact_logs` + agent/inbound/asset/hr contact logs | Calls (call logger: direction, duration, `source_call_id`), WhatsApp, email and SMS, per actor (`sent_by_id`) |
| `lead_follow_ups` | Follow-ups per actor: outcome, RNR, next follow-up date, completed |
| `lead_events` | Status changes with actor and from/to, so stage history can be rebuilt |
| `routing_histories` | Assignments and transfers (telecalling → sales handoff), so time from assignment to first touch can be measured |
| `leads` | Owner, department, source, `rnr_consecutive_count`, `drop_reason`, conversions |
| `lead_inquiries` + matching | Requirements and how many listings match them, so unmet demand can be shown |
| `inbounds` | Sourcing: `uploaded_by_id`, availability/verification state, lat/lng, `quality_score`, `documents_collected` |
| `record_events` | Inbound, agent and HR record history with actor |
| `hr_candidates` | Hiring pipeline (New → Shortlisted → Interview → Selected → Offer → Joined/Rejected/Hold) |
| `properties.uploaded_by_crm_user_id` | Listings uploaded by each person |
| `logger_devices` / `users.device_last_sync_at` | Whether each person's call logger is actually reporting |
| Site analytics module | Website traffic and conversions (Digital) |

**Not captured today:** attendance or check-in, post-sale registration and document stages, ad spend, and who created ads, banners or blog posts (`ads` and `showcases` have no creator column).

## 3. How metrics are defined

The same rules apply to every view, so numbers match from one screen to the next:

- **Activity** is credited to the person who did it (`sent_by_id`, `created_by_id`, `actor_id`).
- **Portfolio** (open leads, overdue) is credited to the current owner.
- **Outcomes** (site visit, booking) are credited to the actor of the status event, and each lead counts at most once per stage per period.
- Each figure is shown next to its previous-period value and, where it applies, the **department median**. A person is compared with their own team, never across roles.
- If a person's logger hasn't synced within the range, their call metrics are greyed out and marked "logger offline". The system can't tell "didn't call" apart from "phone wasn't reporting".
- No combined cross-role score (this follows `docs/dashboard-coaching.md`).

### Core metrics for everyone who works leads

| Metric | Definition | What it reveals |
| --- | --- | --- |
| Speed to first touch | Assignment (`routing_histories`) → first call, message or follow-up by the new owner. Median and p90, with sample size | Leads left waiting |
| Touch frequency | Average days between consecutive owner touches on open leads | How often a lead hears from us |
| Attention gap | Open leads grouped by days since last touch: 0–1, 2–3, 4–7, 8–14, 15+ | Leads going cold |
| Coverage | Open leads touched in the period ÷ open leads | Portfolio neglect |
| Calls per working day | Logger calls ÷ working days in range | Effort |
| Connect rate | Outbound calls with duration over 0 s ÷ outbound calls | Calling quality or timing |
| Talk time | Total and average connected duration | Depth of conversations |
| Work window | First and last call of each day, and gaps over 60 minutes during working hours | Late starts and idle stretches |
| Calling heatmap | Calls and connects by weekday × hour | Best and worst times to call |
| Follow-up discipline | % of follow-ups done on or before their due date; overdue; no next step | Missed promises |
| Logging compliance | Connected calls followed by a status or follow-up update within 2 h | CRM hygiene |
| RNR load | Leads with 3 or more consecutive RNRs | Wasted dialing; try another channel or time |
| Stage aging | Days in current stage; leads stuck beyond a per-stage limit | Pipeline blockages |
| Workload | Open leads per person compared with the department median | Imbalanced routing |

## 4. Department metric sets

Each department gets a tab or section with its own funnel and checks. These also become its task metrics (§7).

**Telecalling** (lead → site visit handoff)
- Funnel by cohort of leads assigned in the range: assigned → contacted → qualified/interested → SV scheduled → SV done (handed to Sales). Stage-to-stage conversion, compared with the previous period and the department median.
- Rejection mix (Not Interested, Dropped, Lost, Unqualified) by `drop_reason` and by source.
- Calls per SV scheduled (efficiency). SV no-show rate (scheduled but not completed by the scheduled date).
- Speed to first touch on fresh leads; connect rate; RNR load.

**Sales** (site visit → booking)
- Funnel: SV done → revisit scheduled/done → negotiation → booking advance → agreement → closed won, plus drop rate at each stage.
- Visit-to-booking rate, median days from SV to booking, negotiations stuck over 14 days.
- Properties shared per lead (conversations) and requirements left with zero matches.
- Booking value and brokerage, from the post-sale tracker (§9 decision 5).

**Finance / CRM / Collection** (after the sale)
- *Today:* only manual task metrics plus receipts uploaded.
- *Needed:* a post-sale tracker per booking: registration date, document checklist, commission invoice → received, dues aging (0–30, 31–60, 60+ days). This is the post-sale tracker from §9 decision 5.
- Metrics: booking → registration days; documents pending; brokerage outstanding and its aging; collected vs due; collection calls (from `agent_contact_logs` / `contact_logs`).

**Sourcing / Inbound**
- *Field staff (PWA):* inbounds added per day, quality score, % with photos/documents/location, localities covered (map from lat/lng), duplicates and not-available rate.
- *Office verification staff:* Verification Queue throughput (`fixed_verification` → `verification_done`), time to verify, verification calls (`inbound_contact_logs`), share verified on the first call.
- **Business link:** requirements from leads with no matching inventory, grouped by locality, BHK and budget. This tells sourcing where to look next.

**HR**
- Candidate funnel (New → Shortlisted → Interview scheduled/completed → Selected → Offer → Joined), conversion by source (`hr_sources`), time to hire, offer acceptance rate, interview no-shows, calls and follow-ups (`hr_contact_logs`, `hr_follow_ups`).
- Company-level insight for Admin: headcount per department compared with workload, for example "Telecalling has 340 open leads per person against 180 last quarter".

**Digital** (no fixed tasks)
- Leads by source and their quality: qualified %, SV %, booking % for each source (website, 99acres, ads, referral). This shows which channels bring buyers and which bring noise.
- Website traffic and enquiry conversion from the existing site-analytics module.
- Cost per lead and cost per SV only if ad spend is entered (not decided yet, §9 decision 8).

**Design**
- Today: manual counts (posters, reels, videos).
- Proposed: add `created_by` to ads, showcases and blog posts so published output is counted automatically. Optionally also add a simple request → delivered turnaround.

## 5. The views

### 5.1 Staff: "My progress" (gamified)

- **Today hero:** one ring per auto-tracked target metric for *today*. The daily goal is calculated from pace: (remaining weekly target ÷ remaining working days). Falling behind raises tomorrow's goal, and the reason is shown.
- **Pace strip:** week and month progress for each target, marked ahead / on pace / behind, with a forecast ("at this rate: 82% of the monthly SV target").
- **My queue:** overdue, due today, leads with no next step, and leads going cold. These are the existing coaching queue items, restricted to the person.
- **Streaks:** consecutive working days with the daily call goal met; days with zero overdue follow-ups.
- **Achievements**, each unlocked once per period, stored server-side and shown with confetti the first time:
  - Daily goal met, weekly target met, monthly target met
  - First SV or booking of the month
  - Personal best day (calls, SVs)
  - Fast responder (median first touch under 15 minutes this week)
  - Clean sheet (a week with zero overdue)
  - Comeback (behind on Monday, on pace by Friday)
- **Leaderboard:** the full department, with names, ranked per metric (calls, SVs, bookings and so on), with a metric switcher. The person's own row is highlighted, along with how far they are from the next place ("6 SVs from 2nd"). No other departments, and no combined score.
- **Personal trends:** this period vs last, a calling heatmap, and the connect-rate trend.
- **Confetti:** `canvas-confetti` (about 6 KB), fired when the server returns a newly unlocked achievement, with `disableForReducedMotion`. Never fired on page load alone, so it doesn't replay.

### 5.2 Team Lead: "My department"

- **Department pulse:** target pace for each metric, the department funnel, coverage, speed to first touch, and overdue. Each is compared with the previous period.
- **Roster grid:** one row per person, one cell per key metric, coloured by pace against target and against the department median, with a sparkline per person. Sortable.
- **Who's slowing down:** a person is flagged when any of these is true, each with its reason:
  - Activity down more than 25% compared with their own previous period
  - No logged activity for 2 or more working hours today
  - Overdue rising 3 days in a row
  - Behind pace on 2 or more targets
  - Logger offline
- **Who's doing well:** top movers, targets already met, and fastest responders.
- **Team queue:** the department's overdue and going-cold leads with their owner. This is where leads are reassigned and workload is rebalanced (with a suggested lighter owner).
- **My own work:** the Team Lead's own tasks and activity, shown as a tab.

### 5.3 Manager

Same as the Admin business view (§5.4). Managers also get a **My work** tab with their own tasks, calls, assigned follow-ups and personal metrics, so a manager who calls or holds tasks is measured like everyone else. Admin-only delete and approval actions are hidden.

### 5.4 Admin: business view (main focus)

Sections in reading order:

1. **Shining / falling behind:** 4–8 automatically generated insight cards (see §6), each one sentence with a number, a comparison and a link. For example:
   - "Site visit → booking fell from 18% to 11% (30 d) — Sales, mostly Negotiation drops."
   - "41% of new leads waited more than 2 h for a first call."
   - "Website leads reach SV at 3× the rate of 99acres."
2. **Revenue and outcomes:** bookings, booking value, brokerage earned/invoiced/received/outstanding. Taken from the post-sale tracker; until Phase 4 ships, closed-won counts are shown instead.
3. **End-to-end funnel:** lead → contacted → qualified → SV scheduled → SV done → negotiation → booking → registered → commission received. Shows where leads are lost, the stage-to-stage change against the previous period, and the department that owns each stage.
4. **Speed and discipline:** speed to first touch, attention gap distribution, coverage, overdue trend, logging compliance.
5. **Departments side by side:** target pace for each department, workload per person, and activity trend.
6. **People:** a sortable table of everyone (filtered by department), with flags from §5.2. Clicking a row opens the person view (§5.5).
7. **Supply and demand:** unmet requirements by locality and BHK compared with inventory added and verified (sourcing).
8. **Lead sources:** volume compared with quality per source (Digital).
9. **Data health:** loggers offline, calls not matched to any record, leads with no owner, and stale mirror sync. A dashboard is only as good as its data, so this belongs on screen.

### 5.5 Person view (Admin, Manager or Team Lead picks a person)

This is how a weak spot gets pinpointed:

- **Header:** photo, role, department, logger status, and target pace for each metric.
- **Strengths and weak spots:** every metric from §3 and §4, ranked by how far the person is above or below the department median (percentile). Top 3 are shown green and bottom 3 amber/red, each with its value, the median, and the change over the period.
- **Their funnel compared with the department funnel,** with the biggest gap highlighted.
- **Diagnosis hints,** rule-based, plain language:

| Pattern | Likely issue | Suggested action |
| --- | --- | --- |
| High calls, low connect rate | Calling at bad hours or bad numbers | Check heatmap; shift calling window |
| Good connects, low qualification / SV | Pitch or qualification problem | Call review, script coaching |
| Many SVs, few bookings (Sales) | Closing / negotiation weakness | Pair with a top closer |
| High overdue, low coverage | Overloaded or poor follow-up discipline | Compare workload to median; rebalance or coach |
| Slow first touch | Not working fresh leads first | Queue discipline |
| Calls but no CRM updates | Logging compliance | Enforce disposition after call |
| Low activity + logger offline | Data gap, not necessarily idleness | Fix device first |

- **Day timeline:** for Today or a picked day, calls, follow-ups and status changes plotted across the day, with gaps.
- **Their queue and untouched leads,** with links.

## 6. Insight engine

A backend function runs over the same metric set and produces ranked insight cards. Each card has a type, severity, sentence, metric, current value, comparison value, and a link.

- **Comparisons:** against the previous equal period; against the department median (for people); against target pace.
- **Thresholds:** a card is shown only when the change is at least 20% *and* the sample is large enough (for example 20 or more leads). Small numbers produce noise.
- **Types:**
  - Funnel stage drop/rise
  - Speed/coverage regression
  - Source quality gap
  - Workload imbalance
  - Target at risk (forecast below 80%)
  - Person outlier
  - Data gap
- The rules are plain TypeScript, unit tested with fixtures, with no ML. Each card states its numbers so it can be verified.

## 7. Data and backend changes

**Tasks (Phase 0)**
- Add a `sourcing` metric set (field: inbounds added, verified, documents collected; office: verifications done, verification calls). Add `finance`/`crm` as aliases of collection, or rename once the department name is confirmed.
- Replace status-driven increments with a **`task_metric_events`** table: `user_id, metric_key, occurred_at, source_type, source_id, UNIQUE(metric_key, source_type, source_id)`. Progress becomes a sum over events. This gives deduplication (the unique key), credit to the actor, any time bucket (day/week/month) and daily targets at no extra cost. `task_metric_progress` stays for manual entries, or manual entries become events too.
- `call_count` comes from logger calls (`contact_logs` with `source_call_id`).
- Compute month and week in Asia/Kolkata. Allow creating the next month's template. Add an optional `daily_target` override per metric; otherwise derive it from pace.
- Backfill events from `lead_events` and `contact_logs` for the current month so progress stays continuous.

**New tables**
- `staff_achievements (user_id, key, period, unlocked_at, seen_at)`, so confetti fires once on every device.
- `working_calendar`: working days and holidays, used for per-day pace and gap detection. Can start as a config constant.
- Post-sale tracker: `bookings` (lead, owner, unit, value, brokerage, booked_at, registration_date, status) plus `booking_documents` (checklist) and `booking_payments` (commission invoiced/received/refund). Migrations go in `crm-backend/migrations/` from 074 on, and get copied to the server before deploy.
- `channel_spend` only if ad spend is decided (decision 8).
- `created_by` on ads, showcases and blog posts.

**API** (`metrics` module, served from the DuckDB mirror; "Today" may read MySQL directly if 60 s of staleness is too much):
- `GET /api/v1/dashboard?subject=all|dept:ID|user:ID&range=today|7d|30d|month|6m` returns `{ scope, subject, range, previous, kpis, funnel, trends, people?, queue, insights, targets, achievements?, dataHealth }`. Scope is checked server-side exactly as `CoachingService.people()` does today.
- `GET /api/v1/dashboard/subjects` returns the grouped picker options for this viewer.
- `POST /api/v1/dashboard/achievements/seen`.
- Cached with `CacheService` (60 s), keyed by viewer, subject and range. The existing endpoints `coaching`, `summary`, `charts` and `tasks/dashboard` are retired once the new page replaces them.

**Frontend** (`components/dashboard/`):
- `DashboardPage` uses `useDashboardQuery` (URL state) and `DashboardTopBar` (subject picker + range).
- It then chooses by scope and subject:
  - `BusinessView` for Admin and Manager
  - `DepartmentView` for Team Leads, or for any department subject
  - `PersonView` when someone selects a person
  - `MyProgressView` for Staff, or for "me"
- Shared pieces: `InsightCard`, `FunnelChart`, `PaceBar`, `RosterGrid`, `StrengthWeakness`, `Heatmap`, `Achievements` (with confetti).
- Charts reuse the existing hand-built SVG with `d3-scale`; no chart library is added.
- Mobile keeps the module launcher below the dashboard.

## 8. Phases

| Phase | Scope | Done when |
| --- | --- | --- |
| 0. Foundations | Back up and revert the uncommitted dashboard work (decision 1); fix task tracking (§2 problems 1–7) with `task_metric_events` and backfill; Sourcing metrics; IST time; working calendar | Task progress matches logged calls and status events for a sample of staff; tests pass |
| 1. Shell + Staff view | Top bar, `/dashboard` API skeleton, scoping, `MyProgressView` with daily pace, streaks, achievements, confetti | A staff member sees their own day; confetti fires once per unlock |
| 2. Team Lead view | Roster grid, slowing-down/doing-well flags, team queue, rebalance links | A Team Lead can find their weakest person and why in under a minute |
| 3. Admin/Manager + Person view | Insight engine, end-to-end funnel, speed/discipline, department comparison, people table, person drill-down with diagnosis | Each insight links to records; the person view lists strengths and weak spots |
| 4. Department sections | Post-sale tracker (bookings → registration → documents → commission), Sales revenue, Finance aging, Sourcing supply/demand + verification, HR funnel, Digital source quality, Design output | Each department has its own funnel and task metrics |
| 5. Hardening | 6-month performance on the mirror, empty/loading/error states, dark mode, 375 px layout, retire legacy dashboards and endpoints | Old dashboards removed; full test suites pass |

## 9. Decisions (answered 2026-11-06)

These override anything above that says otherwise.

1. **Uncommitted dashboard work is discarded.** This covers `BusinessDashboard`, `SalesRecords`, `WeeklyIncentives`, `ReportingCharts`, `dashboard-data.ts`, `dashboard.service/controller/dto`, the blanked `page.tsx`, and `infra/migrations/071–074_dashboard_*.sql`. At the start of Phase 0 it's saved to a backup branch or stash first, not deleted outright, then reverted. The incentive rules it contained (sales slab %, visit incentive) aren't part of this plan. Sales and Finance figures come from the new post-sale tracker (decision 5).
2. **Daily targets are derived automatically from pace:** remaining weekly target ÷ remaining working days. There's no fixed daily override.
3. **Staff see a full leaderboard for their own department,** with names, ranked per metric, never combined across metrics. Other departments aren't shown.
4. **Working calendar: Monday–Saturday, 9:00–18:30 IST,** with Sunday off. Gap detection and per-day pace use this window. Holidays are a configurable list.
5. **The CRM gets a post-sale tracker.** A booking record is created when a lead reaches Booking Advance (or Closed Won). It holds unit, booking value, brokerage, registration date, a document checklist, commission invoiced/received entries, and dues aging. Finance/CRM/Collection works from it, and it feeds the revenue section of the Admin view and Sales booking value.
6. **Managers get task templates like staff,** using the metric set of the department they work in. Managers without a department need one assigned, or must pick one when the task is created.
7. **A call counts as connected when its logger duration is over 0 s.**
8. **Ad spend: not decided.** Until someone commits to entering spend, Digital shows lead volume and quality by source only. There's no cost per lead.
9. **"Collection Department" = Finance / CRM / Collection.** It's one team, separate from Digital. The department record keeps its current name, so existing nav defaults and task lookups keep working. Its label is shown as "Finance / CRM / Collection".
