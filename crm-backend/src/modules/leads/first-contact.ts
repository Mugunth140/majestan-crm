import { CLOSED_STATUSES } from '../dashboard/sql';
import { IST_OFFSET_MIN, RESPONSE_SLA_MIN, WORK_END_MIN, WORK_START_MIN } from '../dashboard/range';

/**
 * A lead "waits for first contact" from the moment it is assigned until its
 * owner logs a call, message, email, share or follow-up on it. The database
 * keeps `leads.assigned_at` and `leads.first_contacted_at` current through
 * triggers (migration 085), so a new owner always starts a new wait.
 */

/** Statuses that never wait: the lead is finished, lost or handed on. */
export const FIRST_CONTACT_DONE_STATUSES = [...CLOSED_STATUSES, 'Converted'];

/** Working minutes before the owner is reminded, and before their team lead is told. */
export const FIRST_CONTACT_SLA_MIN = RESPONSE_SLA_MIN;
export const FIRST_CONTACT_ESCALATE_MIN = RESPONSE_SLA_MIN * 2;

/** The SQL condition (alias `l`) for a lead still waiting for its owner's first contact. */
export function waitingSql(alias = 'l'): string {
  const done = FIRST_CONTACT_DONE_STATUSES.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ');
  return `(${alias}.assigned_staff_id IS NOT NULL AND ${alias}.assigned_at IS NOT NULL AND ${alias}.first_contacted_at IS NULL
    AND ${alias}.converted_to IS NULL AND ${alias}.is_unqualified = 0 AND COALESCE(${alias}.status, 'New Lead') NOT IN (${done}))`;
}

const DAY_MS = 86_400_000;
const EPOCH_MONDAY = Date.UTC(2024, 0, 1); // 1 Jan 2024 is a Monday

/** Working minutes (9:00–18:30 IST, Monday–Saturday) from a fixed Monday up to `at`. */
function workMinutesUpTo(at: Date): number {
  const ist = at.getTime() + IST_OFFSET_MIN * 60_000;
  const days = Math.floor((ist - EPOCH_MONDAY) / DAY_MS);
  const minute = Math.floor((ist - EPOCH_MONDAY - days * DAY_MS) / 60_000);
  const perDay = WORK_END_MIN - WORK_START_MIN;
  const sunday = ((days % 7) + 7) % 7 === 6;
  const today = sunday ? 0 : Math.min(Math.max(minute - WORK_START_MIN, 0), perDay);
  return (days - Math.floor(days / 7)) * perDay + today;
}

/** Working minutes between two moments; nights and Sundays don't count. Never negative. */
export function workMinutesBetween(from: Date, to: Date): number {
  return Math.max(0, workMinutesUpTo(to) - workMinutesUpTo(from));
}
