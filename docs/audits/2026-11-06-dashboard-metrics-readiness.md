# Prismark CRM Dashboard metrics and data availability audit

Audit date 6 November 2026. Scope is the **Dashboard sidebar item at `/`**. The website Analytics page at `/analytics` is a separate feature.

## A. Executive summary

The existing CRM can support this work through its Next.js frontend, NestJS backend, TypeORM/MySQL source database, DuckDB reporting mirror and Valkey cache. Activity charts, current lead portfolios, employee filtering and weekly/monthly task targets already exist. The complete client specification is **partially supported**. Verified visit reporting, evidence-backed bookings, brokerage accounting and approved incentives require source-data development before accurate dashboards can be delivered.

The PDF explicitly asks for a separate analytics application on page 1. Technically, an additional application is optional because a reporting layer already exists. The user's requested placement is the Dashboard sidebar entry. Confirm this delivery decision with the client. A separate application would still need the same missing CRM records and event tracking.

Major blockers and accuracy defects found in source

- Calls have optional duration and direction, with device ingestion and deduplication. They lack explicit connection outcome, disposition and next action. Positive duration is only a candidate proxy for connected calls.
- Visits are inquiry date/time fields and lead status events. There is no dedicated visit lifecycle with confirmation, attendance verification, cancellation and no-show records.
- Bookings are primarily a `Booking Advance` lead status. There is no booking ledger linking lead, unit, transaction amount, confirmation evidence and cancellation.
- The current `conversions` metric counts `converted_to` inbound listings or agents. This is a different business event from a customer booking.
- Brokerage earned, invoices, receipts, outstanding balances and incentive approval/payroll records have no corresponding dedicated ledgers in the inspected schema.
- Legacy summary endpoints accept dates but calculate mostly all-time/current totals. The newer coaching dashboard mixes period activity, current ownership portfolio counts and current-month targets.
- Managers currently receive organization-wide metrics. The PDF requests department/team scope for Department Heads and Managers.
- History exists, but completeness is limited by mutable/deletable activities, best-effort event writes, current department joins and status-based task increments.

Evidence includes repository source, migrations and read-only SELECT queries against the **local development CRM database**. Production records were not inspected. No source code, schema, API or UI was changed for this audit. A report is the sole deliverable.

### Local data observations

The local database contains lead events, routing histories, contact logs, task targets/progress, record events and enquiry records. SHOW TABLES confirms no dedicated site visit, sales opportunity, booking, brokerage ledger or incentive tables. Local leads total 29, including two currently `Site Visit Completed` and none currently booked. These small local counts cannot establish production completeness.

There are 13 lead contact-log rows across contact types. Six have duration and direction and zero have a source call ID. This is evidence of nullable metadata in local records, not a claim that every contact row should be a call. There are 76 lead events. Presence and earliest event date do not prove continuous capture or establish the actual production history cutoff. Local MySQL session/global timezone settings are `SYSTEM`, which does not establish a consistent application timestamp contract.

## B. KPI compatibility matrix

Status refers to the exact PDF meaning, not whether a rough count can be produced. Fully Supported means the required definition and data are established. Partially Supported means reusable data exists but a calculation, validation or lifecycle is incomplete. Missing means no adequate source model/workflow was found. Needs Verification identifies a definition or external-data dependency.

All formulas require server-enforced access scope, an agreed Asia/Kolkata period and explicit denominator handling. Zero denominators should display unavailable rather than a fabricated rate. Reference codes resolve to source paths and line numbers at the end.

| Metric | Status | Data source | Relevant fields | Calculation | Existing implementation | Missing requirements | Recommended changes | Priority |
|---|---|---|---|---|---|---|---|---|
| Outbound calls | Partially Supported | contact_logs and other module contact logs [P1/P2] | contact_type, call_direction, created_at, sent_by_id | Count call rows with direction Outgoing during period | Existing dashboard counts all calls through all_contacts, regardless of direction | Direction nullable; all_contacts drops direction/duration; unmatched and staff-number calls rejected | Expose direction-aware lead/customer call aggregates and reconcile dialler coverage | High |
| Connected calls | Partially Supported | contact_logs [P1/P2] | duration, direction, actor, timestamp | Count explicit answered customer calls | Duration is captured by device sync | No connected flag or outcome; duration alone does not prove a customer answered | Add normalized connection outcome and provider mapping | High |
| Connection rate | Partially Supported | call logs [P1] | connected_flag and outbound attempts | Connected outbound calls / outbound attempts × 100 | No exact calculation found | Connected definition and metadata completeness | Agree denominator including incoming calls; add exact aggregate | High |
| Talk time | Partially Supported | call logs [P1/P2] | call_duration, outcome, event timestamp | Sum connected duration seconds / 60 | Duration stored; reporting view omits it | Connection evidence and nullable legacy duration | Include duration and outcome in reporting view; preserve unknowns | High |
| Average talk time | Partially Supported | call logs [P1] | connected duration, connected count | Sum duration / connected count | No exact calculation found | Same connection ambiguity | Compute after connection normalization | Medium |
| Leads contacted | Partially Supported | contact_logs + routing_histories [P1/R1] | lead_id, success outcome, sent_by_id, assignment interval | Distinct eligible assigned leads successfully contacted | Calls and untouched-owner checks exist [C2] | Attempt is treated as activity; successful contact unavailable | Join successful contacts to historical assignment and count lead IDs | High |
| Qualified leads | Partially Supported | leads + lead_inquiries + lead_events [L1/L2/L5] | status, is_unqualified, preferences budget, property_type, location, purchase_timeline | Distinct leads meeting agreed criteria in period | Qualified stage rank and qualification events exist | is_unqualified=false is insufficient; criteria and qualification timestamp not authoritative | Version qualification rules and persist qualification decision/effective time | High |
| Follow-ups completed | Partially Supported | lead_follow_ups [L3/C2] | due date/time, is_completed, created_by_id, completed_at | Due follow-ups completed in selected period / due follow-ups for attainment | Flag and mutable updated_at exist; coaching counts rows created | No immutable completion time or durable due-task identity | Add completed_at/completed_by and separate scheduled obligation from activity | High |
| Follow-ups due and overdue | Partially Supported | lead_follow_ups [L3/C2/N1] | next_follow_up_date/time, is_completed, owner | Due by agreed instant; overdue if incomplete past due | Coaching latest-row queue and India-time reminders exist | Dashboard overdue uses day only; historical due state unrecoverable after edits/deletes | Preserve schedule history and calculate due instants consistently | High |
| Site visits booked | Partially Supported | lead_inquiries + lead_events [L2/L5] | visit_date, visit_slot, inquiry ID, visit_scheduled event | Count unique agreed visit appointments scheduled in period | Scheduling fields and event type exist | No stable visit lifecycle ID; reschedules and repeat visits ambiguous | Create visit records linked to lead/inquiry and history | High |
| Site visits completed / Completed site visits | Partially Supported | lead_events + leads [L4/C2/M3] | to_value, created_at, actor_id, lead_id | Count verified attended visit IDs completed in period | Counts completion status events or current lead status | Status can be asserted without attendance evidence; repeated transitions inflate | Store actual completion time, attendee and verifier per visit | High |
| CRM update compliance | Missing | call logs + follow-ups [P1/L3] | disposition, next_action_at, validation state | Calls with valid disposition and next action / eligible calls × 100 | Free-text notes/outcomes exist on separate follow-up records | No required structured call disposition/next-action link | Add validation and auditable call-to-next-action linkage | High |
| Visit confirmation rate | Missing | inquiry scheduling [L2] | visit_id, confirmed_at, scheduled_at | Confirmed visits / scheduled visits × 100 | Schedule exists | No confirmation lifecycle field | Add visit confirmation event and timestamp | High |
| Visit attendance rate | Partially Supported | visit-related status history [L2/L5] | scheduled visit ID and verified completion | Completed visits / scheduled visits × 100 | Approximate status counts possible | Appointment denominator and verification absent | Calculate by visit cohort after visit model exists | High |
| No-show rate | Missing | no dedicated visit model | visit_id, no-show state/time/reason | No-shows / scheduled visits × 100 | No dedicated lifecycle implementation found | No authoritative no-show data | Add no-show disposition and required reason | High |
| Visit cancellation rate | Missing | no dedicated visit model | cancelled_at, cancellation_reason, scheduled visit ID | Cancelled visits / scheduled visits × 100 | No dedicated lifecycle implementation found | No authoritative visit cancellation data | Add cancelled/rescheduled history | High |
| Visit-to-booking conversion | Missing | visit status + lead status only [L1/L2] | visit ID, lead cohort, confirmed booking ID | Eligible bookings / completed visits in same lead cohort × 100 | Generic lead funnel exists [M2] | No booking/verified visit entities or common cohort | Define unit of conversion and join source ledgers | High |
| First response time | Partially Supported | leads, routing_histories, contact_logs [L1/R1/P1] | lead receipt/assignment time, first successful contact time | First qualifying response time minus agreed SLA start | Creation, assignment and call times available in some paths | No successful contact state; receipt vs creation vs assignment undefined | Capture receipt and successful response; configure SLA/calendar | High |
| Leads assigned | Partially Supported | leads + routing_histories [L1/R1] | to_user_id, lead_id, created_at | Distinct leads assigned to salesperson during period | Current owner portfolio exists | Current count is not period allocation; imports and direct edits need history coverage | Use assignment events with initial allocation and reassignments | High |
| First contact rate | Partially Supported | assignment and contacts [R1/P1] | assignment cohort, successful first contact | Assigned leads contacted / assigned leads × 100 | Activity and allocation sources exist | No exact success/cohort calculation | Build assignment-cohort metric with successful contact | High |
| Customer follow-ups | Partially Supported | lead_follow_ups [L3] | due, completion timestamp, actor, lead | Completed activities; separate due/completed/overdue | Current schedule and creation counts exist | Completion history and period attribution incomplete | Reuse follow-up foundation after lifecycle correction | High |
| Negotiations | Partially Supported | leads.status + lead_events [L1/L5] | status Negotiation, stage time, salesperson | Count active opportunities discussing terms | Negotiation stage exists [M2] | Lead-level stage without opportunity/value/expected close date; no stage-age report | Add opportunity lifecycle and stage history | High |
| Bookings | Partially Supported | leads.status, lead_documents [L1/L4] | Booking Advance status, documents | Count confirmed evidence-backed booking IDs | Booked status counted [M1] | No booking confirmation validation, cancellation ledger or unit linkage | Create booking record and confirmation/evidence rule | High |
| Lead-to-booking conversion | Missing | generic funnel [M2] | eligible lead cohort and confirmed booking IDs | Bookings / eligible leads in same cohort × 100 | Funnel infers reached rank from status/history | converted_to is inbound/agent; rank can infer skipped stages; no as-of cutoff | Use explicit booking facts and bounded cohort events | High |
| Average transaction value | Missing | listing prices and commissions are insufficient | booking.transaction_value, confirmed booking ID | Sum eligible transaction value / bookings | No transaction-value aggregate found | No booked transaction ledger | Store actual agreed amount on booking separately from listing asking price | High |
| Transaction value | Missing | no booking financial ledger | transaction_value, currency, booking status | Sum qualifying property transaction amounts | Listing/asset financials exist for other purposes | No realized booking amount linked to lead | Add booking-level transaction amount | High |
| Brokerage earned | Missing | lead commission; listing brokerage terms | booking_id, earned amount, recognition date | Sum contractually earned brokerage for qualifying transactions | Terms exist, no realized ledger | Terms/percentage do not establish earned revenue | Add separate brokerage obligations and recognition policy | High |
| Brokerage invoiced | Missing | no invoice ledger found | invoice ID/date, booking, amount, credit notes | Sum issued invoice amounts net of applicable credits | No relevant endpoint found | Invoice facts missing | Integrate accounting or add invoices linked to brokerage | High |
| Brokerage received | Missing | task receipts/manual collection metrics are insufficient | payment ID/date, amount, allocation | Sum allocated settled cash receipts | Generic task receipts and collection targets exist | No reconciled brokerage cash ledger | Integrate receipt ledger and allocations | High |
| Brokerage outstanding | Missing | no receivables ledger | invoice/earned balance, allocations, due date, credits | Policy-defined receivable minus applied receipts/credits | No exact calculation found | Accounting basis undefined and facts absent | Agree basis then add receivables ageing and reconciliation | High |
| Average brokerage | Missing | no earned brokerage ledger | earned brokerage, bookings | Eligible brokerage earned / bookings | No exact calculation found | Revenue ledger missing | Compute from approved brokerage facts | Medium |
| Target achievement | Partially Supported | task_metric_targets/progress [T1/T2] | monthly_target, achieved_count, metric type, month | Actual eligible brokerage / brokerage target × 100 | General count/amount targets and attainment exist | Sales target_amount is manual and not defined as brokerage; joined targets may repeat across weekly rows | Define brokerage metric, period-filter totals and aggregate targets before joining progress | High |
| Employee-wise and team-wise performance | Partially Supported | users, departments, activity actors [U1/C1/C2] | employee, department, historical team/manager | Group valid facts by authorized employee/team | Organization/department/self scope and person filter exist | No explicit team_leader_id or employment/team history; actor and owner differ | Add effective-dated reporting structure and attribution policy | High |
| Configurable daily, weekly and monthly targets | Partially Supported | task templates/targets [T1] | monthly_target, week1..5_target, role/category/effective period | Compare same-unit actual to relevant period target | Weekly/monthly employee/department targets exist | Daily/category/effective-dated rules absent; legacy summary divides monthly target by four | Extend target configuration and use configured weekly values | Medium |
| Weighted KPI scorecards | Missing | generic task progress [T1/T2] | weights, normalized achievement, caps, rules version | Sum approved weight × normalized KPI achievement | Generic completion percentages exist | No PDF weight engine or normalization policy | Implement versioned configurable scorecards after source facts | Medium |
| Weekly telecalling site-visit incentives | Missing | status-based task progress [T2] | verified visit, eligible employee, week, slab version | Approved visit count mapped to PDF slab | No incentive engine found | No verified visit eligibility or payout approval | Add versioned rules, eligibility snapshot and approval ledger | High |
| Separate plot incentive slabs | Missing | inquiry.property_category [L2] | verified visit category and incentive version | Apply plot-specific weekly rule | Category strings exist | No stable visit category snapshot or incentive policy | Snapshot visit category and define overlap with general slab | High |
| Monthly sales brokerage incentive slabs | Missing | no eligible brokerage ledger | eligible brokerage by employee/month, slab version | Apply confirmed full-amount or marginal slab rule | No implementation found | No eligible brokerage basis, slabs or approval | Implement after financial ledger and client policy approval | High |
| Incentive eligibility, approval and export | Missing | task_receipts are unrelated evidence attachments | calculation run, source IDs, approver, status, export batch | Freeze eligible facts; approve; export approved batch | No payroll/incentive workflow found | Audit trail, adjustments and export controls missing | Add draft/approved/reversed runs and authorized payroll export | High |
| Historical employee assignments and attribution | Partially Supported | routing_histories + lead_events [R1/L5] | from/to owner, actor, timestamp, original telecaller/salesperson | Attribute using owner interval or approved originating employee | Routing changes are preserved on routing paths | Single current owner; no immutable original telecaller/salesperson; event writes best effort | Audit every mutation path, preserve originals and effective ownership intervals | High |

## C. Database and historical reporting gaps

### Reuse

- Leads have a unique mobile number, current owner, department, source, status, timestamps, commission terms and drop reason [L1]. Requirements have category/type, project_list text, optional cross-database property ID, location, timeline and flexible preferences including budget matching [L2]. Multiple requirements per lead require an explicit category/project attribution rule.
- Lead follow-ups carry actual-session date/time, next-session date/time, channel, outcome, creator, completion flag and mutable timestamps [L3]. Device calls preserve original call time in created_at. Manual contacts use insertion time, so identical column names do not imply identical event semantics [P1/P2].
- Lead events preserve status and requirement changes with actor, before/after and metadata. Routing histories preserve from/to user and event time. These are useful foundations, subject to completeness checks [L5/R1].
- Task targets/progress and task activity logs support operational goals, manual updates and evidence attachments. A receipt attachment is not an accounting cash receipt [T1/T2].

### Minimum additions

1. Normalize call direction, answered outcome, disposition, call occurrence versus ingestion time, next action and external call identity. Preserve unmatched-call coverage separately if full employee call productivity is required.
2. Add visits with stable IDs, lead/project/category links, scheduled and actual times, confirmer/verifier/attendee, outcomes and reasons. Keep rescheduling and repeat visits as auditable events.
3. Add opportunities and bookings with stage history, unit/project links, expected and actual transaction amounts, booking evidence, confirmed/cancelled dates and reasons.
4. Add brokerage obligations, recognition dates, invoice/credit records, receipts and allocations, preserving fixed-decimal currency values. Current DuckDB numeric mapping converts DECIMAL to DOUBLE [A1], so finance calculations require decimal-safe storage and aggregation.
5. Preserve original telecaller, assigned salesperson, original source/campaign and effective-dated ownership/team membership. Current user has role/department but no explicit team leader [U1].
6. Extend targets with daily periods, category, rule versions and effective dates. Add scorecard rules, incentive calculations, approvals, reversals and payroll export batches.

### Accuracy findings

- Exact mobile uniqueness and bulk normalization reduce duplicate lead creation. They do not resolve shared phones, alternate numbers, duplicate households or historical merges. Define the reporting identity and retain merge lineage.
- Device sync has per-table source-call uniqueness and batch checks. All-contacts is UNION ALL across five modules, so a business-wide customer denominator must distinguish module, entity and source call. All-contacts currently omits duration and direction [A2].
- Device sync rejects unknown numbers and staff numbers. Its pre-assignment check compares call time to matched entity creation time, not a full assignment interval [P2]. Local device sync coverage must be reconciled before treating CRM counts as total handset productivity.
- Status-driven task progress increments on matching requests without receiving previous status or an event ID. updateLeadStatus calls it even when the same status is submitted again. Retries, re-entry and reversals can inflate progress. No corresponding cancellation/reversal ledger was found [L4/T2].
- Follow-up creation counts are activity counts, not completion counts. Deleting/editing a follow-up can change past results. updated_at cannot identify when completion happened if the row was later edited [L3].
- Lead event writes catch and log insertion failures rather than failing the source change. Missing history is therefore possible. Lead deletion removes associated contacts/follow-ups; the analytical mirror is rebuilt from current source tables [L5/A1].
- Current portfolio counts change after reassignment. Period activity credits the logging actor. Historical department grouping joins current users.department_id. Historical team output needs effective-dated membership [C2/M1].
- The legacy funnel ranks current and ever-recorded statuses for leads created in range. It can infer stages that were skipped and can include later outcomes after the selected end date. It cannot establish a booking-cohort conversion as of that end date [M2].
- pipeline_daily stores aggregate status/department snapshots captured during sync, not employee-level immutable histories. It cannot reconstruct time before capture or detailed lead-level drill-downs [A1].
- Coaching derives today's date in Asia/Kolkata, but SQL compares naive mirrored timestamps to date boundaries. Device ingestion explicitly writes UTC. No consistent UTC-to-IST conversion appears in these reporting queries. Events between 00:00 and 05:29 IST require boundary tests [C1/C2/P2]. Reminder scheduling explicitly uses India wall-clock time [N1].
- Legacy task percentages join one target to several weekly progress rows, potentially repeating its denominator. Some summaries lack month constraints and use monthly_target/4 for a weekly target. Summing count and amount metrics also mixes units. Scorecards need per-KPI normalization before weighting [M1/M3/T1].

## D. API gap analysis

| Existing API | Current support | Required improvement |
|---|---|---|
| GET /api/v1/metrics/coaching/people | Server-scoped active employee roster | Effective-dated teams and approved manager/finance scope |
| GET /api/v1/metrics/coaching?person=&days= | 7/30/90-day activity, current queue, targets, staff comparison | Today/week/month/custom, department/source/category/project/status filters; consistent period semantics |
| GET /api/v1/metrics/summary?from=&to= | Role-based legacy totals | Apply range to actual queries, separate snapshots and period facts |
| GET /api/v1/metrics/charts?type=&from=&to= | Trends, funnel, source/dept/staff charts | Consistent shared filters, cohort/as-of semantics and financial datasets |
| GET /api/v1/metrics/series | Calls, follow-ups, status changes, visits and inbound/agent conversions; day/week/month grouping | Connection/talk-time/booking/revenue metrics; fill missing time buckets; preserve historical group membership |
| GET /api/v1/metrics/pipeline-history | Admin/manager organization aggregate snapshots | Employee-scoped history and supported drill-down identities |
| DELETE /api/v1/metrics/cache | Viewer cache invalidation | Consistent freshness after corrected facts and new filters |
| GET /api/v1/leads and /:id/timeline | Lead list filters and event/routing timeline | Shared report predicate contract, full KPI-to-record reconciliation |
| POST /api/v1/contact-logs/sync; GET /global | Device ingestion and administrative call feed | Read aggregates by outcome, duration and eligible customer scope |
| GET /api/v1/staff-activity, /staff, /summary | Existing staff activity retrieval | Reuse authorization and drill-down patterns; add report-specific facts |
| GET /api/v1/tasks/dashboard, /my, /:id/progress | Weekly/monthly operational goals | Accurate source-linked achievement and brokerage-specific targets |

New report endpoints should cover visit lifecycle/cohorts, opportunities/bookings/cancellations, brokerage reconciliation, scorecards and incentive preview/approval/export. Use a shared validated filter and authorization service. Exports must invoke the same scoped queries as the screen, with explicit as-of time and rule version. New cache keys must include all filters and permission scope.

## E. Dashboard gap analysis

| PDF screen | Current Dashboard | Readiness |
|---|---|---|
| Telecalling Overview | Coaching activity, backlog, trends, general targets | Partial; connection, talk time and verified visit metrics missing |
| Telecaller Detail | Person selection and per-person coaching | Partial; exact daily/weekly scorecard and linked KPI records missing |
| Sales Overview | Legacy pipeline/status funnel and current activity | Partial; financial/booking source facts missing |
| Sales Executive Detail | Person-scoped work and general task goals | Partial; opportunities, transaction/brokerage and true booking conversion missing |
| Combined Funnel | Ranked lead-stage funnel | Partial; inferred historical attainment differs from explicit lead movement and booking cohort |
| Incentive Report | No dedicated implementation found | Missing |

The root page mounts CoachingDashboard with role-based Admin/TeamLead/Staff legacy dashboards and a tasks overview [D1/D2]. Coaching offers an employee selector, 7/30/90-day periods, work queue links, daily charts, staff comparisons and current-month targets. Legacy panels contain trend, funnel, heatmap, scatter, source and department charts. This is a reusable presentation foundation.

The PDF's shared Today/This Week/This Month/Custom, department, employee, team leader, source, category, project and status filter contract is absent. Some underlying lead list filters exist, but a list filter is not a shared reporting filter. No comprehensive KPI drill-down or filtered Excel/PDF dashboard export was found. Existing property-sharing PDFs are a different feature.

Server scope exists [API/C1/M1], but its role mapping differs from the PDF. Admin, Super Admin and Manager receive organization scope. Team Lead receives department scope. Staff receive self scope. There is no explicit report role mapping for MD, Telecaller, Sales Executive or authorized Finance/HR. A department is currently the proxy for a team. Review direct drill-down endpoints as well as aggregate endpoints during implementation.

Follow-up reminders and coaching overdue/untouched/RNR queues are reusable alerts. No complete configurable first-response SLA escalation, visit outcome exception workflow, negotiation ageing or booking cancellation adjustment was found. Responsive components exist, but the six new screens and export accessibility require their own acceptance testing.

## F. Implementation sequence

1. **Definitions and reconciliation.** Agree the questions below. Audit real data completeness with client-authorized read-only production aggregates. Establish UTC storage and IST periods. Reconcile employee/day records against handset and CRM samples. Record history coverage dates.
2. **Calculation and reporting foundation.** Reuse existing auth, source IDs, DuckDB and cache. Correct date filtering, month/target joins, attribution and event idempotency. Separate period facts from current portfolio snapshots. Add shared scoped filters and same-predicate record drill-downs.
3. **Available-data release.** Ship clearly defined logged-call attempts, activity trends, current portfolios, lead sources, due/overdue queue and configured weekly/monthly targets. Use raw contacts for direction/duration where complete, with explicit coverage indicators. Avoid presenting proxies as verified outcomes.
4. **Telecalling source lifecycle.** Add successful-call outcomes, next actions, first-response timestamps, structured qualification and durable follow-up completion. Then build exact telecaller KPIs and discipline scorecards.
5. **Visits and sales.** Introduce verified visits, opportunities and evidence-backed bookings/cancellations. Preserve original and current attribution. Then implement both sales screens and cohort conversion funnel.
6. **Finance.** Add/integrate brokerage recognition, invoices, receipts, credits and reconciliation. Preserve fixed decimals. Then calculate transaction value, earned/invoiced/received/outstanding amounts separately.
7. **Incentives and exports.** Configure versioned slabs and weights, eligibility snapshots, approvals, adjustments and payroll export. Add filtered Excel/PDF reports and ageing/SLA alerts. No automatic payment workflow is required.
8. **Acceptance.** Reconcile cards to records and exports. Test repeated status requests, call retries, cross-team reassignment, revisits, cancellation/reversal, zero denominators, month/week boundaries, 00:00 IST and permission changes. Build a client-approved UAT dataset rather than relying on sparse local data.

## G. Client questions and exact PDF rules

### Scorecard configuration from PDF page 5

| Telecalling KPI | Weight | Sales KPI | Weight |
|---|---|---|---|
| Verified completed site visits | 35% | Brokerage revenue achieved | 30% |
| Qualified leads | 20% | Booking closures | 20% |
| Call productivity | 15% | Completed site visits | 15% |
| Follow-up discipline | 15% | Lead conversion | 15% |
| First response time | 10% | Follow-up discipline | 10% |
| CRM data quality | 5% | Negotiation pipeline | 5% |
| | | CRM data quality | 5% |

Both weight sets sum to 100%. No matching configurable engine was found. Confirm KPI normalization, cap/overachievement, low-is-better SLA scoring, missing data and eligibility before applying these weights.

### Incentive configuration from PDF page 5

| Scheme | Thresholds | PDF rate |
|---|---|---|
| Telecalling weekly completed visits | Below 3; 3–6; 7–8; above 8 | None; 500; 750; 1,000 per visit |
| Plots weekly completed visits | Up to 3; 4–5; 6–8; above 8 | None; 250; 500; 750 per visit |
| Monthly eligible sales brokerage | Below 2 lakh; 2–4 lakh; 4–6 lakh; 6–9 lakh; 9–12 lakh; above 12 lakh | 0%; 2.5%; 4%; 5%; 7%; 8% |

The source PDF renders its currency glyph as a square. Confirm INR with the client before configuring currency. The slab values above are copied without resolving the following ambiguities.

1. Does the winning weekly visit rate apply to all visits, visits above the threshold, or incrementally by slab? Does plot eligibility replace the general scheme or accumulate with it? Can repeat visits by one customer earn again?
2. Are sales incentive rates applied to the whole eligible monthly amount or marginal bands? The PDF explicitly requests this decision. Which slab owns exact 4/6/9/12 lakh boundaries?
3. Is eligible brokerage earned, invoiced or received? Before or after GST, discounts, partner shares, refunds and credits? How are collection delays and later cancellations reversed across payroll periods?
4. Which evidence verifies attendance and booking confirmation? Who approves it? Is a Booking Advance sufficient? What constitutes a qualifying transaction for brokerage recognition?
5. Does a site visit count per customer, appointment, project, unit or attendance? Which date defines its cohort? How are reschedules, revisits, cancellations and no-shows handled?
6. Does first response start at source receipt, CRM creation, assignment or sales acceptance? Are working hours/holidays excluded? What event is a successful response and what is the SLA?
7. Does a connected call include inbound calls and voicemail? Is duration >0 an accepted proxy for imported history? Should calls to agents, owners and HR count toward the 175 outbound/day and 150 talk-minutes/day starting targets?
8. Which qualification fields and values are mandatory by category/source? Can multiple inquiries qualify one lead, and which project/category receives credit?
9. For conversion, use leads created, assigned or accepted during the cohort? What observation horizon and as-of date apply? Are booking counts distinct leads or booking IDs?
10. Does credit follow the event actor, current owner, original telecaller, visiting salesperson or split credit? How do department transfers, inactive employees and historical manager changes work?
11. Who maps to MD/Director, Department Head, Team Leader, Telecaller, Sales and Finance/HR in the current roles? Managers currently see the organization. Is that intentional?
12. Confirm whether the existing Dashboard should host these reports, as requested here, or the PDF's separate application is contractual. Confirm required export layouts, approval owners and retention period.
13. May authorized staff edit/delete financial and activity history? What correction/audit procedure and historical backfill policy should apply? Which imported outcomes are trustworthy?

## Evidence and limitations

The PDF is the primary requirements reference, particularly pages 2–7. Source inspection and local aggregate queries verify availability; no production accuracy or source reconciliation is claimed. No application tests/builds were necessary for this read-only audit. Existing uncommitted website analytics UI changes were left in place.

The following source index links to the inspected checkout. Lines may shift after future edits.

- **D1** [crm-frontend/src/app/(dashboard)/page.tsx:42](/run/media/zendex/Dev/work/Majestan/crm/crm-frontend/src/app/(dashboard)/page.tsx:42)
- **D2** [crm-frontend/src/components/metrics/CoachingDashboard.tsx:52](/run/media/zendex/Dev/work/Majestan/crm/crm-frontend/src/components/metrics/CoachingDashboard.tsx:52)
- **M1** [crm-backend/src/modules/metrics/metrics.service.ts:58](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/metrics.service.ts:58)
- **M2** [crm-backend/src/modules/metrics/metrics.service.ts:335](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/metrics.service.ts:335)
- **M3** [crm-backend/src/modules/metrics/metrics.service.ts:243](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/metrics.service.ts:243)
- **C1** [crm-backend/src/modules/metrics/coaching.service.ts:40](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/coaching.service.ts:40)
- **C2** [crm-backend/src/modules/metrics/coaching.service.ts:60](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/coaching.service.ts:60)
- **A1** [crm-backend/src/modules/analytics/analytics-store.service.ts:12](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/analytics/analytics-store.service.ts:12)
- **A2** [crm-backend/src/modules/analytics/analytics-store.service.ts:242](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/analytics/analytics-store.service.ts:242)
- **L1** [crm-backend/src/database/entities/lead.entity.ts:9](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/lead.entity.ts:9)
- **L2** [crm-backend/src/database/entities/lead-inquiry.entity.ts:6](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/lead-inquiry.entity.ts:6)
- **L3** [crm-backend/src/database/entities/lead-follow-up.entity.ts:7](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/lead-follow-up.entity.ts:7)
- **L4** [crm-backend/src/modules/leads/leads.service.ts:291](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/leads/leads.service.ts:291)
- **L5** [crm-backend/src/modules/leads/lead-events.service.ts:57](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/leads/lead-events.service.ts:57)
- **R1** [crm-backend/src/database/entities/routing-history.entity.ts:7](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/routing-history.entity.ts:7)
- **P1** [crm-backend/src/database/entities/contact-log.entity.ts:7](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/contact-log.entity.ts:7)
- **P2** [crm-backend/src/modules/contact-logs/contact-logs.service.ts:330](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/contact-logs/contact-logs.service.ts:330)
- **T1** [crm-backend/src/database/entities/task-metric-target.entity.ts:5](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/task-metric-target.entity.ts:5)
- **T2** [crm-backend/src/modules/tasks/tasks.service.ts:505](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/tasks/tasks.service.ts:505)
- **U1** [crm-backend/src/database/entities/user.entity.ts:7](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/database/entities/user.entity.ts:7)
- **N1** [crm-backend/src/modules/notifications/follow-up-reminders.service.ts:75](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/notifications/follow-up-reminders.service.ts:75)
- **API** [crm-backend/src/modules/metrics/metrics.controller.ts:5](/run/media/zendex/Dev/work/Majestan/crm/crm-backend/src/modules/metrics/metrics.controller.ts:5)
