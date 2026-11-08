"use client";
import { useState } from "react";
import { Award, CalendarCheck, Flame, Lock, Medal, ShieldCheck, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS, seriesColor } from "./chart-kit";
import { formatValue, metricDelta, shortDate } from "./format";
import { DeltaPill } from "./lists";
import type { Achievement, MetricOut, ProgressHero } from "./types";

const BADGE_ICON: [string, typeof Award][] = [
  ["daily-goal", Target],
  ["weekly-", CalendarCheck],
  ["monthly-", Trophy],
  ["first-visit", Star],
  ["first-booking", Medal],
  ["personal-best", Sparkles],
  ["streak-", Flame],
  ["fast-responder", Zap],
  ["clean-sheet", ShieldCheck],
];

/** "3 of 20 this month" → 0.15, for badges that track a count towards a goal. */
function progressOf(a: Achievement) {
  const m = /^([\d,.]+) of ([\d,.]+)/.exec(a.detail);
  if (!m) return null;
  const [done, goal] = [m[1], m[2]].map((v) => Number(v.replace(/,/g, "")));
  return goal > 0 ? Math.min(1, done / goal) : null;
}

const PHONE_BADGES = 6;

/** The personal scoreboard: score, streak and best day in one row, then the badges. */
export function Progress({ hero }: { hero: ProgressHero }) {
  const unlocked = hero.achievements.filter((a) => a.unlocked).length;
  // Phones show the first few badges until asked for the rest.
  const [allBadges, setAllBadges] = useState(false);
  // Unlocked first, then the ones closest to unlocking; ties keep the server's order.
  const badges = hero.achievements
    .map((a, i) => ({ a, i, p: a.unlocked ? 2 : (progressOf(a) ?? -1) }))
    .sort((x, y) => y.p - x.p || x.i - y.i)
    .map((x) => x.a);
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="flex items-center gap-5 rounded-xl border bg-card p-5 lg:col-span-6">
        <ScoreRing score={hero.score} />
        <div className="min-w-0 space-y-1.5">
          <div className="text-[13px] text-muted-foreground">Performance score</div>
          <div className="text-[13px] text-foreground/80">
            {hero.scoreBasis === "targets" ? "Pace against your monthly targets" : hero.scoreBasis === "peers" ? "Compared with your department" : "Not enough activity to score yet"}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
            {hero.rank !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium">
                <Medal aria-hidden className="size-3.5" style={{ color: hero.rank <= 3 ? STATUS.warn : undefined }} />
                Rank {hero.rank} of {hero.rankOf}
              </span>
            )}
            {hero.change !== null && (
              <span className="text-xs text-muted-foreground">
                Activity <span className={cn("font-medium tabular-nums", hero.change > 0 ? "text-[var(--delta-good)]" : hero.change < 0 ? "text-[var(--delta-bad)]" : "")}>{hero.change > 0 ? "+" : ""}{hero.change}%</span> vs previous
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:col-span-6">
        <Stat icon={Flame} tone={hero.streak.days >= 5 ? "warn" : undefined} label="Working-day streak" value={`${hero.streak.days} ${hero.streak.days === 1 ? "day" : "days"}`} detail={`${hero.streak.metric} goal met each day`} />
        <Stat
          icon={Sparkles}
          label={`Best day · ${hero.best.metric.toLowerCase()}`}
          value={formatValue("n", hero.best.value)}
          detail={hero.best.date ? `${shortDate(hero.best.date)} · today ${hero.best.today}` : `Today ${hero.best.today}`}
          meter={hero.best.value ? Math.min(1, hero.best.today / hero.best.value) : 0}
        />
      </div>

      <div className="rounded-xl border bg-card p-5 lg:col-span-12">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">Achievements</span>
          <div className="h-1.5 max-w-40 flex-1 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${hero.achievements.length ? (unlocked / hero.achievements.length) * 100 : 0}%`, background: STATUS.warn }} />
          </div>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{unlocked} of {hero.achievements.length} unlocked</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {badges.map((a, i) => <Badge key={`${a.key}-${a.period}`} a={a} className={!allBadges && i >= PHONE_BADGES ? "max-sm:hidden" : undefined} />)}
        </ul>
        {!allBadges && badges.length > PHONE_BADGES && (
          <button type="button" onClick={() => setAllBadges(true)} className="mt-3 w-full rounded-lg border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted sm:hidden">
            Show all {badges.length}
          </button>
        )}
      </div>

      {(hero.strengths.length > 0 || hero.weaknesses.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 lg:col-span-12">
          <Standouts title="Where you shine" tone="good" metrics={hero.strengths} empty="Keep going — strengths appear once you pull ahead of the team median." />
          <Standouts title="Where to improve" tone="bad" metrics={hero.weaknesses} empty="Nothing is lagging behind the team. Nice work." />
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 38, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score ?? 0));
  return (
    <div className="relative size-[104px] shrink-0">
      <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden>
        <circle cx={48} cy={48} r={r} fill="none" stroke="var(--muted)" strokeWidth={8} />
        {score !== null && <circle cx={48} cy={48} r={r} fill="none" stroke={seriesColor(0)} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-semibold leading-none tracking-tight">{score === null ? "—" : Math.round(score)}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, detail, meter, tone }: { icon: typeof Flame; label: string; value: string; detail: string; meter?: number; tone?: "warn" }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Icon aria-hidden className="size-4" style={{ color: tone ? STATUS[tone] : undefined }} />
        <span className="min-w-0 leading-tight">{label}</span>
      </div>
      <div className="mt-2 text-[22px] font-semibold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</div>
      {meter !== undefined && (
        <div className="mt-2.5 h-1.5 rounded-full bg-muted" title="Today against your best day">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${meter * 100}%`, background: seriesColor(0) }} />
        </div>
      )}
    </div>
  );
}

function Badge({ a, className }: { a: Achievement; className?: string }) {
  const Icon = BADGE_ICON.find(([k]) => a.key.startsWith(k))?.[1] ?? Award;
  const progress = progressOf(a);
  return (
    <li
      title={a.detail}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5 transition-colors",
        a.unlocked ? "border-[var(--status-warn)]/40 bg-[var(--status-warn)]/[0.07]" : progress ? "" : "border-dashed opacity-70",
        a.celebrate && "animate-in zoom-in-95 duration-500",
        className,
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", a.unlocked ? "bg-[var(--status-warn)]/20" : "bg-muted")}>
        {a.unlocked ? <Icon aria-hidden className="size-4 text-foreground" /> : <Lock aria-hidden className="size-3.5 text-muted-foreground" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-tight text-foreground">{a.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{a.unlocked ? "Unlocked" : a.detail}</span>
        {!a.unlocked && !!progress && (
          <span className="mt-1.5 block h-1 rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.max(progress * 100, 4)}%`, background: seriesColor(0) }} />
          </span>
        )}
      </span>
    </li>
  );
}

function Standouts({ title, tone, metrics, empty }: { title: string; tone: "good" | "bad"; metrics: MetricOut[]; empty: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
        <span aria-hidden className="size-2 rounded-full" style={{ background: STATUS[tone] }} />
        {title}
      </div>
      {metrics.length === 0 ? <p className="text-[13px] text-muted-foreground">{empty}</p> : (
        <ul className="divide-y">
          {metrics.map((m) => (
            <li key={m.key} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-foreground/85">{m.label}</span>
              <span className="text-xs text-muted-foreground">
                {m.percentile !== null && m.percentile !== undefined ? `Better than ${Math.round(m.percentile)}%` : m.median !== null && m.median !== undefined ? `Median ${formatValue(m.fmt, m.median)}` : null}
              </span>
              <DeltaPill d={metricDelta(m)} />
              <span className="w-16 text-right font-medium tabular-nums">{formatValue(m.fmt, m.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A short burst of confetti; does nothing for people who prefer reduced motion. */
export function confetti() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "9999" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);
  const colors = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
  const W = window.innerWidth, H = window.innerHeight;
  const bits = Array.from({ length: 160 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = 9 + Math.random() * 9;
    return {
      x: fromLeft ? W * 0.1 : W * 0.9, y: H * 0.75,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 5, h: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1800) / 800);
    for (const b of bits) {
      b.vy += 0.32; b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (t < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
