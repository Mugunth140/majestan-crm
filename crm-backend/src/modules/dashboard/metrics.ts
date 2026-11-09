/**
 * Metric definitions for the dashboard. Every metric is a function of raw
 * counters, so a department total is computed from summed counters (never an
 * average of percentages) and a person reads the same definition as their team.
 */
export type Counters = Record<string, number>;
export type Fmt = 'n' | 'pct' | 'avg' | 'min' | 'hrs' | 'days' | 'dur' | 'inr' | 'score';
export type Better = 'up' | 'down' | 'none';
export type DeptKey = 'telecalling' | 'sales' | 'collection' | 'sourcing' | 'hr' | 'digital' | 'design' | 'other';

export type MetricDef = {
  key: string;
  label: string;
  fmt: Fmt;
  better: Better;
  /** null when there is nothing to measure yet (e.g. no calls, no denominator). */
  value: (c: Counters, ctx: { workingDays: number }) => number | null;
  /** Series key in the activity trend, when the metric can be charted over time. */
  series?: string;
  /** Snapshot metrics describe now, so they have no previous period. */
  snapshot?: boolean;
  /** Shown as an alert when the value is above zero. */
  alert?: boolean;
  hint?: string;
};


const g = (c: Counters, k: string) => c[k] ?? 0;
const ratio = (a: number, b: number, scale = 1) => (b > 0 ? (a / b) * scale : null);
const pct = (a: string, b: string | string[]) => (c: Counters) =>
  ratio(g(c, a), (Array.isArray(b) ? b : [b]).reduce((s, k) => s + g(c, k), 0), 100);
const per = (a: string, b: string, scale = 1) => (c: Counters) => ratio(g(c, a), g(c, b), scale);
const count = (k: string) => (c: Counters) => g(c, k);
const sum = (...keys: string[]) => (c: Counters) => keys.reduce((s, k) => s + g(c, k), 0);

export const DEPARTMENTS: { key: DeptKey; label: string; match: RegExp }[] = [
  { key: 'telecalling', label: 'Telecalling', match: /telecall/i },
  { key: 'sales', label: 'Sales', match: /sales/i },
  { key: 'collection', label: 'Finance / CRM / Collection', match: /collection|finance|crm/i },
  { key: 'sourcing', label: 'Sourcing', match: /sourcing|inbound/i },
  { key: 'hr', label: 'Human Resource', match: /^hr\b|human/i },
  { key: 'digital', label: 'Digital Marketing', match: /digital/i },
  { key: 'design', label: 'Design', match: /design/i },
];

export function deptKeyOf(name?: string | null): DeptKey {
  return DEPARTMENTS.find(d => d.match.test(name ?? ''))?.key ?? 'other';
}
export const deptLabel = (key: DeptKey) => DEPARTMENTS.find(d => d.key === key)?.label ?? 'Other';

// ── Shared activity metrics ───────────────────────────────────────────────

const M = {
  calls_out: { key: 'calls_out', label: 'Outbound calls', fmt: 'n', better: 'up', value: count('calls_out'), series: 'calls' },
  connected: { key: 'connected', label: 'Connected calls', fmt: 'n', better: 'up', value: count('calls_out_connected'), series: 'connected' },
  conn_rate: { key: 'conn_rate', label: 'Connection rate', fmt: 'pct', better: 'up', value: pct('calls_out_connected', 'calls_out_timed'), hint: 'Outbound calls with talk time, of outbound calls the logger timed' },
  talk_time: { key: 'talk_time', label: 'Total talk time', fmt: 'dur', better: 'up', value: count('talk_sec'), series: 'talk' },
  avg_talk: { key: 'avg_talk', label: 'Avg talk time per call', fmt: 'dur', better: 'up', value: per('talk_sec', 'calls_connected') },
  calls_per_lead: { key: 'calls_per_lead', label: 'Avg calls per active lead', fmt: 'avg', better: 'none', value: per('lead_calls', 'leads_called') },
  contact_gap: { key: 'contact_gap', label: 'Avg days between contacts', fmt: 'days', better: 'down', value: per('gap_days_sum', 'gap_n'), hint: 'Average gap between two touches on the same lead' },
  unique_leads: { key: 'unique_leads', label: 'Unique leads contacted', fmt: 'n', better: 'up', value: count('leads_contacted') },
  coverage: { key: 'coverage', label: 'Lead coverage rate', fmt: 'pct', better: 'up', snapshot: true, value: c => ratio(g(c, 'open') - g(c, 'neglected'), g(c, 'open'), 100), hint: 'Open leads the owner touched in the last 7 days' },
  first_resp: { key: 'first_resp', label: 'Avg first response time', fmt: 'min', better: 'down', value: per('resp_min_sum', 'responded_n'), hint: 'Working minutes from assignment to the first call or follow-up' },
  sla: { key: 'sla', label: 'First response SLA', fmt: 'pct', better: 'up', value: pct('resp_sla_n', 'assigned_n'), hint: 'Assigned leads touched within 1 working hour' },
  fu_due: { key: 'fu_due', label: 'Follow-ups due', fmt: 'n', better: 'none', value: count('fu_due') },
  fu_done: { key: 'fu_done', label: 'Follow-ups completed', fmt: 'n', better: 'up', value: sum('fu_ontime', 'fu_late') },
  fu_overdue: { key: 'fu_overdue', label: 'Overdue follow-ups', fmt: 'n', better: 'down', value: count('fu_overdue'), alert: true },
  ontime: { key: 'ontime', label: 'On-time follow-up rate', fmt: 'pct', better: 'up', value: pct('fu_ontime', 'fu_due') },
  inactivity: { key: 'inactivity', label: 'Avg lead inactivity gap', fmt: 'days', better: 'down', snapshot: true, value: per('idle_days_sum', 'open'), hint: 'Days since anyone last touched each open lead' },
  neglected: { key: 'neglected', label: 'Unattended leads', fmt: 'n', better: 'down', snapshot: true, value: count('neglected'), alert: true, hint: 'Open leads the owner has not touched for 7+ days' },
  overdue_now: { key: 'overdue_now', label: 'Overdue follow-ups now', fmt: 'n', better: 'down', snapshot: true, value: count('overdue'), alert: true },
  crm: { key: 'crm', label: 'CRM update compliance', fmt: 'pct', better: 'up', value: pct('crm_updated', 'crm_calls'), hint: 'Connected lead calls followed by a status or follow-up within 2 hours' },
  followups_logged: { key: 'followups_logged', label: 'Follow-ups logged', fmt: 'n', better: 'up', value: count('followups_logged'), series: 'followups' },
  active_days: { key: 'active_days', label: 'Days with calls', fmt: 'n', better: 'up', value: count('active_days') },
  fu_new: { key: 'fu_new', label: 'New lead follow-ups', fmt: 'n', better: 'up', value: count('fu_new'), hint: 'Follow-ups logged on leads created in this period' },
  fu_old: { key: 'fu_old', label: 'Old lead follow-ups', fmt: 'n', better: 'up', value: count('fu_old'), hint: 'Follow-ups logged on leads created before this period' },
  contact_freq: { key: 'contact_freq', label: 'Contacts per lead', fmt: 'avg', better: 'none', value: per('lead_contacts', 'leads_contacted'), hint: 'Calls, messages and shares, per lead contacted' },
  shares: { key: 'shares', label: 'Properties / projects shared', fmt: 'n', better: 'up', value: count('listings_shared'), series: 'shares', hint: 'Listings sent by email or WhatsApp; one share can carry several' },
  shares_per_lead: { key: 'shares_per_lead', label: 'Avg properties shared per lead', fmt: 'avg', better: 'none', value: per('listings_shared', 'share_leads'), hint: 'Listings sent, per lead that received at least one' },
  shares_per_worked: { key: 'shares_per_worked', label: 'Avg properties per lead worked', fmt: 'avg', better: 'up', value: per('listings_shared', 'leads_contacted'), hint: 'Listings sent, per lead contacted in the period' },
  calls_per_day: { key: 'calls_per_day', label: 'Calls per working day', fmt: 'avg', better: 'up', value: (c, x) => ratio(g(c, 'calls'), x.workingDays) },
} satisfies Record<string, MetricDef>;

// ── Department metric sets ────────────────────────────────────────────────

const telecalling: MetricDef[] = [
  M.calls_out, M.connected, M.conn_rate, M.talk_time, M.avg_talk, M.calls_per_lead, M.contact_gap, M.unique_leads,
  M.coverage, M.first_resp, M.sla,
  { key: 'qualified', label: 'Qualified leads', fmt: 'n', better: 'up', value: count('ev_qualified'), series: 'qualified' },
  { key: 'contact_to_qual', label: 'Contact-to-qualified', fmt: 'pct', better: 'up', value: pct('ev_qualified', 'leads_contacted') },
  M.fu_due, M.fu_done, M.fu_new, M.fu_old, M.fu_overdue, M.ontime, M.inactivity, M.neglected,
  M.contact_freq, M.shares, M.shares_per_lead, M.shares_per_worked,
  { key: 'sv_sched', label: 'Site visits scheduled', fmt: 'n', better: 'up', value: count('ev_sv_sched'), series: 'sv_sched' },
  { key: 'sv_done', label: 'Site visits completed', fmt: 'n', better: 'up', value: count('ev_sv_done'), series: 'sv_done' },
  { key: 'sv_attendance', label: 'Site visit attendance', fmt: 'pct', better: 'up', value: pct('sv_attended', 'sv_due'), hint: 'Visits due by their visit date that were completed' },
  { key: 'sv_noshow', label: 'Site visit no-show rate', fmt: 'pct', better: 'down', value: c => (g(c, 'sv_due') > 0 ? ratio(g(c, 'sv_missed'), g(c, 'sv_due'), 100) : null) },
  { key: 'qual_to_sv', label: 'Qualified-to-site-visit', fmt: 'pct', better: 'up', value: pct('ev_sv_sched', 'ev_qualified') },
  { key: 'handoff_time', label: 'Handoff to first Sales touch', fmt: 'hrs', better: 'down', value: per('ho_min_sum', 'ho_touched', 1 / 60) },
  { key: 'handoff_accept', label: 'Sales handoff acceptance', fmt: 'pct', better: 'up', value: pct('ho_accepted', 'ho_n'), hint: 'Handed-over leads that Sales touched within 48 hours' },
  M.crm,
];

const sales: MetricDef[] = [
  { key: 'assigned', label: 'Leads assigned', fmt: 'n', better: 'none', value: count('assigned_n') },
  M.unique_leads,
  { key: 'first_contact_rate', label: 'First contact rate', fmt: 'pct', better: 'up', value: pct('responded_n', 'assigned_n') },
  { ...M.first_resp, label: 'Avg time to first contact' },
  { key: 'interactions', label: 'Avg interactions per opportunity', fmt: 'avg', better: 'up', value: per('sales_touches', 'sales_touched_leads') },
  { ...M.contact_gap, label: 'Avg follow-up frequency (days)' },
  { ...M.inactivity, label: 'Sales lead inactivity gap' },
  M.overdue_now,
  { key: 'qualified_opps', label: 'Qualified opportunities', fmt: 'n', better: 'up', value: count('ev_qualified'), series: 'qualified' },
  M.shares, M.shares_per_lead, M.shares_per_worked, M.contact_freq, M.fu_new, M.fu_old,
  { key: 'share_to_visit', label: 'Share-to-visit conversion', fmt: 'pct', better: 'up', value: pct('shared_to_visit', 'shared_leads') },
  { key: 'visits_sched', label: 'Site visits scheduled', fmt: 'n', better: 'up', value: sum('ev_sv_sched', 'ev_rsv_sched'), series: 'sv_sched' },
  { key: 'visits_done', label: 'Site visits completed', fmt: 'n', better: 'up', value: sum('ev_sv_done', 'ev_rsv_done'), series: 'sv_done' },
  { key: 'sv_attendance', label: 'Site visit attendance', fmt: 'pct', better: 'up', value: pct('sv_attended', 'sv_due') },
  { key: 'visit_to_nego', label: 'Visit-to-negotiation', fmt: 'pct', better: 'up', value: pct('ev_nego', ['ev_sv_done', 'ev_rsv_done']) },
  { key: 'active_nego', label: 'Active negotiations', fmt: 'n', better: 'none', snapshot: true, value: count('negotiating') },
  { key: 'nego_duration', label: 'Avg negotiation duration', fmt: 'days', better: 'down', value: per('nego_days_sum', 'nego_closed_n') },
  { key: 'stagnant', label: 'Stagnant opportunities', fmt: 'n', better: 'down', snapshot: true, alert: true, value: count('stagnant'), hint: 'No stage move for 14+ days and no touch for 7+ days' },
  { key: 'bookings', label: 'Confirmed bookings', fmt: 'n', better: 'up', value: count('ev_booked'), series: 'booked' },
  { key: 'booking_cancel', label: 'Booking cancellation rate', fmt: 'pct', better: 'down', value: c => (g(c, 'bookings_n') > 0 ? ratio(g(c, 'bookings_cancelled'), g(c, 'bookings_n'), 100) : null) },
  { key: 'lead_to_booking', label: 'Lead-to-booking', fmt: 'pct', better: 'up', value: pct('ev_booked', 'assigned_n') },
  { key: 'visit_to_booking', label: 'Visit-to-booking', fmt: 'pct', better: 'up', value: pct('ev_booked', ['ev_sv_done', 'ev_rsv_done']) },
  { key: 'sales_cycle', label: 'Avg sales cycle', fmt: 'days', better: 'down', value: per('cycle_days_sum', 'bookings_n') },
  M.calls_out, M.conn_rate, M.ontime, M.crm,
];

const collection: MetricDef[] = [
  M.calls_out, M.connected, M.talk_time,
  { key: 'agent_contacts', label: 'Partner / agent contacts', fmt: 'n', better: 'up', value: count('agent_contacts') },
  { key: 'manual_logged', label: 'Task work logged', fmt: 'n', better: 'up', value: count('manual_logged') },
];

const sourcing: MetricDef[] = [
  { key: 'src_added', label: 'Properties sourced', fmt: 'n', better: 'up', value: count('src_added'), series: 'sourced' },
  { key: 'src_per_day', label: 'Avg listings per workday', fmt: 'avg', better: 'up', value: (c, x) => ratio(g(c, 'src_added'), x.workingDays) },
  { key: 'src_verified', label: 'Verified listings', fmt: 'n', better: 'up', value: count('src_verified') },
  { key: 'src_success', label: 'Verification success rate', fmt: 'pct', better: 'up', value: pct('src_verified', ['src_verified', 'src_rejected']) },
  { key: 'src_rejected', label: 'Rejected submissions', fmt: 'n', better: 'down', value: count('src_rejected') },
  { key: 'src_complete', label: 'Listing data completeness', fmt: 'pct', better: 'up', value: per('src_complete_sum', 'src_added', 100), hint: 'Owner, phone, type, locality, price, photo, map pin and documents' },
  { key: 'src_to_verify', label: 'Avg sourcing-to-verification', fmt: 'days', better: 'down', value: per('src_verify_hours_sum', 'src_verify_n', 1 / 24) },
  { key: 'src_localities', label: 'Localities covered', fmt: 'n', better: 'up', value: count('src_localities') },
  { key: 'ver_calls', label: 'Verification calls', fmt: 'n', better: 'up', value: count('inbound_calls') },
  { key: 'ver_conn', label: 'Verification call connection', fmt: 'pct', better: 'up', value: pct('inbound_calls_connected', 'inbound_calls_timed') },
  { key: 'ver_done', label: 'Verifications completed', fmt: 'n', better: 'up', value: count('ver_done'), series: 'verified' },
  { key: 'ver_pending', label: 'Pending verifications', fmt: 'n', better: 'down', snapshot: true, value: count('ver_pending') },
  { key: 'ver_rate', label: 'Verification completion rate', fmt: 'pct', better: 'up', value: pct('ver_done', ['ver_done', 'ver_pending']) },
  { key: 'ver_turnaround', label: 'Avg verification turnaround', fmt: 'hrs', better: 'down', value: per('ver_hours_sum', 'ver_done') },
  { key: 'ver_followup_freq', label: 'Verification follow-ups per case', fmt: 'avg', better: 'none', value: c => ratio(g(c, 'ver_followups'), g(c, 'ver_done') + g(c, 'ver_pending')) },
  { key: 'ver_overdue', label: 'Overdue verification cases', fmt: 'n', better: 'down', snapshot: true, alert: true, value: count('ver_overdue'), hint: 'Waiting in the Verification Queue for more than 3 days' },
  { key: 'ver_rejected', label: 'Marked not available', fmt: 'n', better: 'none', value: count('ver_rejected') },
];

const hr: MetricDef[] = [
  { key: 'hr_apps', label: 'Applications received', fmt: 'n', better: 'up', value: count('hr_apps') },
  { key: 'hr_shortlisted', label: 'Candidates shortlisted', fmt: 'n', better: 'up', value: count('hr_shortlisted') },
  { key: 'hr_int_sched', label: 'Interviews scheduled', fmt: 'n', better: 'up', value: count('hr_int_sched') },
  { key: 'hr_int_done', label: 'Interviews completed', fmt: 'n', better: 'up', value: count('hr_int_done') },
  { key: 'hr_offers', label: 'Offers released', fmt: 'n', better: 'up', value: count('hr_offers') },
  { key: 'hr_joined', label: 'New employees joined', fmt: 'n', better: 'up', value: count('hr_joined') },
  { key: 'hr_app_to_int', label: 'Application-to-interview', fmt: 'pct', better: 'up', value: pct('hr_int_sched', 'hr_apps') },
  { key: 'hr_int_to_offer', label: 'Interview-to-offer', fmt: 'pct', better: 'up', value: pct('hr_offers', 'hr_int_done') },
  { key: 'hr_accept', label: 'Offer acceptance rate', fmt: 'pct', better: 'up', value: pct('hr_joined', 'hr_offers') },
  { key: 'hr_time_to_hire', label: 'Avg time to hire', fmt: 'days', better: 'down', value: per('hr_hire_days_sum', 'hr_joined') },
  { key: 'hr_stuck', label: 'Candidates stuck 7+ days', fmt: 'n', better: 'down', snapshot: true, alert: true, value: count('hr_stuck') },
  { key: 'hr_calls', label: 'Candidate calls', fmt: 'n', better: 'up', value: count('hr_calls') },
];

const manualOnly: MetricDef[] = [
  { key: 'manual_logged', label: 'Task work logged', fmt: 'n', better: 'up', value: count('manual_logged') },
  { key: 'manual_metrics', label: 'Task metrics worked on', fmt: 'n', better: 'up', value: count('manual_metrics') },
];

export const DEPT_METRICS: Record<DeptKey, MetricDef[]> = {
  telecalling, sales, collection, sourcing, hr, digital: manualOnly, design: manualOnly,
  other: [M.calls_out, M.connected, M.followups_logged, M.unique_leads, M.ontime],
};

/** Headline tiles per department, in reading order. */
export const HEADLINE: Record<DeptKey, string[]> = {
  telecalling: ['calls_out', 'conn_rate', 'first_resp', 'qualified', 'sv_sched', 'ontime', 'neglected', 'crm'],
  sales: ['unique_leads', 'interactions', 'shares', 'visits_done', 'active_nego', 'bookings', 'visit_to_booking', 'stagnant'],
  collection: ['calls_out', 'connected', 'agent_contacts', 'manual_logged'],
  sourcing: ['src_added', 'src_complete', 'src_verified', 'src_success', 'ver_done', 'ver_turnaround', 'ver_pending', 'ver_overdue'],
  hr: ['hr_apps', 'hr_int_sched', 'hr_offers', 'hr_joined', 'hr_app_to_int', 'hr_accept', 'hr_time_to_hire', 'hr_stuck'],
  digital: ['manual_logged', 'manual_metrics'],
  design: ['manual_logged', 'manual_metrics'],
  other: ['calls_out', 'connected', 'followups_logged', 'unique_leads'],
};

/** Metrics behind the performance score and the radar, with their weight. */
export const SCORE_METRICS: Record<DeptKey, [string, number][]> = {
  telecalling: [['calls_out', 1], ['conn_rate', 1], ['first_resp', 1], ['ontime', 1], ['qualified', 2], ['sv_sched', 3], ['sv_attendance', 2], ['crm', 1]],
  sales: [['unique_leads', 1], ['interactions', 1], ['shares', 1], ['visits_done', 2], ['visit_to_nego', 2], ['bookings', 3], ['ontime', 1], ['stagnant', 1]],
  collection: [['calls_out', 1], ['manual_logged', 2]],
  sourcing: [['src_added', 3], ['src_complete', 2], ['src_verified', 2], ['ver_done', 2], ['ver_turnaround', 1]],
  hr: [['hr_apps', 1], ['hr_int_sched', 2], ['hr_offers', 2], ['hr_joined', 3], ['hr_time_to_hire', 1]],
  digital: [['manual_logged', 1]],
  design: [['manual_logged', 1]],
  other: [['calls_out', 1], ['followups_logged', 1]],
};

export function compute(def: MetricDef, c: Counters | undefined, workingDays: number) {
  if (!c) return null;
  const v = def.value(c, { workingDays });
  return v === null || !Number.isFinite(v) ? null : v;
}

export const median = (values: number[]) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Share of peers this value beats (ties count half), 0–100, respecting the direction. */
export function percentile(value: number, peers: number[], better: Better) {
  if (peers.length < 2) return null;
  let beats = 0;
  for (const p of peers) {
    if (p === value) beats += 0.5;
    else if (better === 'down' ? value < p : value > p) beats += 1;
  }
  // Exclude the person themself, who ties with their own value.
  return Math.round(((beats - 0.5) / (peers.length - 1)) * 100);
}

export function addCounters(target: Counters, source: Counters | undefined) {
  if (!source) return target;
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + (Number(v) || 0);
  return target;
}
