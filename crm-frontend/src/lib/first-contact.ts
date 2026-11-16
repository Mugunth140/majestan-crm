/**
 * How long a lead has waited for its owner's first contact. Only working time
 * counts (9:00–18:30 IST, Monday–Saturday), the same clock the dashboard uses
 * for "time to first contact" and the server uses for reminders.
 */
const IST_OFFSET_MIN = 330;
const WORK_START_MIN = 9 * 60;
const WORK_END_MIN = 18 * 60 + 30;
const PER_DAY = WORK_END_MIN - WORK_START_MIN;
const DAY_MS = 86_400_000;
const EPOCH_MONDAY = Date.UTC(2024, 0, 1); // 1 Jan 2024 is a Monday

/** Working minutes before a wait turns amber, and before it turns red (the reminder hour). */
export const WAIT_FRESH_MIN = 15;
export const WAIT_SLA_MIN = 60;

function workMinutesUpTo(at: Date): number {
  const ist = at.getTime() + IST_OFFSET_MIN * 60_000;
  const days = Math.floor((ist - EPOCH_MONDAY) / DAY_MS);
  const minute = Math.floor((ist - EPOCH_MONDAY - days * DAY_MS) / 60_000);
  const sunday = ((days % 7) + 7) % 7 === 6;
  const today = sunday ? 0 : Math.min(Math.max(minute - WORK_START_MIN, 0), PER_DAY);
  return (days - Math.floor(days / 7)) * PER_DAY + today;
}

/** Working minutes between two moments; nights and Sundays don't count. */
export function workMinutesBetween(from: Date | string, to: Date | string): number {
  const a = new Date(from), b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, workMinutesUpTo(b) - workMinutesUpTo(a));
}

export type WaitTone = "fresh" | "due" | "late";

/** Green inside the first 15 working minutes, amber up to the hour, red after. */
export function waitTone(minutes: number): WaitTone {
  return minutes < WAIT_FRESH_MIN ? "fresh" : minutes < WAIT_SLA_MIN ? "due" : "late";
}

/** "12m", "2h 10m", "3d" — days are working days of 9½ hours. */
export function formatWait(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m}m`;
  if (m < PER_DAY) {
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  return `${Math.floor(m / PER_DAY)}d`;
}
