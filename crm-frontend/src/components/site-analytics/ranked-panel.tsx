"use client";
import { useState } from "react";
import { DataCard } from "@/components/record/record-page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { number, percent, unknown } from "@/lib/site-analytics";

export type RankedRow = { label: string; count: number };
export type Ranking = {
  key: string;
  label: string;
  rows: RankedRow[];
  total?: number;
  note?: string;
};
export const CONTROL =
  "rounded-lg border bg-card px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export function RankedPanel({
  title,
  groups,
  formatLabel = (label) => (unknown(label) ? "Unknown" : label),
  chart = false,
  unknownLast = false,
}: {
  title: string;
  groups: Ranking[];
  formatLabel?: (label: string) => string;
  unknownLast?: boolean;
  chart?: boolean;
}) {
  const [selected, setSelected] = useState(groups[0]?.key ?? "");
  const [open, setOpen] = useState(false);
  const group = groups.find((g) => g.key === selected) ?? groups[0];
  const rows = [...(group?.rows ?? [])]
    .sort((a, b) =>
      unknownLast && unknown(a.label) !== unknown(b.label)
        ? unknown(a.label)
          ? 1
          : -1
        : b.count - a.count || a.label.localeCompare(b.label),
    )
    .slice(0, 100);
  const total = group?.total ?? rows.reduce((sum, row) => sum + row.count, 0);
  const list = (all: boolean) => (
    <ol className="space-y-1" aria-label={`${title}: ${group?.label}`}>
      {rows.slice(0, all ? 100 : 8).map((row, i) => (
        <li
          key={`${row.label}-${i}`}
          className="relative isolate flex min-h-10 items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 -z-10 rounded-md bg-emerald-600/10 dark:bg-emerald-400/10"
            style={{
              width: `${total ? Math.max(0, Math.min(100, (row.count / total) * 100)) : 0}%`,
            }}
          />
          <span
            className="min-w-0 flex-1 truncate"
            title={formatLabel(row.label)}
          >
            {formatLabel(row.label)}
          </span>
          <span className="shrink-0 font-medium tabular-nums">
            {number(row.count)}
          </span>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {percent(total ? row.count / total : 0)}
          </span>
        </li>
      ))}
      {!rows.length && (
        <li className="px-3 py-8 text-center text-sm text-muted-foreground">
          No {group?.label.toLowerCase()} recorded in this range.
        </li>
      )}
    </ol>
  );
  return (
    <DataCard title={title} columns={false}>
      {groups.length > 1 && (
        <div
          role="tablist"
          aria-label={`${title} breakdown`}
          className="flex flex-wrap gap-1 py-2"
        >
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={g.key === group?.key}
              className={`rounded-md px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring ${g.key === group?.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setSelected(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      {chart && rows.length > 0 && total > 0 ? (
        <ShareChart rows={rows} total={total} formatLabel={formatLabel} />
      ) : (
        list(false)
      )}
      {group?.note && (
        <p className="px-3 py-2 text-xs text-muted-foreground">{group.note}</p>
      )}
      {rows.length > (chart ? 5 : 8) && (
        <button
          className="my-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setOpen(true)}
        >
          View all {number(rows.length)}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {title} · {group?.label}
            </DialogTitle>
            <DialogDescription>
              Up to 100 ranked results. Shares use the same denominator as the
              panel.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">{list(true)}</div>
        </DialogContent>
      </Dialog>
    </DataCard>
  );
}

const colors = ["#13a37b", "#568adc", "#ac83d3", "#e4ac54", "#db827d"];

function ShareChart({
  rows,
  total,
  formatLabel,
}: {
  rows: RankedRow[];
  total: number;
  formatLabel: (label: string) => string;
}) {
  const segments = rows.slice(0, 5).map((row, index) => ({
    ...row,
    label: formatLabel(row.label),
    color: colors[index],
  }));
  const remainder = total - segments.reduce((sum, row) => sum + row.count, 0);
  if (remainder > 0)
    segments.push({ label: "Other", count: remainder, color: "#818793" });
  const stops = segments.map(({ count, color }, index) => {
    const start =
      (segments.slice(0, index).reduce((sum, row) => sum + row.count, 0) /
        total) *
      100;
    const end = start + (count / total) * 100;
    return `${color} ${start}% ${end}%`;
  });
  return (
    <div className="flex items-center gap-5 px-2 py-4">
      <div
        aria-hidden
        className="grid size-24 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="grid size-[72px] place-content-center rounded-full bg-card text-center">
          <strong className="text-sm tabular-nums">{number(total)}</strong>
          <span className="text-xs text-muted-foreground">views</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segments.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="min-w-0 flex-1 truncate" title={row.label}>
              {row.label}
            </span>
            <span className="tabular-nums">{number(row.count)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {percent(row.count / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
