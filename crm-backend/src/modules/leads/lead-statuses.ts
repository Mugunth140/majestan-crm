/**
 * Lead statuses that never queue for action — neither in the follow-up
 * queues (Overdue/Today/Tomorrow/Scheduled) nor in the unassigned routing
 * queue. They stay visible in search, the full list, and any explicit
 * status filter so staff can still find and revive them.
 */
export const NON_QUEUEABLE_LEAD_STATUSES = ['Not Interested', 'Dropped'];

/**
 * Statuses at or beyond the site visit. A telecalling lead set to any of these
 * belongs to Sales, even when the site visit status was skipped.
 */
export const SALES_PIPELINE_STATUSES = [
  'Site Visit Completed',
  'Re Visit Scheduled',
  'Re Visit Completed',
  'Negotiation',
  'Booking Advance',
  'Agreement',
  'Closed Won',
];
