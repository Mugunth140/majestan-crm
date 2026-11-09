import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NameAvatar } from "@/components/shared/name-avatar";

// Shared cell renderers so every module's list table reads the same way as
// Leads: muted record ID first, a bold primary name, status as a tinted pill,
// and dates in one format at the end.

/** Record ID, muted; links to the record when `href` is given. */
/** The record's ID: opens its page (`href`), or its edit form (`onClick`) where there's no page. */
export function IdCell({ href, onClick, children }: { href?: string; onClick?: () => void; children: ReactNode }) {
  const cls = "tabular-nums text-muted-foreground";
  const link = cn(cls, "hover:text-foreground hover:underline");
  if (href) {
    return (
      <Link href={href} onClick={(e) => e.stopPropagation()} className={link}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className={link}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}

/**
 * Primary column: the record's name, optionally with a letter avatar. With
 * `staffId`, the name is a staff member and shows their profile photo.
 */
export function NameCell({ name, avatar = false, image, staffId, sub, className }: { name?: ReactNode; avatar?: boolean; image?: string | null; staffId?: number | null; sub?: ReactNode; className?: string }) {
  const label = name ?? <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {avatar && <NameAvatar name={typeof name === "string" ? name : undefined} src={image} userId={staffId} staff={staffId !== undefined} />}
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{label}</span>
        {sub && <span className="block truncate text-[12px] text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}

// Soft tinted pill per tone: pale fill with strong text in light mode, a deep
// tint with bright text in dark mode.
const TONES = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  gray: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
} as const;
export type StatusTone = keyof typeof TONES;

// Common status words across modules; anything else falls back to grey.
const TONE_BY_WORD: Record<string, StatusTone> = {
  active: "green", published: "green", approved: "green", available: "green", live: "green", completed: "green", converted: "green", selected: "green", hired: "green", joined: "green",
  new: "blue", open: "blue", submitted: "blue", scheduled: "blue", "in progress": "blue", ongoing: "blue",
  pending: "amber", draft: "amber", review: "amber", "under review": "amber", hold: "amber", "on hold": "amber", booked: "violet", reserved: "violet", sold: "violet",
  inactive: "gray", archived: "gray", expired: "gray", closed: "gray",
  rejected: "red", dropped: "red", cancelled: "red", failed: "red", blocked: "red", "not interested": "red",
};

const TONE_DOTS: Record<StatusTone, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  gray: "bg-gray-400",
};

/** The tinted pill classes (bg + text) for a status, as the tables show it. */
export function statusPillClass(status?: string, tone?: StatusTone) {
  return TONES[tone ?? statusTone(status)];
}

/** Solid dot for a status, for group and kanban column headers. */
export function statusDot(status?: string, tone?: StatusTone) {
  return TONE_DOTS[tone ?? statusTone(status)];
}

export function statusTone(status?: string): StatusTone {
  return TONE_BY_WORD[status?.trim().toLowerCase() ?? ""] ?? "gray";
}

/** Status as a tinted pill. Pass `tone` or `pillClass` (bg + text classes) to override the guess. */
export function StatusCell({ status, tone, pillClass }: { status?: string; tone?: StatusTone; pillClass?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium leading-none",
        pillClass ?? TONES[tone ?? statusTone(status)],
      )}
    >
      {status}
    </span>
  );
}

/** On/off records (masters, users, builders). */
export function ActiveCell({ active }: { active?: boolean }) {
  return <StatusCell status={active ? "Active" : "Inactive"} tone={active ? "green" : "gray"} />;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
const TIME_FMT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" };

/** "3 Nov 2026" (optionally with time), the format Leads uses. */
export function formatTableDate(value?: string | number | Date | null, withTime = false) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  const date = d.toLocaleDateString("en-GB", DATE_FMT);
  return withTime ? `${date} ${d.toLocaleTimeString("en-GB", TIME_FMT)}` : date;
}

export function DateCell({ value, withTime }: { value?: string | number | Date | null; withTime?: boolean }) {
  const text = formatTableDate(value, withTime);
  return <span className="whitespace-nowrap tabular-nums text-muted-foreground">{text || "—"}</span>;
}
