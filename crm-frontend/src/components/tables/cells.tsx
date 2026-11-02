import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NameAvatar } from "@/components/shared/name-avatar";

// Shared cell renderers so every module's list table reads the same way as
// Leads: muted record ID first, a bold primary name, status as a coloured dot,
// and dates in one format at the end.

/** Record ID, muted; links to the record when `href` is given. */
export function IdCell({ href, children }: { href?: string; children: ReactNode }) {
  const cls = "tabular-nums text-muted-foreground";
  if (!href) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} className={cn(cls, "hover:text-foreground hover:underline")}>
      {children}
    </Link>
  );
}

/** Primary column: the record's name, optionally with a letter avatar. */
export function NameCell({ name, avatar = false, sub, className }: { name?: ReactNode; avatar?: boolean; sub?: ReactNode; className?: string }) {
  const label = name ?? <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {avatar && <NameAvatar name={typeof name === "string" ? name : undefined} />}
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{label}</span>
        {sub && <span className="block truncate text-[12px] text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}

const TONES = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  gray: "bg-gray-400",
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

export function statusTone(status?: string): StatusTone {
  return TONE_BY_WORD[status?.trim().toLowerCase() ?? ""] ?? "gray";
}

/** Status as a coloured dot and its label. Pass `tone` or `dotClass` to override the guess. */
export function StatusCell({ status, tone, dotClass }: { status?: string; tone?: StatusTone; dotClass?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn("size-2 shrink-0 rounded-full", dotClass ?? TONES[tone ?? statusTone(status)])} />
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
