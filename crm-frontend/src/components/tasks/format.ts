import { inr } from "@/components/dashboard/format";
import type { MetricPace, PaceStatus } from "./types";

const int = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** A target value as people read it: rupees for amounts, whole numbers otherwise. */
export const amount = (unit: MetricPace["unit"], v: number) => (unit === "amount" ? inr(v) : int.format(Math.round(v)));

export const STATUS_META: Record<PaceStatus, { label: string; tone: "good" | "warn" | "bad" | "info" | "muted" }> = {
  done: { label: "Done", tone: "good" },
  ahead: { label: "Ahead", tone: "good" },
  on_pace: { label: "On pace", tone: "info" },
  behind: { label: "Behind", tone: "warn" },
  missed: { label: "Missed", tone: "bad" },
  upcoming: { label: "Planned", tone: "muted" },
};

export const TONE_COLOR = {
  good: "var(--status-good)",
  warn: "var(--status-warn)",
  bad: "var(--status-bad)",
  info: "var(--series-1)",
  muted: "var(--muted-foreground)",
} as const;

const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const shortMonthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
export const monthLabel = (m: string, short = false) => (short ? shortMonthFmt : monthFmt).format(new Date(`${m}-01T00:00:00Z`));

const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const dayLabel = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

/** "Today", "Yesterday" or "4 Nov", in India time, for an ISO instant. */
export function dayGroup(at: string, today: string) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(at));
  if (d === today) return "Today";
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  if (d === y) return "Yesterday";
  return dayLabel(d);
}

export const timeLabel = (at: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(at));

/** Today's date in India time, YYYY-MM-DD. */
export const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** How far ahead or behind a steady pace a metric is, as a sentence fragment. */
export function paceGap(m: MetricPace) {
  const gap = m.achieved - m.expected;
  if (m.status === "done") return "Target reached";
  if (m.status === "upcoming") return "Starts on the 1st";
  if (m.status === "missed") return `Closed ${amount(m.unit, m.remaining)} short`;
  if (Math.abs(gap) < 1) return "Right on pace";
  return gap > 0 ? `${amount(m.unit, gap)} ahead of pace` : `${amount(m.unit, -gap)} behind pace`;
}
