/**
 * The targets a department can be given. Anything the CRM already records is
 * tracked automatically; only work that leaves no trace in the CRM is logged by hand.
 * The catalog, not the stored target row, decides how a metric is tracked, so a
 * metric that becomes automatic starts counting for existing targets too.
 */

export type MetricDef = {
  key: string;
  label: string;
  value_type: 'count' | 'amount';
  tracking_type: 'auto' | 'manual';
  /** What gets counted, in the words staff see. */
  source: string;
};

const auto = (key: string, label: string, source: string): MetricDef => ({ key, label, value_type: 'count', tracking_type: 'auto', source });
const manual = (key: string, label: string, source = 'Logged by hand from the Tasks page', value_type: 'count' | 'amount' = 'count'): MetricDef =>
  ({ key, label, value_type, tracking_type: 'manual', source });

const CALLS = 'Every call from the call logger or logged in the CRM';
const CONNECTED = 'Calls with talk time, from the call logger';
const TALK = 'Total talk time of logged calls, in minutes';
const FOLLOW_UPS = 'Follow-ups you record on leads, partners and listings';
const statusMove = (status: string) => `Leads you move to ${status}, once per lead each month`;

export const DEPARTMENT_METRICS: Record<string, MetricDef[]> = {
  telecalling: [
    auto('call_count', 'Calls made', CALLS),
    auto('connected_calls', 'Connected calls', CONNECTED),
    auto('talk_minutes', 'Talk time (minutes)', TALK),
    auto('leads_contacted', 'Leads contacted', 'Each lead you call, message or follow up, once a month'),
    auto('followups_done', 'Follow-ups logged', FOLLOW_UPS),
    auto('opportunity', 'Opportunity', statusMove('Qualified or Interested')),
    auto('sv_schedule', 'SV Schedule', statusMove('Site Visit Scheduled')),
    auto('sv_done', 'SV Done', statusMove('Site Visit Completed')),
    auto('rejection', 'Rejection', statusMove('Dropped, Lost or Not Interested')),
  ],
  sales: [
    auto('call_count', 'Calls made', CALLS),
    auto('connected_calls', 'Connected calls', CONNECTED),
    auto('followups_done', 'Follow-ups logged', FOLLOW_UPS),
    auto('sv_done', 'Site Visit Done', statusMove('Site Visit Completed')),
    auto('rsv_schedule', 'RSV Schedule', statusMove('Re Visit Scheduled')),
    auto('rsv_done', 'RSV Done', statusMove('Re Visit Completed')),
    auto('prospective', 'Prospective', statusMove('Negotiation')),
    auto('booked', 'Booked', statusMove('Booking Advance, Agreement or Closed Won')),
    auto('dropped', 'Dropped', statusMove('Dropped, Lost or Not Interested')),
    manual('target_amount', 'Target Amount', 'Booking value, logged by hand', 'amount'),
    auto('sourcing', 'Sourcing', 'New leads created and assigned to you'),
    auto('validation', 'Validation', statusMove('Qualified')),
    auto('verification', 'Verification', statusMove('Property Shared')),
  ],
  collection: [
    auto('collection_calls', 'Collection Calls Made', CALLS),
    auto('connected_calls', 'Connected calls', CONNECTED),
    auto('customers_contacted', 'Customers Contacted', 'Each customer, partner or listing owner you contact, once a month'),
    auto('payment_followups', 'Payment Follow-ups', FOLLOW_UPS),
    manual('payment_confirmations', 'Payment Confirmations'),
    auto('receipts_uploaded', 'Collection Receipts Uploaded', 'Receipts uploaded to this task'),
  ],
  designing: [
    manual('posters', 'Poster'),
    manual('reels', 'Reels'),
    manual('videos', 'Videos'),
  ],
  digital: [
    manual('listings', 'Listing'),
    manual('likes', 'Likes'),
    manual('reviews', 'Reviews'),
    manual('lead_generation', 'Lead Generation'),
  ],
  sourcing: [
    auto('properties_sourced', 'Properties Sourced', 'Listings you add to Inbound'),
    auto('documents_collected', 'Listings With Documents', 'Listings you add with documents collected'),
    auto('verifications_done', 'Verifications Done', 'Listings you move to Verification Done, once each'),
    auto('verification_calls', 'Verification Calls', 'Calls logged on Inbound listings'),
    auto('followups_done', 'Follow-ups logged', FOLLOW_UPS),
    manual('projects_sourced', 'Projects Sourced'),
  ],
  hr: [
    auto('candidates_sourced', 'Candidates Sourced', 'Candidates added and assigned to you'),
    auto('hr_calls', 'Candidate calls', 'Calls logged on candidates'),
    auto('interviews_scheduled', 'Interviews Scheduled', 'Candidates you move to Interview Scheduled, once each'),
    auto('interviews_completed', 'Interviews Completed', 'Candidates you move to Interview Completed, once each'),
    auto('hires_made', 'Hires Made', 'Candidates you move to Joined'),
    manual('attendance_issues', 'Attendance Issues Resolved'),
    manual('trainings_conducted', 'Trainings Conducted'),
  ],
};

/** The catalog key for a department name ("Telecalling Department" → telecalling). */
export function departmentKey(deptName: string): string | null {
  const key = deptName.toLowerCase().trim().replace(/\s+(department|dept)$/i, '').trim();
  if (key.includes('digital')) return 'digital';
  if (key === 'hr' || key.startsWith('human resource')) return 'hr';
  // Finance, CRM and Collection are one team; Design is stored as Designing.
  if (/finance|crm|collection/.test(key)) return 'collection';
  if (key.startsWith('design')) return 'designing';
  if (/sourcing|inbound/.test(key)) return 'sourcing';
  return DEPARTMENT_METRICS[key] ? key : null;
}

const BY_KEY = new Map(Object.values(DEPARTMENT_METRICS).flat().map(d => [d.key, d]));

/** The catalog entry for a metric key, whatever department it was set for. */
export const metricDef = (key: string) => BY_KEY.get(key);

/** How a stored target is tracked today: the catalog wins over what was saved. */
export const trackingOf = (key: string, stored: string) => BY_KEY.get(key)?.tracking_type ?? (stored === 'auto' ? 'auto' : 'manual');
