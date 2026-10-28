import { HrFollowUp } from '../../database/entities/hr-follow-up.entity';

// Creation order determines the current schedule, even when a newer entry clears it.
export function summarizeHrFollowUps(history: HrFollowUp[]) {
  const byCreation = [...history].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id,
  );
  const actual = byCreation.filter(entry => entry.follow_up_date).sort((a, b) =>
    b.follow_up_date!.localeCompare(a.follow_up_date!) ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id - a.id,
  );
  return {
    nextFollowUpDate: byCreation[0]?.next_follow_up_date || null,
    nextFollowUpTime: byCreation[0]?.next_follow_up_time || null,
    lastFollowedUpDate: actual[0]?.follow_up_date || null,
    lastFollowedUpTime: actual[0]?.follow_up_time || null,
    // Yesterday, like Leads, checks any actual follow-up rather than only the latest.
    followedUpDates: [...new Set(actual.map(entry => entry.follow_up_date!))],
  };
}
