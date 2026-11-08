"use client";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { defineChart, barX, barY, areaY, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { DashboardPanel } from "@/components/metrics/DashboardPanels";
import { number } from "@/lib/site-analytics";

type Count = { label: string; count: number };
export type InventorySnapshot = {
  kind: string;
  total: number;
  status: Count[];
  city: Count[];
  category: Count[];
  additions: { day: string; count: number }[];
};
export function InventoryInsights({
  snapshot,
  from,
  to,
}: {
  snapshot: InventorySnapshot[];
  from: string;
  to: string;
}) {
  const reduced = useReducedMotion();
  const data = useMemo(() => {
    function group(field: "status" | "city" | "category") {
      const map = new Map<string, number>();
      snapshot.forEach((s) =>
        s[field].forEach((r) =>
          map.set(r.label, (map.get(r.label) || 0) + r.count),
        ),
      );
      return [...map]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    }
    const timeline = [];
    for (let t = Date.parse(from); t < Date.parse(to); t += 86400000) {
      const day = new Date(t).toISOString().slice(0, 10);
      timeline.push({
        day,
        count: snapshot.reduce(
          (n, s) => n + (s.additions.find((r) => r.day === day)?.count || 0),
          0,
        ),
      });
    }
    return {
      status: group("status"),
      city: group("city"),
      category: group("category"),
      timeline,
    };
  }, [snapshot, from, to]);
  const charts = useMemo(
    () =>
      [
        defineChart({
          marks: [
            barY(data.status, { x: "label", y: "count", fill: "#238776" }),
          ],
          scales: {
            x: { scale: () => scaleBand().padding(0.25) },
            y: { scale: scaleLinear, nice: true, grid: true },
          },
          tooltip,
        }),
        defineChart({
          marks: [barX(data.city, { y: "label", x: "count", fill: "#6695dc" })],
          scales: {
            y: { scale: () => scaleBand().padding(0.25) },
            x: { scale: scaleLinear, nice: true, grid: true },
          },
          tooltip,
        }),
        defineChart({
          marks: [
            barX(data.category, { y: "label", x: "count", fill: "#a08ac4" }),
          ],
          scales: {
            y: { scale: () => scaleBand().padding(0.25) },
            x: { scale: scaleLinear, nice: true, grid: true },
          },
          tooltip,
        }),
        defineChart({
          marks: [
            areaY(data.timeline, {
              x: "day",
              y: "count",
              fill: "#238776",
              fillOpacity: 0.12,
            }),
            lineY(data.timeline, {
              x: "day",
              y: "count",
              stroke: "#238776",
              points: data.timeline.length < 10,
            }),
          ],
          scales: {
            x: { scale: () => scalePoint<string>().padding(0.2) },
            y: { scale: scaleLinear, nice: true, grid: true },
          },
          tooltip,
        }),
      ] as const,
    [data],
  );
  const total = snapshot.reduce((n, s) => n + s.total, 0);
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Current properties",
            snapshot.find((s) => s.kind === "property")?.total || 0,
          ],
          [
            "Current projects",
            snapshot.find((s) => s.kind === "project")?.total || 0,
          ],
          [
            "Cities",
            new Set(
              snapshot.flatMap((s) =>
                s.city
                  .filter(
                    (r) =>
                      !["unknown", "unspecified"].includes(
                        r.label.toLowerCase(),
                      ),
                  )
                  .map((r) => r.label),
              ),
            ).size,
          ],
          [
            "Added in selected period",
            data.timeline.reduce((n, r) => n + r.count, 0),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <strong className="mt-2 block text-2xl tabular-nums">
              {number(Number(value))}
            </strong>
          </div>
        ))}
      </div>
      {total ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {[
            "Current listing status",
            "Current inventory by city",
            "Current property and project types",
            "Inventory added over time",
          ].map((title, i) => (
            <DashboardPanel key={title} title={title}>
              {i === 0 ? (
                <Chart definition={charts[0]} height={260} ariaLabel={title} />
              ) : i === 1 ? (
                <Chart definition={charts[1]} height={260} ariaLabel={title} />
              ) : i === 2 ? (
                <Chart definition={charts[2]} height={260} ariaLabel={title} />
              ) : (
                <Chart definition={charts[3]} height={260} ariaLabel={title} />
              )}
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">View values</summary>
                {(i === 0
                  ? data.status
                  : i === 1
                    ? data.city
                    : i === 2
                      ? data.category
                      : data.timeline.map((r) => ({
                          label: r.day,
                          count: r.count,
                        }))
                ).map((r) => (
                  <p key={r.label} className="flex justify-between py-1">
                    <span>{r.label}</span>
                    <span>{number(r.count)}</span>
                  </p>
                ))}
              </details>
            </DashboardPanel>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No inventory records for this listing type.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Inventory reflects current records. The date filter applies to new
        inventory and website activity.
      </p>
    </motion.div>
  );
}
