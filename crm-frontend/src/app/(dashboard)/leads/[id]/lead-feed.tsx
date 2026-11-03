"use client";

import { Fragment, type ReactNode } from "react";
import { format, formatDistanceToNow, isSameDay, isThisYear, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

// The rail used by the Timeline and Conversation tabs, in the style of Frappe
// CRM: an icon on a vertical line, a one-line sentence, then any detail.

export type FeedItem = {
  key: string;
  at: Date;
  icon: ReactNode;
  tone: string;
  title: ReactNode;
  body?: string | null;
  chips?: string[];
  /** Extra controls on the right of the title (edit, retry…). */
  actions?: ReactNode;
  /** Anything else under the title (e.g. a draft's buttons). */
  extra?: ReactNode;
};

const dayLabel = (d: Date) => (isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, isThisYear(d) ? "EEE, d MMM" : "d MMM yyyy"));

/** `days` puts a date divider wherever the day changes (for oldest-first, chat-style lists). */
export function Feed({ items, days = false }: { items: FeedItem[]; days?: boolean }) {
  const newDay = (idx: number) => days && (idx === 0 || !isSameDay(items[idx - 1].at, items[idx].at));
  return (
    <ol className="relative">
      {items.map((item, idx) => (
        <Fragment key={item.key}>
          {newDay(idx) && (
            <li className="flex items-center gap-3 pb-5 pt-1 first:pt-0">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[12px] font-medium text-muted-foreground">{dayLabel(item.at)}</span>
              <span className="h-px flex-1 bg-border" />
            </li>
          )}
          <li className="group/item relative flex gap-3 pb-6 last:pb-0">
            {idx < items.length - 1 && !newDay(idx + 1) && <span aria-hidden className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />}
            <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full [&_svg]:h-3.5 [&_svg]:w-3.5", item.tone)}>
              {item.icon}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[14px] leading-5 text-muted-foreground">{item.title}</p>
                {item.actions}
                <time
                  dateTime={item.at.toISOString()}
                  title={format(item.at, "d MMM yyyy, h:mm a")}
                  className="shrink-0 pt-px text-[12px] text-muted-foreground/80"
                >
                  {days ? format(item.at, "h:mm a") : formatDistanceToNow(item.at, { addSuffix: true })}
                </time>
              </div>
              {item.body && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border bg-muted/30 px-3 py-2 text-[13.5px] leading-relaxed text-foreground/85">
                  {item.body}
                </p>
              )}
              {item.chips && item.chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.chips.map((chip) => (
                    <span key={chip} className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px] font-medium text-foreground/75">
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              {item.extra}
            </div>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

export const Who = ({ children }: { children: ReactNode }) => <b className="font-semibold text-foreground">{children}</b>;

export const sortNewestFirst = (items: FeedItem[]) =>
  items.filter((i) => !Number.isNaN(i.at.getTime())).sort((a, b) => b.at.getTime() - a.at.getTime());

export const sortOldestFirst = (items: FeedItem[]) => sortNewestFirst(items).reverse();
