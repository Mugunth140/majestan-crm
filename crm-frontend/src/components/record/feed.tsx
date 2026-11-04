"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { feedDay, feedFullTime, feedTime } from "@/lib/feed-time";

// The activity list behind the Timeline and Conversation tabs, after Frappe
// CRM's: plain icons on a thin rail, one sentence per entry with the time on
// the right, then the entry's content (a note box, an email card, a call card
// or a message bubble).

export type FeedItem = {
  key: string;
  at: Date;
  icon: ReactNode;
  /** Colour for the rail icon when it should stand out (a missed call). */
  iconClass?: string;
  /** Shows this person's initials before the sentence. */
  who?: string;
  /** Omitted when `extra` carries its own header (an email card). */
  title?: ReactNode;
  /** Plain text in a soft box, like a comment. */
  body?: string | null;
  chips?: ReactNode[];
  /** Extra controls next to the time (edit, retry…). */
  actions?: ReactNode;
  /** Richer content under the sentence (email card, call card, bubble…). */
  extra?: ReactNode;
};

const TONES = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

/** A person's photo, or their initials on a colour picked from the name. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  // eslint-disable-next-line @next/next/no-img-element -- CDN photo, already small
  if (src) return <img src={src} alt="" className={cn("h-6 w-6 shrink-0 rounded-full bg-muted object-cover", className)} />;
  return (
    <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold", TONES[hash % TONES.length], className)}>
      {initials}
    </span>
  );
}

/** A raised card for an email or a call, a step lighter than the page in dark mode. */
export const CARD = "rounded-lg border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-white/[0.03]";

/** A small grey badge on an entry (priority, next date, call length…), like Frappe's subtle Badge. */
export const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-5 items-center gap-1 rounded-[5px] bg-foreground/[0.07] px-1.5 text-[12px] font-medium tracking-normal text-foreground/75 [&_svg]:h-3 [&_svg]:w-3">
    {children}
  </span>
);

/** An entry's time: "40 mins ago" within the hour, then "4:50 PM"; the full date on hover. */
export const FeedTime = ({ at, className }: { at: Date; className?: string }) => (
  <time dateTime={at.toISOString()} title={feedFullTime(at)} className={cn("whitespace-nowrap text-[13px] text-muted-foreground", className)}>
    {feedTime(at)}
  </time>
);

/** Consecutive entries that fall on the same calendar day, in the order given. */
function byDay(items: FeedItem[]) {
  const days: { label: string; items: FeedItem[] }[] = [];
  for (const item of items) {
    const label = feedDay(item.at);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }
  return days;
}

/** The row above a tab's content: its name, and the action that adds to it. */
export function TabHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mx-3 my-3 flex items-center justify-between gap-3 sm:mx-10 sm:mb-4 sm:mt-8">
      <h2 className="flex h-8 items-center text-[18px] font-semibold tracking-[0.01em] text-foreground">{title}</h2>
      {action}
    </div>
  );
}

// Measurements follow Frappe CRM's activity list: a 30px rail, 16px gap, 40px
// side margins, 14px text with a touch of tracking, 13px grey timestamps.
// Entries are split by day like a chat: a date pill ("Today", "Yesterday",
// "26th Oct") heads each day, and each entry shows only its time.
export function Feed({ items }: { items: FeedItem[] }) {
  return (
    <div className="text-[14px] tracking-[0.02em]">
      {byDay(items).map((day) => (
        <section key={`${day.label}-${day.items[0].key}`} aria-label={day.label}>
          <div className="mb-3 flex items-center gap-3 px-3 sm:px-10" role="separator">
            <span className="h-px flex-1 bg-border" />
            <span className="rounded-full border bg-background px-3 py-0.5 text-[12px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {day.label}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <ol>
            {day.items.map((item, idx) => (
              <li key={item.key} className="group/item grid grid-cols-[30px_minmax(0,1fr)] gap-2 px-3 sm:gap-4 sm:px-10">
                <div
                  className={cn(
                    "relative z-0 flex justify-center before:absolute before:left-1/2 before:top-0 before:-z-[1] before:border-l before:border-border",
                    idx === day.items.length - 1 ? "before:h-4" : "before:h-full",
                  )}
                >
                  <span className={cn("flex h-8 w-7 items-center justify-center bg-background text-foreground/85 [&_svg]:h-4 [&_svg]:w-4", item.iconClass)}>
                    {item.icon}
                  </span>
                </div>
                <div className="mb-4 min-w-0">
                  {item.title !== undefined && (
                    <div className="mb-1 flex items-center gap-2 py-1">
                      <div className="inline-flex min-w-0 flex-wrap items-center gap-1 text-muted-foreground">
                        {item.who && <Avatar name={item.who} className="mr-1" />}
                        {item.title}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap">
                        {item.actions}
                        <FeedTime at={item.at} />
                      </div>
                    </div>
                  )}
                  {item.body ? (
                    <div className="rounded-lg bg-foreground/[0.04] px-3 py-[7.5px] leading-6 text-foreground/90 dark:bg-white/[0.05]">
                      <p className="whitespace-pre-wrap">{item.body}</p>
                      {item.chips && item.chips.length > 0 && <div className="mt-1.5 mb-0.5 flex flex-wrap gap-1.5">{item.chips}</div>}
                    </div>
                  ) : item.chips && item.chips.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">{item.chips}</div>
                  ) : null}
                  {item.extra}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export const Who = ({ children }: { children: ReactNode }) => <b className="font-medium text-foreground">{children}</b>;

export const sortNewestFirst = (items: FeedItem[]) =>
  items.filter((i) => !Number.isNaN(i.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());

export const sortOldestFirst = (items: FeedItem[]) => sortNewestFirst(items).reverse();

/** A history value as shown in a sentence: booleans as Yes/No, snake_case as words. */
export const pretty = (v: string | null) => {
  if (v === null || v === "") return null;
  if (v === "1" || v === "true") return "Yes";
  if (v === "0" || v === "false") return "No";
  return v.replace(/_/g, " ");
};

export const Value = ({ children }: { children: ReactNode }) => <span className="font-medium text-foreground">{children}</span>;

/** "Asha changed city from Chennai to Coimbatore", "set …", or "cleared …". */
export function change(actor: ReactNode, label: string, from: string | null, to: string | null) {
  const a = pretty(from);
  const b = pretty(to);
  if (a && b) return <>{actor} changed {label} from <Value>{a}</Value> to <Value>{b}</Value></>;
  if (b) return <>{actor} set {label} to <Value>{b}</Value></>;
  return <>{actor} cleared {label}{a ? <> (was <Value>{a}</Value>)</> : null}</>;
}
