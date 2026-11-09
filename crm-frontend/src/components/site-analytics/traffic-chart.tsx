"use client";
import { useId, useMemo, useRef, useEffect, useState } from "react";
import { scaleLinear } from "d3-scale";
import { chartDays, number, type SiteReport } from "@/lib/site-analytics";
import { DataCard } from "@/components/record/record-page";

const dayLabel = (day: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day));
export function TrafficChart({
  report,
  previous,
}: {
  report: SiteReport;
  previous: SiteReport | null;
}) {
  const [metric, setMetric] = useState<"visitors" | "pageviews">("visitors");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(":", "");
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const value = entries[0]?.contentRect.width;
      if (value) setWidth(Math.max(240, value));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const days = useMemo(
    () => chartDays(report, previous, metric),
    [report, previous, metric],
  );
  const height = 240,
    left = 40,
    right = 12,
    top = 16,
    bottom = 32;
  const x = scaleLinear()
    .domain([0, Math.max(1, days.length - 1)])
    .range([left, width - right]);
  const y = scaleLinear()
    .domain([
      0,
      Math.max(1, ...days.flatMap((d) => [d.value, d.previous ?? 0])),
    ])
    .nice(4)
    .range([height - bottom, top]);
  const path = (old: boolean) =>
    days
      .map(
        (d, i) =>
          `${i ? "L" : "M"}${x(i)},${y(old ? (d.previous ?? 0) : d.value)}`,
      )
      .join(" ");
  const active = hover === null ? null : days[Math.min(hover, days.length - 1)];
  return (
    <DataCard title="Traffic over time" columns={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-muted-foreground">
        <span>Daily totals · UTC</span>
        <div
          className="flex gap-1 rounded-lg bg-muted p-1"
          aria-label="Chart metric"
        >
          {(["visitors", "pageviews"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={metric === m}
              onClick={() => {
                setMetric(m);
                setHover(null);
              }}
              className={`rounded-md px-3 py-1 font-medium focus-visible:outline-2 focus-visible:outline-ring ${metric === m ? "bg-card text-foreground shadow-xs" : ""}`}
            >
              {m === "visitors" ? "Visitors" : "Page views"}
            </button>
          ))}
        </div>
      </div>
      <div ref={container} className="relative min-w-0">
        <svg
          role="img"
          aria-label={`Daily ${metric === "visitors" ? "visitors" : "page views"}, current and previous period. Use arrow keys to inspect dates.`}
          tabIndex={0}
          className="h-60 w-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHover(
              Math.max(
                0,
                Math.min(
                  days.length - 1,
                  Math.round(
                    x.invert(((e.clientX - rect.left) * width) / rect.width),
                  ),
                ),
              ),
            );
          }}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              setHover((i) =>
                Math.max(
                  0,
                  Math.min(
                    days.length - 1,
                    (i ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
        >
          <title>
            Daily {metric === "visitors" ? "visitors" : "page views"} in UTC
          </title>
          <defs>
            <clipPath id={`clip-${id}`}>
              <rect
                x={left - 2}
                y={top - 2}
                width={width - left - right + 4}
                height={height - top - bottom + 4}
              />
            </clipPath>
          </defs>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeDasharray="3 5"
              />
              <text
                x={left - 8}
                y={y(t) + 4}
                fill="var(--muted-foreground)"
                textAnchor="end"
                fontSize={11}
              >
                {number(t)}
              </text>
            </g>
          ))}
          <g clipPath={`url(#clip-${id})`}>
            {days.length > 0 && (
              <path
                d={`${path(false)} L${x(days.length - 1)},${y(0)} L${x(0)},${y(0)}Z`}
                fill="var(--color-kumo-brand)"
                opacity={0.08}
              />
            )}
            {previous && (
              <path
                d={path(true)}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              />
            )}
            <path
              d={path(false)}
              fill="none"
              stroke="var(--color-kumo-brand)"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {days.length === 1 && (
              <circle
                cx={x(0)}
                cy={y(days[0].value)}
                r={4}
                fill="var(--color-kumo-brand)"
              />
            )}
            {active && hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={top}
                  y2={height - bottom}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="3 4"
                />
                <circle
                  cx={x(hover)}
                  cy={y(active.value)}
                  r={4}
                  fill="var(--color-kumo-brand)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              </g>
            )}
          </g>
          {days
            .filter(
              (_, i) =>
                i === 0 ||
                i === days.length - 1 ||
                (days.length > 10 && i === Math.floor(days.length / 2)),
            )
            .map((d) => (
              <text
                key={d.day}
                x={x(days.indexOf(d))}
                y={height - 8}
                textAnchor={
                  d === days[0] ? "start" : d === days.at(-1) ? "end" : "middle"
                }
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {dayLabel(d.day)}
              </text>
            ))}
        </svg>
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute right-3 top-2 max-w-[calc(100%-3rem)] rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm"
          >
            <p className="font-medium">
              {dayLabel(active.day)} · {number(active.value)}
            </p>
            {active.previousDay && (
              <p className="mt-1 text-muted-foreground">
                {dayLabel(active.previousDay)} · {number(active.previous ?? 0)}{" "}
                previous
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-[var(--color-kumo-brand)]" />
          Current period
        </span>
        {previous && (
          <span className="flex items-center gap-2">
            <span className="w-4 border-t border-dashed border-muted-foreground" />
            Previous period, aligned by day
          </span>
        )}
      </div>
    </DataCard>
  );
}
