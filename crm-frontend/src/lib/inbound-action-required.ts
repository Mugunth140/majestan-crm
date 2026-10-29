type InboundFollowUp = {
  follow_up_date?: string | null;
};
type InboundActionRecord = {
  status?: string;
  is_queued?: boolean;
  nextFollowUpDate?: string | null;
  lastFollowedUpDate?: string | null;
  follow_ups?: InboundFollowUp[] | null;
};

const dateKey = (value?: string | null) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

export function matchesInboundActionFilter(
  record: InboundActionRecord,
  filter: string,
  mode: 'pending' | 'completed',
  now = new Date(),
  explicitStatus = '',
): boolean {
  if (record.is_queued) return false;
  if (!explicitStatus && ['Closed', 'Rejected'].includes(record.status || '')) return false;
  const indiaDay = (offset: number) => new Date(now.getTime() + offset * 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = indiaDay(0);
  const next = dateKey(record.nextFollowUpDate);
  const actualDates = Array.isArray(record.follow_ups)
    ? record.follow_ups.map(entry => dateKey(entry.follow_up_date))
    : [dateKey(record.lastFollowedUpDate)];

  switch (filter) {
    case 'Overdue': return next !== null && next < today;
    case 'Yesterday': return actualDates.includes(indiaDay(-1));
    case 'Today': return mode === 'completed'
      ? actualDates.includes(today) && next !== today
      : next === today;
    case 'Tomorrow': return next === indiaDay(1);
    case 'All Scheduled': return next !== null && next > indiaDay(1);
    default: return false;
  }
}
