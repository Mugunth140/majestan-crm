# CRM dashboard and staff coaching

## Research and design decisions

Sales dashboards need a path from a warning to the records that explain it. The opening view shows today’s workload and a queue of leads to review. The staff selector and time window apply to the coaching report. Organization, department, and individual views use the same metric definitions. The portfolio uses current ownership, while logged activity uses the person who performed it.

- Salesforce recommends pairing activity with pipeline progression, conversion and velocity. The CRM can report recorded visit and win events today. A historical funnel by staff needs verified ownership at the time of each event and a cohort with enough follow-up time. [Salesforce pipeline guidance](https://www.salesforce.com/sales/pipeline/b2b/)
- Dynamics 365 separates team coaching from seller detail and lets managers narrow the time window. The dashboard uses that structure and keeps actionable lead links beside the staff breakdown. [Dynamics 365 team coaching](https://learn.microsoft.com/en-us/dynamics365/sales/conversation-intelligence-team-overview) and [seller detail](https://learn.microsoft.com/en-us/dynamics365/sales/conversation-intelligence-seller-details)
- Frappe’s dashboard guidance pairs high-level metrics with filtered breakdowns. The CRM follows that pattern with the staff selector and activity period in the toolbar. [Frappe Insights dashboard guide](https://docs.frappe.io/insights/creating-your-first-dashboard)

## What the dashboard measures

| Signal | Definition | Coaching use |
| --- | --- | --- |
| Open leads | Current assigned leads excluding closed, dropped, unqualified and converted records | Read every workload signal in context |
| Overdue, due today, no next follow-up | Latest lead follow-up’s pending date, classified using India’s calendar day | Prioritize old callbacks, then set missing next steps |
| Owner coverage | Open leads with an owner-authored contact log or follow-up in the selected period, divided by all open leads | Review untouched leads with the owner. An empty portfolio has no percentage |
| Repeated unanswered attempts | Open leads with at least three consecutive RNRs | Discuss a different time or contact channel |
| Logged activity | Actor-attributed calls and messages across CRM modules and lead follow-up entries, with daily counts | Compare patterns by channel and period. Logging activity does not establish that a customer replied |
| Recorded visit and win events | Status-change entries attributed to the actor during the period | Discuss outcomes alongside activity and workload. A reopened lead can generate a second event |
| Monthly task progress | Each assigned active task target against its progress for the same month | Discuss remaining work per target. Counts and amounts are kept separate |

The coaching report uses the existing analytics mirror. Its sync time appears below the charts. Admin and Super Admin see organization metrics and operations. Managers start with organization-wide staff coaching. Team Leads see their current department, and Staff see their own work. Selecting a person switches the entire coaching report to that person.

## Next measurements and data prerequisites

- **Speed to first touch and SLA misses.** Validate assignment timestamps and define the start of the SLA, working hours, reassignment rules and excluded queues. Report median and 90th percentile with the sample size.
- **Stage aging and cohort conversion.** Reconstruct movement using stage and assignment history, then compare comparable cohorts by lead source and department. Keep unworked, recently assigned and historically incomplete cohorts visible.
- **Conversation quality.** Add answered versus unanswered calls once direction and outcome have consistent coverage. Delivered messages, replies, talk ratios and sentiment need reliable channel events or recordings. Logged attempts cannot answer those questions.
- **Target and outcome trends.** Compare several complete months after confirming that task definitions and weekly targets are stable. Compare per-metric progress before considering any cross-role score.
