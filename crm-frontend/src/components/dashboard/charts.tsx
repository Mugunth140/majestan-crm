"use client";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { scaleLinear } from "d3-scale";
import { AlertTriangle, ArrowDown, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartTip, EmptyChart, Legend, STATUS, Swatch, seq, seriesColor, useDash, useWidth, type TipRow } from "./chart-kit";
import { bucketLabel, formatTick, formatValue } from "./format";
import type { Bar, BlockOf, Tone } from "./types";

const TONE_ICON: Record<Tone, typeof Check> = { good: Check, warn: AlertTriangle, bad: ArrowDown };
const TONE_TEXT: Record<Tone, string> = { good: "On track", warn: "Watch", bad: "Behind" };

/** A row or mark that drills somewhere: a person opens their dashboard, an href opens the list. */
function Drill({ href, personId, className, children, label, onHover }: { href?: string; personId?: number; className?: string; children: ReactNode; label: string; onHover?: (on: boolean) => void }) {
  const { openPerson, canOpen } = useDash();
  const hover = onHover ? { onPointerEnter: () => onHover(true), onPointerLeave: () => onHover(false), onFocus: () => onHover(true), onBlur: () => onHover(false) } : {};
  const cls = cn("block w-full rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", className);
  if (canOpen(personId)) return <button type="button" aria-label={`Open ${label}`} onClick={() => openPerson(personId!)} className={cn(cls, "cursor-pointer hover:bg-muted/60")} {...hover}>{children}</button>;
  if (href) return <Link href={href} aria-label={`Open ${label}`} className={cn(cls, "hover:bg-muted/60")} {...hover}>{children}</Link>;
  return <div className={cls} {...hover}>{children}</div>;
}

/* ───────────────────────────── Trend ───────────────────────────── */

export function TrendChart({ block }: { block: BlockOf<"trend"> }) {
  const { focus, setFocus } = useDash();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId().replaceAll(":", "");
  const keys = block.series.map((s) => s.key);
  const solo = focus && keys.includes(focus) ? focus : null;
  const visible = block.series.filter((s) => (solo ? s.key === solo : !hidden.has(s.key)));
  const colorOf = (key: string) => seriesColor(keys.indexOf(key));
  const total = block.points.reduce((s, p) => s + keys.reduce((a, k) => a + (p.v[k] ?? 0), 0), 0);
  // Thin daily counts read as spikes; a weekly roll-up shows the shape.
  const canWeek = block.bucket === "day" && block.points.length > 14 && block.fmt === "n";
  const sparse = canWeek && total / (block.points.length * keys.length) < 1.5;
  const [grain, setGrain] = useState<"day" | "week" | null>(null);
  const weekly = canWeek && (grain ?? (sparse ? "week" : "day")) === "week";
  const pts = weekly ? rollWeeks(block.points, keys) : block.points;
  const bucket = weekly ? "week" : block.bucket;
  // The last week is usually still running; its dip is not a real drop.
  const partial = weekly && block.points.length % 7 !== 0 && pts.length > 1;

  const height = 248, top = 12, bottom = 28, right = 8;
  const max = Math.max(block.fmt === "n" ? 4 : 1, ...pts.flatMap((p) => visible.map((s) => p.v[s.key] ?? 0)));
  const y = scaleLinear().domain([0, max]).nice(4).range([height - bottom, top]);
  const ticks = y.ticks(4).filter((t) => block.fmt !== "n" || Number.isInteger(t));
  const left = Math.max(28, ...ticks.map((t) => formatTick(block.fmt, t).length * 7 + 10));
  const x = scaleLinear().domain([0, Math.max(1, pts.length - 1)]).range([left, width - right]);
  const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((width - left) / 72))));
  const path = (key: string, from = 0, to = pts.length) => pts.slice(from, to).map((p, j) => `${j ? "L" : "M"}${x(from + j).toFixed(1)},${y(p.v[key] ?? 0).toFixed(1)}`).join("");
  const solidEnd = partial ? pts.length - 1 : pts.length;

  const toggle = (key: string) => {
    if (solo) { setFocus(null); setHidden(new Set(keys.filter((k) => k !== solo && k !== key))); return; }
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else if (keys.length - next.size > 1) next.add(key);
      return next;
    });
  };
  const legendHidden = solo ? new Set(keys.filter((k) => k !== solo)) : hidden;
  const active = hover === null ? null : pts[hover];

  return (
    <div className="space-y-3">
      {(block.series.length > 1 || canWeek) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {block.series.length > 1 ? <Legend items={block.series.map((s) => ({ key: s.key, label: s.label, color: colorOf(s.key), line: true }))} hidden={legendHidden} onToggle={toggle} className="-ml-2" /> : <span />}
          {canWeek && <Segmented label="Grouping" value={weekly ? "week" : "day"} onChange={(g) => { setGrain(g); setHover(null); }} options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }]} />}
        </div>
      )}
      {total === 0 ? <EmptyChart className="h-[248px]" /> : (
        <div ref={ref} className="relative">
          <svg
            role="img"
            tabIndex={0}
            aria-label={`${block.title}. Use the arrow keys to read each ${bucket}.`}
            viewBox={`0 0 ${width} ${height}`}
            className="h-[248px] w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) * width) / r.width;
              setHover(Math.max(0, Math.min(pts.length - 1, Math.round(x.invert(px)))));
            }}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              setHover((i) => Math.max(0, Math.min(pts.length - 1, (i ?? (e.key === "ArrowRight" ? -1 : pts.length)) + (e.key === "ArrowRight" ? 1 : -1))));
            }}
          >
            <defs><clipPath id={clip}><rect x={left - 3} y={0} width={width - left - right + 6} height={height - bottom + 3} /></clipPath></defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} />
                <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)" className="tabular-nums">{formatTick(block.fmt, t)}</text>
              </g>
            ))}
            {pts.map((p, i) => (i % every === 0 || i === pts.length - 1) && (i === pts.length - 1 ? true : pts.length - 1 - i >= every * 0.6) ? (
              <text key={p.t} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--muted-foreground)">{bucketLabel(p.t, bucket)}</text>
            ) : null)}
            <g clipPath={`url(#${clip})`}>
              {visible.length === 1 && <path className="dash-fade" d={`${path(visible[0].key)}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={colorOf(visible[0].key)} opacity={0.08} />}
              {visible.map((s) => <path key={s.key} className="dash-line" pathLength={1} d={path(s.key, 0, solidEnd)} fill="none" stroke={colorOf(s.key)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
              {partial && visible.map((s) => <path key={`${s.key}-partial`} className="dash-fade" d={path(s.key, pts.length - 2)} fill="none" stroke={colorOf(s.key)} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />)}
              {pts.length === 1 && visible.map((s) => <circle key={s.key} cx={x(0)} cy={y(pts[0].v[s.key] ?? 0)} r={4} fill={colorOf(s.key)} />)}
            </g>
            {active && hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} stroke="var(--muted-foreground)" strokeDasharray="3 4" opacity={0.6} />
                {visible.map((s) => <circle key={s.key} cx={x(hover)} cy={y(active.v[s.key] ?? 0)} r={4.5} fill={colorOf(s.key)} stroke="var(--card)" strokeWidth={2} />)}
              </g>
            )}
          </svg>
          {active && hover !== null && (
            <ChartTip
              x={x(hover)}
              y={y(Math.max(...visible.map((s) => active.v[s.key] ?? 0)))}
              width={width}
              title={`${bucketLabel(active.t, bucket, true)}${partial && hover === pts.length - 1 ? " · so far" : ""}`}
              rows={[...visible].sort((a, b) => (active.v[b.key] ?? 0) - (active.v[a.key] ?? 0)).map((s) => ({ color: colorOf(s.key), label: s.label, value: formatValue(block.fmt, active.v[s.key] ?? 0) }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Seven-day sums, labelled by their first day. */
function rollWeeks(points: BlockOf<"trend">["points"], keys: string[]) {
  const out: BlockOf<"trend">["points"] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    const v: Record<string, number> = {};
    for (const k of keys) v[k] = chunk.reduce((s, p) => s + (p.v[k] ?? 0), 0);
    out.push({ t: chunk[0].t, v });
  }
  return out;
}

/* ───────────────────────────── Bars ───────────────────────────── */

const SHOW = 8;

export function BarList({ block }: { block: BlockOf<"bars"> }) {
  const [all, setAll] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const bars = block.bars;
  if (!bars.length || bars.every((b) => !b.value && !b.secondary)) return <EmptyChart />;
  const max = block.fmt === "pct" ? Math.max(100, ...bars.map((b) => b.value)) : Math.max(1, ...bars.map((b) => b.value));
  const shown = all ? bars : bars.slice(0, SHOW);
  const toned = bars.some((b) => b.tone);

  return (
    <div className="space-y-0.5">
      {(block.valueLabel || block.secondaryLabel) && (
        <div className="flex justify-end gap-4 px-2 pb-1 text-[11px] text-muted-foreground">
          {block.secondaryLabel && <span>{block.secondaryLabel}</span>}
          {block.valueLabel && <span>{block.valueLabel}</span>}
        </div>
      )}
      {shown.map((b, i) => <BarRow key={`${b.label}-${i}`} bar={b} max={max} fmt={block.fmt} active={hover === i} dim={hover !== null && hover !== i} onHover={(on) => setHover(on ? i : null)} />)}
      {bars.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {all ? "Show fewer" : `Show all ${bars.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
      {toned && (
        <div className="flex flex-wrap gap-3 px-2 pt-2 text-[11px] text-muted-foreground">
          {(["good", "warn", "bad"] as Tone[]).filter((t) => bars.some((b) => b.tone === t)).map((t) => {
            const Icon = TONE_ICON[t];
            return <span key={t} className="inline-flex items-center gap-1"><Icon className="size-3" style={{ color: STATUS[t] }} />{TONE_TEXT[t]}</span>;
          })}
        </div>
      )}
    </div>
  );
}

function BarRow({ bar, max, fmt, active, dim, onHover }: { bar: Bar; max: number; fmt: BlockOf<"bars">["fmt"]; active: boolean; dim: boolean; onHover: (on: boolean) => void }) {
  const Icon = bar.tone ? TONE_ICON[bar.tone] : null;
  const pct = Math.max(bar.value > 0 ? 1.5 : 0, (bar.value / max) * 100);
  return (
    <Drill href={bar.href} personId={bar.personId} label={bar.label} onHover={onHover} className={cn("px-2 py-1.5 transition-opacity", dim && "opacity-60")}>
      <div className="flex items-center gap-3 text-[13px]">
        <span className="w-[38%] min-w-0 shrink-0 truncate text-foreground/85" title={bar.label}>{bar.label}</span>
        <span className="relative h-2 flex-1 rounded-full bg-muted">
          <span className="dash-grow absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, pct)}%`, background: bar.tone ? STATUS[bar.tone] : seriesColor(0), opacity: active ? 1 : 0.9 }} />
        </span>
        {bar.secondary !== undefined && <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{bar.secondary}</span>}
        <span className="flex w-16 shrink-0 items-center justify-end gap-1 font-medium tabular-nums text-foreground">
          {Icon && <Icon aria-label={TONE_TEXT[bar.tone!]} className="size-3" style={{ color: STATUS[bar.tone!] }} />}
          {formatValue(fmt, bar.value)}
        </span>
      </div>
    </Drill>
  );
}

/* ──────────────────────────── Stacked ──────────────────────────── */

export function StackedBars({ block }: { block: BlockOf<"stacked"> }) {
  const [share, setShare] = useState(false);
  const [hover, setHover] = useState<{ row: number; key: string } | null>(null);
  const [all, setAll] = useState(false);
  const keys = block.keys.slice(0, 8);
  const rows = block.rows.map((r) => ({ ...r, total: keys.reduce((s, k) => s + (r.values[k.key] ?? 0), 0) }));
  if (!rows.length || rows.every((r) => !r.total)) return <EmptyChart />;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const shown = all ? rows : rows.slice(0, SHOW);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend items={keys.map((k, i) => ({ key: k.key, label: k.label, color: seriesColor(i) }))} className="-ml-1.5" />
        <Segmented value={share ? "share" : "count"} onChange={(v) => setShare(v === "share")} options={[{ value: "count", label: "Count" }, { value: "share", label: "Share" }]} />
      </div>
      <div className="space-y-0.5">
        {shown.map((r, ri) => (
          <Drill key={`${r.label}-${ri}`} personId={r.personId} label={r.label} className="px-2 py-1.5">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="w-[30%] min-w-0 shrink-0 truncate text-foreground/85" title={r.label}>{r.label}</span>
              <span className="relative flex h-2.5 flex-1 gap-[2px] overflow-visible">
                <span className="dash-grow flex h-full gap-[2px]" style={{ width: `${share ? (r.total ? 100 : 0) : (r.total / max) * 100}%` }}>
                  {keys.map((k, i) => {
                    const v = r.values[k.key] ?? 0;
                    if (!v) return null;
                    const on = hover?.row === ri && hover.key === k.key;
                    return (
                      <span
                        key={k.key}
                        onPointerEnter={() => setHover({ row: ri, key: k.key })}
                        onPointerLeave={() => setHover(null)}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-opacity"
                        style={{ flexGrow: v, flexBasis: 0, minWidth: 3, background: seriesColor(i), opacity: hover && hover.row === ri && !on ? 0.55 : 1 }}
                      />
                    );
                  })}
                </span>
                {hover?.row === ri && (
                  <ChartTip
                    x={0}
                    y={18}
                    width={9999}
                    title={r.label}
                    rows={keys.map((k, i) => ({ color: seriesColor(i), label: k.label, value: share ? `${r.total ? Math.round(((r.values[k.key] ?? 0) / r.total) * 100) : 0}%` : formatValue(block.fmt, r.values[k.key] ?? 0), muted: k.key !== hover.key }))}
                    footer={`Total ${formatValue(block.fmt, r.total)}`}
                  />
                )}
              </span>
              <span className="w-12 shrink-0 text-right font-medium tabular-nums">{formatValue(block.fmt, r.total)}</span>
            </div>
          </Drill>
        ))}
      </div>
      {rows.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {all ? "Show fewer" : `Show all ${rows.length}`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label = "View" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring", value === o.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── Donut ───────────────────────────── */

const MAX_SLICES = 7;

export function Donut({ block }: { block: BlockOf<"donut"> }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, boxWidth] = useWidth<HTMLDivElement>(480);
  const maskId = useId().replaceAll(":", "");
  const slices = useMemo(() => {
    const sorted = block.slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_SLICES + 1) return sorted;
    const rest = sorted.slice(MAX_SLICES);
    return [...sorted.slice(0, MAX_SLICES), { label: `Other (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0), href: undefined }];
  }, [block.slices]);
  const router = useRouter();
  const armed = useRef(false);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <EmptyChart />;

  // A third-width card keeps the legend beside a smaller ring; a ring-only donut fills the card instead.
  const ring = !!block.ring;
  const narrow = boxWidth < 420;
  const size = ring ? Math.max(180, Math.min(boxWidth, 300)) : narrow ? 128 : 176, r = size / 2;
  const thick = ring ? Math.round(size * 0.14) : narrow ? 16 : 20, inner = r - thick, gap = slices.length > 1 ? 0.025 : 0;
  const starts = slices.map((_, i) => -Math.PI / 2 + (slices.slice(0, i).reduce((a, x) => a + x.value, 0) / total) * Math.PI * 2);
  const arcs = slices.map((s, i) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = starts[i] + gap / 2, a1 = starts[i] + sweep - gap / 2;
    return { ...s, i, d: arc(r, r, r - (hover === i ? 0 : ring ? 4 : 2), inner, a0, Math.max(a0 + 0.001, a1)) };
  });
  const focus = hover === null ? null : slices[hover];
  const paths = arcs.map((a) => (
    <path
      key={a.label} d={a.d} fill={seriesColor(a.i)} opacity={hover === null || hover === a.i ? 1 : 0.35}
      onPointerEnter={() => setHover(a.i)} onPointerLeave={(e) => { if (!ring || e.pointerType !== "touch") setHover(null); }}
      {...(ring ? {
        // On touch the first tap shows the count, the second opens the leads.
        onPointerDown: (e: React.PointerEvent) => { armed.current = e.pointerType !== "touch" || hover === a.i; },
        tabIndex: 0, role: a.href ? "link" : "img", "aria-label": `${a.label}: ${formatValue("n", a.value)}, ${Math.round((a.value / total) * 100)}%`,
        onFocus: () => setHover(a.i), onBlur: () => setHover(null),
        onClick: () => { if (a.href && armed.current) router.push(a.href); },
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" && a.href) router.push(a.href); },
      } : {})}
      className={cn("transition-[opacity,d] duration-200", ring && "cursor-pointer outline-none")}
    />
  ));
  const mask = (
    // Reveals the ring clockwise during the entry animation; fully open otherwise.
    <mask id={maskId}><circle className="dash-sweep" cx={r} cy={r} r={r - thick / 2} fill="none" stroke="white" strokeWidth={thick + 8} pathLength={1} strokeDasharray="1 1" transform={`rotate(-90 ${r} ${r})`} /></mask>
  );

  if (ring) {
    return (
      <div ref={box} className="flex h-full min-h-[220px] w-full items-center justify-center py-1">
        <div className="relative" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label={`${block.title}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
            {mask}
            <g mask={`url(#${maskId})`}>{paths}</g>
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
            {focus ? (
              <>
                <span className="flex max-w-[60%] items-center gap-1.5 text-[13px] font-medium leading-tight text-foreground/85"><Swatch color={seriesColor(hover!)} />{focus.label}</span>
                <span className="mt-1.5 text-[34px] font-semibold leading-none tabular-nums tracking-tight">{formatValue("n", focus.value)}</span>
                <span className="mt-1.5 text-xs tabular-nums text-muted-foreground">{Math.round((focus.value / total) * 100)}% of {formatValue("n", total)}</span>
              </>
            ) : (
              <>
                <span className="text-[34px] font-semibold leading-none tabular-nums tracking-tight">{formatValue("n", total)}</span>
                <span className="mt-1.5 text-[13px] text-muted-foreground">{block.centerLabel}</span>
                <span className="mt-1 text-[11px] text-muted-foreground/70">Point at a colour</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={box} className={cn("flex flex-col items-center", boxWidth >= 300 && "flex-row items-center", narrow ? "gap-4" : "gap-5")}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${block.title}: ${slices.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
          {mask}
          <g mask={`url(#${maskId})`}>{paths}</g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatValue("n", focus ? focus.value : total)}</span>
          <span className="max-w-24 truncate text-xs text-muted-foreground">{focus ? `${Math.round((focus.value / total) * 100)}% · ${focus.label}` : block.centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {slices.map((s, i) => (
          <li key={s.label}>
            <Drill href={s.href} label={s.label} onHover={(on) => setHover(on ? i : null)} className={cn("px-2 py-1.5", hover !== null && hover !== i && "opacity-60")}>
              <span className="flex items-center gap-2 text-[13px]">
                <Swatch color={seriesColor(i)} />
                <span className="flex-1 truncate text-foreground/85" title={s.label}>{s.label}</span>
                {!narrow && <span className="tabular-nums text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>}
                <span className="w-10 text-right font-medium tabular-nums">{formatValue("n", s.value)}</span>
              </span>
            </Drill>
          </li>
        ))}
      </ul>
    </div>
  );
}

function arc(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  if (a1 - a0 >= Math.PI * 2 - 0.01) {
    return `M${p(ro, 0)}A${ro},${ro} 0 1 1 ${p(ro, Math.PI)}A${ro},${ro} 0 1 1 ${p(ro, 0)}M${p(ri, 0)}A${ri},${ri} 0 1 0 ${p(ri, Math.PI)}A${ri},${ri} 0 1 0 ${p(ri, 0)}Z`;
  }
  return `M${p(ro, a0)}A${ro},${ro} 0 ${large} 1 ${p(ro, a1)}L${p(ri, a1)}A${ri},${ri} 0 ${large} 0 ${p(ri, a0)}Z`;
}

/* ───────────────────────────── Funnel ───────────────────────────── */

export function Funnel({ block }: { block: BlockOf<"funnel"> }) {
  const stages = block.stages;
  const first = stages[0]?.value ?? 0;
  if (!first) return <EmptyChart>No leads entered the funnel in this period</EmptyChart>;
  const drops = stages.map((s, i) => (i === 0 || !stages[i - 1].value ? 0 : 1 - s.value / stages[i - 1].value));
  const worst = drops.indexOf(Math.max(...drops));

  return (
    <ol className="space-y-1">
      {stages.map((s, i) => {
        const conv = i === 0 ? null : stages[i - 1].value ? Math.round((s.value / stages[i - 1].value) * 100) : 0;
        return (
          <li key={s.label}>
            <Drill href={s.href} label={s.label} className="px-2 py-1.5">
              <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                <span className="flex-1 truncate text-foreground/85">{s.label}</span>
                {conv !== null && (
                  <span className={cn("text-xs tabular-nums text-muted-foreground", i === worst && drops[worst] > 0 && "font-medium text-foreground")}>
                    {i === worst && drops[worst] > 0 && <AlertTriangle aria-label="Biggest drop" className="mr-1 inline size-3 align-[-1px]" style={{ color: STATUS.warn }} />}
                    {conv}% of previous
                  </span>
                )}
                <span className="w-12 text-right font-medium tabular-nums">{formatValue("n", s.value)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted">
                <div className="dash-grow h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(s.value ? 1.5 : 0, (s.value / first) * 100)}%`, background: `var(--seq-${Math.max(3, 6 - Math.floor((i * 4) / Math.max(1, stages.length - 1)))})` }} />
              </div>
            </Drill>
          </li>
        );
      })}
    </ol>
  );
}

/* ──────────────────────────── Heatmap ──────────────────────────── */

export function Heatmap({ block }: { block: BlockOf<"heatmap"> }) {
  const { openPerson, canOpen } = useDash();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const max = Math.max(0, ...block.cells.flat());
  if (!max) return <EmptyChart />;
  const dense = block.cols.length > 16;
  const labelEvery = dense ? Math.ceil(block.cols.length / 8) : 1;

  return (
    <div className="relative">
      <div className="grid items-center gap-[3px]" style={{ gridTemplateColumns: `minmax(2.5rem, max-content) repeat(${block.cols.length}, minmax(0, 1fr))` }}>
        <span />
        {block.cols.map((c, i) => <span key={`${c}-${i}`} className="truncate text-center text-[10px] text-muted-foreground">{i % labelEvery === 0 ? c : ""}</span>)}
        {block.rows.map((row, r) => (
          <HeatRow key={`${row.label}-${r}`}>
            {canOpen(row.personId) ? (
              <button type="button" onClick={() => openPerson(row.personId!)} className="truncate pr-2 text-left text-xs text-foreground/80 hover:text-foreground hover:underline">{row.label}</button>
            ) : <span className="truncate pr-2 text-xs text-foreground/80">{row.label}</span>}
            {block.cells[r].map((v, c) => (
              <span
                key={c}
                onPointerEnter={() => setHover({ r, c })}
                onPointerLeave={() => setHover(null)}
                aria-label={`${row.label}, ${block.cols[c]}: ${formatValue(block.fmt, v)}`}
                className={cn("aspect-square min-h-3 rounded-[3px] ring-offset-1 ring-offset-card transition-shadow", hover?.r === r && hover.c === c && "ring-2 ring-foreground/60", dense ? "max-h-6" : "max-h-8")}
                style={{ background: v ? seq(0.15 + (v / max) * 0.85) : "var(--seq-0)" }}
              />
            ))}
          </HeatRow>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{hover ? `${block.rows[hover.r].label} · ${block.cols[hover.c]} — ${formatValue(block.fmt, block.cells[hover.r][hover.c])}` : "Hover a cell to read it"}</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="size-2.5 rounded-[2px]" style={{ background: `var(--seq-${i})` }} />)}
          More
        </span>
      </div>
    </div>
  );
}

const HeatRow = ({ children }: { children: ReactNode }) => <>{children}</>;

/* ──────────────────────────── Scatter ──────────────────────────── */

export function Scatter({ block }: { block: BlockOf<"scatter"> }) {
  const { openPerson, canOpen } = useDash();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = block.points;
  if (!pts.length || pts.every((p) => !p.x && !p.y)) return <EmptyChart />;

  const height = 320, top = 16, bottom = 40, left = 48, right = 16;
  const x = scaleLinear().domain([0, Math.max(1, ...pts.map((p) => p.x))]).nice(5).range([left, width - right]);
  const y = scaleLinear().domain([0, Math.max(1, ...pts.map((p) => p.y))]).nice(4).range([height - bottom, top]);
  const med = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mx = med(pts.map((p) => p.x)), my = med(pts.map((p) => p.y));
  const labelled = pts.length <= 14;
  const active = hover === null ? null : pts[hover];

  return (
    <div ref={ref} className="relative">
      <p className="mb-1 text-[11px] text-muted-foreground">↑ {block.y.label}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-80 w-full" role="img" aria-label={`${block.title}: ${block.x.label} against ${block.y.label}`}>
        {y.ticks(4).map((t) => (
          <g key={`y${t}`}>
            <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{formatTick(block.y.fmt, t)}</text>
          </g>
        ))}
        {x.ticks(5).map((t) => <text key={`x${t}`} x={x(t)} y={height - bottom + 16} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{formatTick(block.x.fmt, t)}</text>)}
        <line x1={x(mx)} x2={x(mx)} y1={top} y2={height - bottom} stroke="var(--muted-foreground)" strokeDasharray="3 5" opacity={0.5} />
        <line x1={left} x2={width - right} y1={y(my)} y2={y(my)} stroke="var(--muted-foreground)" strokeDasharray="3 5" opacity={0.5} />
        <text x={left + 6} y={top + 10} fontSize={11} fill="var(--muted-foreground)">Efficient</text>
        <text x={width - right - 6} y={top + 10} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">Stars</text>
        <text x={left + 6} y={height - bottom - 8} fontSize={11} fill="var(--muted-foreground)">Quiet</text>
        <text x={width - right - 6} y={height - bottom - 8} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">Busy, few results</text>
        <text x={(left + width - right) / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">{block.x.label}</text>
        {pts.map((p, i) => (
          <g key={`${p.label}-${i}`} className={canOpen(p.personId) ? "cursor-pointer" : undefined} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onClick={() => canOpen(p.personId) && openPerson(p.personId!)}>
            <circle cx={x(p.x)} cy={y(p.y)} r={14} fill="transparent" />
            <circle cx={x(p.x)} cy={y(p.y)} r={hover === i ? 7 : 5.5} fill={seriesColor(0)} stroke="var(--card)" strokeWidth={2} opacity={hover === null || hover === i ? 1 : 0.45} />
            {labelled && <text x={x(p.x) + 9} y={y(p.y) + 4} fontSize={11} fill="var(--foreground)" opacity={hover === null || hover === i ? 0.8 : 0.3} className="pointer-events-none">{p.label.split(" ")[0]}</text>}
          </g>
        ))}
      </svg>
      {active && (
        <ChartTip x={x(active.x)} y={y(active.y)} width={width} title={active.label} rows={[{ label: block.x.label.split(" (")[0], value: formatValue(block.x.fmt, active.x) }, { label: block.y.label, value: formatValue(block.y.fmt, active.y) }]} footer={canOpen(active.personId) ? "Click to open their dashboard" : undefined} />
      )}
    </div>
  );
}

/* ───────────────────────────── Radar ───────────────────────────── */

export function Radar({ block }: { block: BlockOf<"radar"> }) {
  const [hover, setHover] = useState<number | null>(null);
  const axes = block.axes;
  if (axes.length < 3) return <BarList block={{ kind: "bars", id: block.id, title: block.title, fmt: "score", bars: axes.map((a) => ({ label: a.label, value: a.value })) }} />;
  const size = 260, c = size / 2, R = 88;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  const poly = (v: (i: number) => number) => axes.map((_, i) => pt(i, v(i)).join(",")).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`-70 -6 ${size + 140} ${size + 12}`} className="w-full max-w-[400px]" role="img" aria-label={`${block.title}: ${axes.map((a) => `${a.label} ${Math.round(a.value)}`).join(", ")}`}>
        {[25, 50, 75, 100].map((r) => <polygon key={r} points={poly(() => r)} fill="none" stroke={r === 50 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeDasharray={r === 50 ? "3 4" : undefined} />)}
        {axes.map((_, i) => { const [x2, y2] = pt(i, 100); return <line key={i} x1={c} y1={c} x2={x2} y2={y2} stroke="var(--chart-grid)" />; })}
        <polygon points={poly((i) => axes[i].value)} fill={seriesColor(0)} fillOpacity={0.14} stroke={seriesColor(0)} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [px, py] = pt(i, a.value);
          const [lx, ly] = pt(i, 116);
          return (
            <g key={a.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <circle cx={px} cy={py} r={12} fill="transparent" />
              <circle cx={px} cy={py} r={hover === i ? 5.5 : 4} fill={seriesColor(0)} stroke="var(--card)" strokeWidth={2} />
              <text x={lx} y={ly + 4} fontSize={10.5} textAnchor={Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end"} fill={hover === i ? "var(--foreground)" : "var(--muted-foreground)"} fontWeight={hover === i ? 600 : 400}>
                {shorten(a.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="-mt-1 h-4 text-xs text-muted-foreground">
        {hover !== null ? <><span className="font-medium text-foreground">{axes[hover].label}</span> · better than {Math.round(axes[hover].value)}% of the team</> : "Dashed ring is the team median"}
      </p>
    </div>
  );
}

const shorten = (s: string) => (s.length > 20 ? `${s.slice(0, 19)}…` : s);

export type { TipRow };
