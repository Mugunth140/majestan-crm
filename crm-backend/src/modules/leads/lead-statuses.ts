/**
 * Lead statuses that never queue for action — neither in the follow-up
 * queues (Overdue/Today/Tomorrow/Scheduled) nor in the unassigned routing
 * queue. They stay visible in search, the full list, and any explicit
 * status filter so staff can still find and revive them.
 */
export const NON_QUEUEABLE_LEAD_STATUSES = ['Not Interested', 'Dropped'];
