"use client";

import type { ReactNode } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

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
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return (
    <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold", TONES[hash % TONES.length], className)}>
      {initials}
    </span>
  );
}

/** A small grey label under an entry (priority, next date, call length…). */
export const Chip = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-6 items-center gap-1 rounded-md bg-foreground/[0.06] px-2 text-[12px] font-medium text-foreground/75 [&_svg]:h-3 [&_svg]:w-3">
    {children}
  </span>
);

export const ago = (d: Date) => formatDistanceToNowStrict(d, { addSuffix: true });

export function Feed({ items }: { items: FeedItem[] }) {
  return (
    <ol>
      {items.map((item, idx) => (
        <li key={item.key} className="group/item grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
          <div
            className={cn(
              "relative z-0 flex justify-center before:absolute before:left-1/2 before:top-0 before:-z-[1] before:border-l before:border-border",
              idx === items.length - 1 ? "before:h-4" : "before:h-full",
            )}
          >
            <span className={cn("flex h-8 w-7 items-center justify-center bg-background text-foreground/70 [&_svg]:h-4 [&_svg]:w-4", item.iconClass)}>
              {item.icon}
            </span>
          </div>
          <div className="min-w-0 pb-5">
            {item.title !== undefined && <div className="flex items-start gap-2 py-1 text-[14px] leading-6">
              <p className="inline-flex min-w-0 flex-1 flex-wrap items-center gap-x-1 text-muted-foreground">
                {item.who && <Avatar name={item.who} className="mr-1" />}
                {item.title}
              </p>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {item.actions}
                <time dateTime={item.at.toISOString()} title={format(item.at, "EEE, d MMM yyyy, h:mm a")} className="whitespace-nowrap text-[13px] text-muted-foreground">
                  {ago(item.at)}
                </time>
              </div>
            </div>}
            {item.body && (
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-foreground/[0.045] px-3 py-2 text-[14px] leading-6 text-foreground/90">{item.body}</p>
            )}
            {item.extra && <div className={item.title !== undefined ? "mt-1" : "pt-0.5"}>{item.extra}</div>}
            {item.chips && item.chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.chips}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const Who = ({ children }: { children: ReactNode }) => <b className="font-medium text-foreground">{children}</b>;

export const sortNewestFirst = (items: FeedItem[]) =>
  items.filter((i) => !Number.isNaN(i.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());

export const sortOldestFirst = (items: FeedItem[]) => sortNewestFirst(items).reverse();
