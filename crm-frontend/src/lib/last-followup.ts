// last-followup.ts
import { formatFollowUpDateTime } from "./follow-up-datetime";
import { timeAgo } from "./time-ago";

export type LastFollowupRow = {
  rawId: number | string;
  lastFollowedUpDate: string | null;
  lastFollowedUpTime?: string | null;
  lastFollowedUpNotes?: string | null;
};

const TIME_RE = /^(\d{1,2}):(\d{2})/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A zoneless ISO stamp, which the Date constructor reads as local time, plus
 * the bare HH:mm half. Handing these to formatFollowUpDateTime is what keeps
 * the title on the stored day: a bare "YYYY-MM-DD" is UTC, and reads as the
 * previous day west of Greenwich.
 */
function localStamp(at: Date): { date: string; time: string } {
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  return { date: `${day}T${time}:00`, time };
}

/**
 * The follow-up date and time live in two separate MySQL columns (DATE and
 * TIME), so the hour has to be grafted onto the date by hand. Anything that
 * does not resolve to a real calendar moment yields null so the cell can fall
 * back to "no follow-up" instead of rendering "NaNd ago".
 */
export function followUpTimestamp(
  date: string | null | undefined,
  time: string | null | undefined,
): Date | null {
  if (!date) return null;

  // A bare "YYYY-MM-DD" is read by the Date constructor as UTC midnight, which
  // is the previous day for anyone west of Greenwich. Build the local date the
  // calendar actually means, then keep an ISO timestamp's own day by dropping
  // any "T…" tail.
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const at = new Date(year, month - 1, day);
  if (Number.isNaN(at.getTime())) return null;
  // Date rolls impossible days forward (31 Feb becomes 17 Mar), so confirm the
  // parts survived rather than trusting a merely non-NaN result.
  if (at.getFullYear() !== year || at.getMonth() !== month - 1 || at.getDate() !== day) {
    return null;
  }

  const match = time ? TIME_RE.exec(String(time).trim()) : null;
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    // An out-of-range time is treated as absent rather than as a rollover, the
    // same way formatFollowUpTime drops it.
    if (hours <= 23 && minutes <= 59) at.setHours(hours, minutes, 0, 0);
  }

  return at;
}

export type LastFollowupView =
  | { state: "none" }
  | {
      state: "ready";
      label: string;
      absolute: string;
      notes: string | null;
      href: string;
    };

export function lastFollowupView(row: LastFollowupRow): LastFollowupView {
  const at = followUpTimestamp(row.lastFollowedUpDate, row.lastFollowedUpTime);
  if (!at) return { state: "none" };

  const notes = (row.lastFollowedUpNotes ?? "").trim();
  // Formatted from the resolved local timestamp rather than the raw columns, so
  // the title and the label can never disagree about which day this was.
  const stamp = localStamp(at);

  return {
    state: "ready",
    label: timeAgo(at.toISOString()),
    absolute: formatFollowUpDateTime(stamp.date, stamp.time),
    notes: notes || null,
    href: `/leads/${row.rawId}?tab=followups`,
  };
}
