// The Scheduler gathers every module's follow-ups in one place. Each module
// is read through its own list endpoint and sorted into the same buckets its
// Action Required tab used (Overdue, Yesterday, Today, Tomorrow, Later), so
// who sees what and what counts as due are unchanged.

import { ACTION_FILTERS, type ActionFilter } from "./action-filters";
import { matchesHrActionFilter } from "./hr-action-required";
import { matchesInboundActionFilter } from "./inbound-action-required";

export type ScheduleModule = "lead" | "inbound" | "agent" | "hr";
export type ScheduleMode = "pending" | "completed";

export const SCHEDULE_MODULES: { value: ScheduleModule; label: string; dot: string }[] = [
  { value: "lead", label: "Leads", dot: "bg-emerald-500" },
  { value: "inbound", label: "Inbound", dot: "bg-cyan-500" },
  { value: "agent", label: "Agents", dot: "bg-indigo-500" },
  { value: "hr", label: "HR", dot: "bg-rose-500" },
];

/** A bucket and, for Today, whether it lists follow-ups to do or done. */
export type ScheduleView = { bucket: ActionFilter; mode: ScheduleMode };

/** Every view a count is shown for: Today appears twice, once per mode. */
export const SCHEDULE_VIEWS: ScheduleView[] = ACTION_FILTERS.flatMap((bucket): ScheduleView[] =>
  bucket === "Today" ? [{ bucket, mode: "pending" }, { bucket, mode: "completed" }] : [{ bucket, mode: "pending" }],
);

export const viewKey = ({ bucket, mode }: ScheduleView) => (bucket === "Today" ? `${bucket}:${mode}` : bucket);

/** Yesterday and Today's "Followed up" list contacts already made. */
export const isDoneView = ({ bucket, mode }: ScheduleView) => bucket === "Yesterday" || (bucket === "Today" && mode === "completed");

export interface ScheduleItem {
  module: ScheduleModule;
  id: number;
  code: string;
  name: string;
  mobile: string;
  staff: string;
  status: string;
  priority: string;
  nextDate: string | null;
  nextTime: string | null;
  doneDate: string | null;
  doneTime: string | null;
  href: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- module lists arrive as loose API JSON */

const day = (value?: string | null) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
// Midnight is what an untimed follow-up was saved with, not a real time.
const hhmm = (value?: string | null) => (value && !String(value).startsWith("00:00") ? String(value).slice(0, 5) : null);

export function leadItem(l: any): ScheduleItem {
  return {
    module: "lead",
    id: l.rawId,
    code: l.id,
    name: l.name || "—",
    mobile: l.mobile || "",
    staff: l.staff || "Unassigned",
    status: l.status || "",
    priority: l.priority || "",
    nextDate: day(l.nextFollowUpDate),
    nextTime: hhmm(l.nextFollowUpTime),
    doneDate: day(l.lastFollowedUpDate),
    doneTime: hhmm(l.lastFollowedUpTime),
    href: `/leads/${l.rawId}`,
  };
}

export function inboundItem(r: any): ScheduleItem {
  return {
    module: "inbound",
    id: r.id,
    code: r.propertyId || r.property_id || `#${r.id}`,
    name: r.owner_name || r.property_title || "—",
    mobile: r.mobile_number || "",
    staff: r.assigned?.name || "Unassigned",
    status: r.status || "",
    priority: "",
    nextDate: day(r.nextFollowUpDate),
    nextTime: hhmm(r.nextFollowUpTime),
    doneDate: day(r.lastFollowedUpDate),
    doneTime: hhmm(r.lastFollowedUpTime),
    href: `/inbound/${r.id}`,
  };
}

export function agentItem(a: any): ScheduleItem {
  return {
    module: "agent",
    id: a.id,
    code: `A${String(a.id).padStart(5, "0")}`,
    name: a.name || "—",
    mobile: a.mobile || "",
    staff: a.staff || "Unassigned",
    status: a.status || "",
    priority: "",
    nextDate: day(a.nextFollowUpDate),
    nextTime: hhmm(a.nextFollowUpTime),
    doneDate: day(a.lastFollowedUpDate),
    doneTime: hhmm(a.lastFollowedUpTime),
    href: `/agent-network/${a.id}`,
  };
}

export function candidateItem(c: any): ScheduleItem {
  return {
    module: "hr",
    id: c.id,
    code: "HRC" + String(c.id).padStart(4, "0"),
    name: c.name || "—",
    mobile: c.mobile || "",
    staff: c.assignedStaff?.name || "Unassigned",
    status: c.status || "",
    priority: "",
    nextDate: day(c.nextFollowUpDate),
    nextTime: hhmm(c.nextFollowUpTime),
    doneDate: day(c.lastFollowedUpDate),
    doneTime: hhmm(c.lastFollowedUpTime),
    href: `/hr/${c.id}`,
  };
}

/** Whether a whole-list module's record belongs in a view, by that module's own rules. */
export function inView(module: Exclude<ScheduleModule, "lead">, record: any, view: ScheduleView, now = new Date()) {
  if (module === "inbound") return matchesInboundActionFilter(record, view.bucket, view.mode, now);
  if (module === "hr") return !["Joined", "Rejected"].includes(record.status) && matchesHrActionFilter(record, view.bucket, view.mode, now);
  return matchesHrActionFilter(record, view.bucket, view.mode, now);
}

/** Due first for to-dos, most recent first for contacts made. */
export function sortItems(items: ScheduleItem[], done: boolean) {
  const at = (i: ScheduleItem) => (done ? `${i.doneDate ?? ""} ${i.doneTime ?? ""}` : `${i.nextDate ?? ""} ${i.nextTime ?? "99:99"}`);
  return [...items].sort((a, b) => (done ? at(b).localeCompare(at(a)) : at(a).localeCompare(at(b))));
}

/** "5 Nov · 2:30 PM", without the year when it's this year. */
export function formatWhen(date: string | null, time: string | null, now = new Date()) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(y === now.getFullYear() ? {} : { year: "numeric" }),
  });
  if (!time) return label;
  const [h, min] = time.split(":").map(Number);
  return `${label} · ${h % 12 || 12}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Whether an item matches what was typed in the scheduler's search: its
 * name, ID (HRC0012, with or without the prefix and zeros) or phone number
 * (spaces, dashes and +91 ignored).
 */
export function matchesScheduleSearch(item: Pick<ScheduleItem, "name" | "code" | "mobile">, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q)) return true;
  const idDigits = q.match(/^[a-z#]*0*(\d+)$/)?.[1];
  if (idDigits && item.code && item.code.replace(/^\D+0*/, "") === idDigits) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 3 && /^[+\d\s()-]+$/.test(q) && (item.mobile ?? "").replace(/\D/g, "").includes(digits.length > 10 ? digits.slice(-10) : digits);
}
