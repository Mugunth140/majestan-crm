"use client";
import { useMemo } from "react";
import {
  defineChart,
  barY,
  barX,
  lineY,
  areaY,
  dot,
  cell,
  rect,
  boxY,
} from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleLinear as colorLinear } from "d3-scale";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { DashboardPanel } from "@/components/metrics/DashboardPanels";
import {
  inventoryCount,
  type InventoryChart as Spec,
  type InventoryDatum,
  type InventoryMatch,
} from "./inventory-data";

const colors = [
  "#238776",
  "#6695dc",
  "#b698d2",
  "#d8a84d",
  "#dc8177",
  "#7d9ca6",
];
export function InventoryChart({
  spec,
  onDrill,
}: {
  spec: Spec;
  onDrill: (match: InventoryMatch, label: string) => void;
}) {
  // Separate typed charts preserve categorical/numeric scale contracts in TanStack.
  const select = (datum: InventoryDatum | undefined) => {
    if (datum?.match) onDrill(datum.match, spec.title + " · " + datum.label);
  };
  return (
    <DashboardPanel title={spec.title}>
      {!spec.rows.length ? (
        <p className="grid min-h-48 place-content-center text-center text-sm text-muted-foreground">
          No matching observations
        </p>
      ) : (
        <ChartBody spec={spec} onSelect={select} />
      )}
      {spec.unit && (
        <p className="mt-2 text-xs text-muted-foreground">{spec.unit}</p>
      )}
      {spec.note && (
        <p className="mt-2 text-xs text-muted-foreground">{spec.note}</p>
      )}
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-ring">
          View values
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          {spec.rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-t py-2"
            >
              {r.match ? (
                <button
                  className="min-w-0 text-left underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => select(r)}
                >
                  {r.label}
                  {r.series ? " · " + r.series : ""}
                </button>
              ) : (
                <span>
                  {r.label}
                  {r.series ? " · " + r.series : ""}
                </span>
              )}
              <span className="shrink-0 tabular-nums">
                {r.value !== undefined
                  ? inventoryCount(r.value)
                  : r.low !== undefined
                    ? inventoryCount(r.low) +
                      "–" +
                      inventoryCount(r.high ?? null)
                    : inventoryCount(r.x ?? null) +
                      " / " +
                      inventoryCount(r.y ?? null)}
                {r.denominator !== undefined && (
                  <span className="ml-2">
                    ({r.numerator ?? "—"}/{r.denominator} sessions)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </details>
    </DashboardPanel>
  );
}
function ChartBody({
  spec,
  onSelect,
}: {
  spec: Spec;
  onSelect: (row: InventoryDatum | undefined) => void;
}) {
  const definitions = useMemo(() => {
    const rows = spec.rows;
    const categories = { scale: () => scaleBand().padding(0.25) };
    const numeric = { scale: scaleLinear, nice: true, grid: true };
    const series = [...new Set(rows.map((r) => r.series || ""))];
    // Stack explicit intervals, retaining original row identity for drill-downs.
    const stacked = rows.map((r, i) => ({
      ...r,
      start: rows
        .slice(0, i)
        .filter((v) => v.label === r.label)
        .reduce((n, v) => n + (v.value || 0), 0),
      end: rows
        .slice(0, i + 1)
        .filter((v) => v.label === r.label)
        .reduce((n, v) => n + (v.value || 0), 0),
    }));
    return {
      bars: defineChart({
        marks:
          spec.type === "histogram"
            ? [barY(rows, { x: "label", y: "value", fill: colors[0] })]
            : [barX(rows, { y: "label", x: "value", fill: colors[0] })],
        scales:
          spec.type === "histogram"
            ? { x: categories, y: numeric }
            : { x: numeric, y: categories },
        tooltip,
      }),
      stack: defineChart({
        marks: series.map((s, i) =>
          rect(
            stacked.filter((r) => (r.series || "") === s),
            {
              x: "label",
              y1: "start",
              y2: "end",
              fill: colors[i % colors.length],
            },
          ),
        ),
        scales: { x: categories, y: numeric },
        tooltip,
      }),
      lines: defineChart({
        marks: series.flatMap((s, i) => {
          const data = rows.filter((r) => (r.series || "") === s);
          return [
            ...(spec.type === "area"
              ? [
                  areaY(data, {
                    x: "label",
                    y: "value",
                    fill: colors[i % colors.length],
                    fillOpacity: 0.1,
                  }),
                ]
              : []),
            lineY(data, {
              x: "label",
              y: "value",
              stroke: colors[i % colors.length],
              points: data.length < 12,
            }),
          ];
        }),
        scales: {
          x: { scale: () => scalePoint<string>().padding(0.15) },
          y: numeric,
        },
        tooltip,
      }),
      scatter: defineChart({
        marks: [
          dot(rows, {
            x: "x",
            y: "y",
            r: 5,
            fill: colors[1],
            fillOpacity: 0.7,
          }),
        ],
        scales: { x: numeric, y: numeric },
        tooltip,
      }),
      range: defineChart({
        marks: [
          rect(rows, { y: "label", x1: "low", x2: "high", fill: colors[1] }),
          dot(rows, { y: "label", x: "low", r: 3, fill: colors[1] }),
          dot(rows, { y: "label", x: "high", r: 3, fill: colors[1] }),
        ],
        scales: { x: numeric, y: categories },
        tooltip,
      }),
      heatmap: defineChart({
        color: {
          scale: () =>
            colorLinear<string>()
              .domain([0, Math.max(1, ...rows.map((r) => r.value || 0))])
              .range(["#242b29", colors[0]]),
        },
        marks: [
          cell(rows, { x: "label", y: "series", color: "value", inset: 2 }),
        ],
        scales: { x: categories, y: categories },
        tooltip,
      }),
      box: defineChart({
        marks: [boxY(rows, { x: "label", y: "value", fill: colors[2] })],
        scales: { x: categories, y: numeric },
        tooltip,
      }),
    };
  }, [spec]);
  const height =
    spec.type === "bar"
      ? Math.max(260, Math.min(480, spec.rows.length * 30))
      : 260;
  if (spec.type === "scatter")
    return (
      <Chart
        definition={definitions.scatter}
        height={height}
        ariaLabel={spec.title}
        onSelect={(p) => onSelect(p?.datum)}
      />
    );
  if (spec.type === "range")
    return (
      <Chart
        definition={definitions.range}
        height={height}
        ariaLabel={spec.title}
        onSelect={(p) => onSelect(p?.datum)}
      />
    );
  if (spec.type === "heatmap")
    return (
      <Chart
        definition={definitions.heatmap}
        height={height}
        ariaLabel={spec.title}
        onSelect={(p) => onSelect(p?.datum)}
      />
    );
  if (spec.type === "box")
    return (
      <Chart
        definition={definitions.box}
        height={height}
        ariaLabel={spec.title}
      />
    );
  if (spec.type === "line" || spec.type === "area")
    return (
      <Chart
        definition={definitions.lines}
        height={height}
        ariaLabel={spec.title}
        onSelect={(p) => onSelect(p?.datum)}
      />
    );
  if (spec.type === "stack")
    return (
      <div>
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {[...new Set(spec.rows.map((r) => r.series))].map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              {s}
            </span>
          ))}
        </div>
        <Chart
          definition={definitions.stack}
          height={height}
          ariaLabel={spec.title}
          onSelect={(p) => onSelect(p?.datum)}
        />
      </div>
    );
  return (
    <Chart
      definition={definitions.bars}
      height={height}
      ariaLabel={spec.title}
      onSelect={(p) => onSelect(p?.datum)}
    />
  );
}
