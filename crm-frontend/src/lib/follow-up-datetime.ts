// follow-up-datetime.ts
export function formatFollowUpDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFollowUpTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours < 0 || hours > 23) return '';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${minutes} ${suffix}`;
}

export function formatFollowUpDateTime(dateStr: string, timeStr?: string | null): string {
  const datePart = formatFollowUpDate(dateStr);
  const timePart = formatFollowUpTime(timeStr);
  return timePart ? `${datePart} · ${timePart}` : datePart;
}
