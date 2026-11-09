"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, ImagePlus, PencilLine, Sparkles, UserMinus, UserPlus } from "lucide-react";
import { formatIndianCurrencyShort } from "@/lib/indian-currency";
import { Value, Who, change, pretty, sortNewestFirst, type FeedItem } from "@/components/record/feed";
import { cn } from "@/lib/utils";

/** One entry of a record's Activity (GET /<module>/:id/activity). */
export type ActivityEntry = {
  id: string;
  kind: string;
  at: string;
  actor: { id: number; name: string } | null;
  field: string | null;
  from: string | null;
  to: string | null;
  meta: Record<string, unknown> | null;
};

/** How a module words its history. */
export type ActivityWords = {
  /** "inbound", "agent". */
  noun: string;
  /** Column → words used in a sentence ("monthly rent"). */
  labels: Record<string, string>;
  /** Columns holding rupees, shown as ₹15k. */
  money?: Set<string>;
  /** Columns whose stored value needs rewording (e.g. option keys to labels). */
  format?: (field: string, value: string | null) => string | null;
  statusDot: (status: string) => string;
  /** Wording for the module's own event kinds; null falls back to the defaults. */
  extra?: (e: ActivityEntry, actor: ReactNode, base: Pick<FeedItem, "key" | "at">) => FeedItem | null;
};

const money = (v: string | null) => (v && !isNaN(Number(v)) ? formatIndianCurrencyShort(Number(v)) : v);
/** Lists are stored as JSON. */
const list = (v: string | null) => {
  if (!v?.startsWith("[")) return v;
  try { return (JSON.parse(v) as string[]).join(", ") || null; } catch { return v; }
};

function toItem(e: ActivityEntry, w: ActivityWords): FeedItem {
  const actor = <Who>{e.actor?.name ?? "System"}</Who>;
  const base = { key: e.id, at: new Date(e.at) };
  const own = w.extra?.(e, actor, base);
  if (own) return own;

  const label = w.labels[e.field ?? ""] ?? pretty(e.field) ?? "a field";
  const Status = ({ name }: { name: string | null }) =>
    name ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-foreground">
        <span className={cn("h-2 w-2 rounded-full", w.statusDot(name))} />
        {name}
      </span>
    ) : <Value>none</Value>;
  const shown = (v: string | null) => {
    const field = e.field ?? "";
    if (w.money?.has(field)) return money(v);
    return w.format ? w.format(field, list(v)) : list(v);
  };

  switch (e.kind) {
    case "created":
      return { ...base, icon: <Sparkles />, title: e.actor ? <>{actor} added this {w.noun}</> : <>{w.noun[0].toUpperCase() + w.noun.slice(1)} added</> };
    case "status_changed":
      return { ...base, icon: <ArrowRightLeft />, title: <>{actor} changed status from <Status name={e.from} /> to <Status name={e.to} /></> };
    case "field_changed":
      if (e.meta?.hidden) return { ...base, icon: <PencilLine />, title: <>{actor} updated the {label}</> };
      return { ...base, icon: <PencilLine />, title: change(actor, label, shown(e.from), shown(e.to)) };
    case "assigned":
      return {
        ...base, icon: <UserPlus />,
        title: e.from
          ? <>{actor} reassigned the {w.noun} from <Value>{e.from}</Value> to <Value>{e.to}</Value></>
          : <>{actor} assigned the {w.noun} to <Value>{e.to}</Value></>,
      };
    case "unassigned":
      return { ...base, icon: <UserMinus />, title: <>{actor} unassigned the {w.noun}{e.from ? <> (was <Value>{e.from}</Value>)</> : null}</> };
    case "photo_added":
      return { ...base, icon: <ImagePlus />, title: <>{actor} added a photo</> };
    case "photo_replaced":
      return { ...base, icon: <ImagePlus />, title: <>{actor} replaced the photo</> };
    default:
      return { ...base, icon: <PencilLine />, title: <>{actor} updated the {w.noun}</> };
  }
}

export function activityItems(entries: ActivityEntry[], words: ActivityWords): FeedItem[] {
  // The actor's photo (or initials) leads each entry they made.
  return sortNewestFirst(entries.map((e) => ({ ...toItem(e, words), ...(e.actor && { who: e.actor.name, whoId: e.actor.id }) })));
}
