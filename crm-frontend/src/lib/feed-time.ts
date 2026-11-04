import { differenceInCalendarDays, format } from "date-fns";

/**
 * When an entry happened, as the record feeds show it beside each entry:
 * "Just now", "40 mins ago" within the hour, then the clock time ("4:50 PM").
 * The day itself is on the divider above, so the time never repeats it.
 */
export function feedTime(at: Date, now = new Date()): string {
  const mins = Math.floor((now.getTime() - at.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
  return format(at, "h:mm a");
}

/** The divider between days: "Today", "Yesterday", "26th Oct", or "26th Oct 2025" in another year. */
export function feedDay(at: Date, now = new Date()): string {
  const days = differenceInCalendarDays(now, at);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return format(at, at.getFullYear() === now.getFullYear() ? "do MMM" : "do MMM yyyy");
}

/** The full date and time, for the hover title. */
export const feedFullTime = (at: Date) => format(at, "EEE, d MMM yyyy, h:mm a");
