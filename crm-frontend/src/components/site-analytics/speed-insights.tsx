"use client";
import { DataCard } from "@/components/record/record-page";
import {
  number,
  percent,
  vitalRating,
  vitalValue,
  THRESHOLDS,
  type SiteReport,
  type VitalName,
} from "@/lib/site-analytics";

const METRICS: VitalName[] = ["LCP", "INP", "CLS", "FCP", "TTFB"];
const NAMES = {
  LCP: "Largest contentful paint",
  INP: "Interaction to next paint",
  CLS: "Cumulative layout shift",
  FCP: "First contentful paint",
  TTFB: "Time to first byte",
};
const TONES = {
  good: "text-emerald-700 dark:text-emerald-400",
  "needs-improvement": "text-amber-700 dark:text-amber-400",
  poor: "text-red-700 dark:text-red-400",
};
export function SpeedInsights({ report }: { report: SiteReport }) {
  const rows = [...(report.performance_by_route ?? [])].sort(
    (a, b) =>
      Math.max(...METRICS.map((m) => (b[m] ?? 0) / THRESHOLDS[m][1])) -
      Math.max(...METRICS.map((m) => (a[m] ?? 0) / THRESHOLDS[m][1])),
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Field data from real visitors. Measurements describe full page
        navigations; browser support determines which metrics are available.
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {METRICS.map((name) => {
          const metric = report.performance.find((m) => m.name === name);
          const total = metric?.samples ?? 0,
            good = metric?.good_samples ?? 0;
          const split =
            metric?.needs_improvement_samples !== undefined &&
            metric?.poor_samples !== undefined;
          const improve = split ? metric!.needs_improvement_samples! : 0,
            poor = split ? metric!.poor_samples! : 0;
          return (
            <section
              key={name}
              aria-label={`${name} metric`}
              className="min-w-0 rounded-xl border bg-card p-4"
            >
              <p className="text-sm font-semibold" title={NAMES[name]}>
                {name}
              </p>
              <p className="mt-1 min-h-8 text-xs text-muted-foreground">
                {NAMES[name]}
              </p>
              <p
                className={`mt-4 text-3xl font-semibold tracking-tight tabular-nums ${metric && total ? TONES[vitalRating(name, metric.p75)] : ""}`}
              >
                {metric && total ? vitalValue(name, metric.p75) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                75th percentile
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">p50</dt>
                  <dd className="mt-1 tabular-nums">
                    {metric && total ? vitalValue(name, metric.p50) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">p95</dt>
                  <dd className="mt-1 tabular-nums">
                    {metric && total ? vitalValue(name, metric.p95) : "—"}
                  </dd>
                </div>
              </dl>
              <div
                className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"
                aria-label={`${name} sample distribution`}
              >
                <span
                  className="bg-emerald-500"
                  style={{ width: `${total ? (good / total) * 100 : 0}%` }}
                />
                <span
                  className="bg-amber-500"
                  style={{ width: `${total ? (improve / total) * 100 : 0}%` }}
                />
                <span
                  className="bg-red-500"
                  style={{ width: `${total ? (poor / total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {number(total)} samples · {total ? percent(good / total) : "—"}{" "}
                good
              </p>
              {total > 0 && !split && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Remaining {percent((total - good) / total)}: needs improvement
                  / poor split unavailable.
                </p>
              )}
              {total > 0 && split && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {percent(improve / total)} needs improvement ·{" "}
                  {percent(poor / total)} poor
                </p>
              )}
            </section>
          );
        })}
      </div>
      <DataCard title="Performance by route" columns={false}>
        {!rows.length ? (
          <div className="py-8 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Route breakdown unavailable
            </p>
            <p className="mt-2">
              The site report provides overall percentiles, but no percentiles
              by route. They cannot be calculated from page counts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Route p75 performance, worst relative to the poor threshold
                first
              </caption>
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Route</th>
                  {METRICS.map((m) => (
                    <th key={m} className="p-3 font-medium">
                      {m} p75
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.route} className="border-b last:border-0">
                    <th className="max-w-60 break-all p-3 font-normal">
                      {row.route}
                    </th>
                    {METRICS.map((m) => (
                      <td
                        key={m}
                        className={`whitespace-nowrap p-3 tabular-nums ${row[m] !== undefined ? TONES[vitalRating(m, row[m]!)] : ""}`}
                      >
                        {vitalValue(m, row[m])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
      <p className="text-xs text-muted-foreground">
        Good / needs improvement / poor thresholds: LCP 2.5 / 4 s · INP 200 /
        500 ms · CLS 0.1 / 0.25 · FCP 1.8 / 3 s · TTFB 0.8 / 1.8 s. The current
        report only supplies good sample counts; unavailable shares are not
        estimated.
      </p>
    </div>
  );
}
