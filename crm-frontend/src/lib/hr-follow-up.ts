export interface HrFollowUpForm {
  followUpDate?: string | null;
  followUpTime?: string | null;
  contactedVia?: string | null;
  nextFollowUpDate?: string | null;
  nextFollowUpTime?: string | null;
  priority?: string | null;
  rnr?: string | null;
  notes?: string | null;
}

/** HR uses snake_case fields; the shared editor and Leads use camelCase. */
export function toHrFollowUpPayload(form: HrFollowUpForm, loggedAt?: Date) {
  const payload: Record<string, string | null> = {};
  const fields = {
    followUpDate: 'follow_up_date', followUpTime: 'follow_up_time',
    contactedVia: 'contacted_via', nextFollowUpDate: 'next_follow_up_date',
    nextFollowUpTime: 'next_follow_up_time', priority: 'priority', rnr: 'rnr', notes: 'notes',
  } as const;
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    if (form[field] !== undefined) payload[fields[field]] = form[field] || null;
  }
  if (loggedAt) {
    // A newly logged follow-up is an actual contact today, like the Leads form.
    // Use the same India calendar as the Action Required filters.
    payload.follow_up_date ??= loggedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    payload.follow_up_time ??= loggedAt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  }
  return payload;
}
