# Dashboard implementation coverage

The existing Dashboard sidebar entry now opens Telecalling, Sales, Lead funnel, Incentives and Sales records. Employee selection supplies individual detail. India-time date presets/custom ranges and current-owner department, employee, source, status, category and project filters are available.

Charts include area/line trends, donuts, ranked bars, a calling-hours heatmap, employee scatter plots, an observed-stage funnel and target progress. Data tables, record links, Excel exports and browser Print / Save as PDF accompany reports.

Local migrations 071–074 add audited visits, evidence-backed bookings, integer-paise transaction/brokerage amounts, invoice/receipt/credit/refund entries, monthly/weekly approvals, call dispositions and creation-retry keys. APIs under `/api/v1/metrics/dashboard` query the existing CRM MySQL source directly. New facts are not yet mirrored into DuckDB. New fact times are entered in IST and written as UTC SQL strings. No sample data is added by the product.

Sales incentives use received brokerage and the full achieved monthly rate, as selected by the user. Exactly 4/6/9 lakh enters the next band; exactly 12 lakh retains 7%. This boundary interpretation needs client sign-off. Weekly rates apply to all eligible visits. Plot visits use only their own slab. Earliest verified completion per lead per Monday–Sunday week receives credit across employees; general and plot counts use separate slabs. These period and tie conventions are implementation decisions for review. Approval snapshots flag changed eligibility. Approvals are restricted to administrators; financial entries to administrators and department-scoped managers.

The complete PDF still requires additional work before full UAT

- Configurable first-response SLA/business calendars and immutable follow-up completion/schedule history.
- Effective-dated teams, original telecaller/salesperson attribution, inactive employee history and original campaign/source preservation.
- Structured opportunities, expected transaction/close data and negotiation ageing.
- Qualification rules, configurable weighted scorecards and category-based daily targets.
- Customer reminders/escalations, accounting reconciliation, tax/partner-share policy and receivable due-date ageing.
- Historical as-of reconstruction. Current ownership/status affect historical ranges. The funnel counts observed events in-period and visits use scheduled-date cohorts.
- Incentives use whole calendar months/weeks and employee scope, independently of source/project filters. The screen explicitly states these semantics.
- Additional KPI-specific drill-downs, custom PDF templates, finalized payroll batch/export history and dedicated Finance/HR permission grants. Incentive Excel sheets include Draft/Approved/Needs reapproval states for manual review.
- Versioned configuration of slabs and weights. Current incentive rates follow the PDF in code.

This deliverable establishes the reporting and sales-fact foundation. Source-data limitations appear in dashboard definitions and metric labels.
