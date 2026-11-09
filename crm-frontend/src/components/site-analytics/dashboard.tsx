"use client";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Info,
  TriangleAlert,
} from "lucide-react";
import { PeriodPicker } from "@/components/shared/period-picker";
import { PageActions } from "@/components/layout/page-actions";
import { DataCard } from "@/components/record/record-page";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistedState } from "@/hooks/use-persisted-state";
import {
  bounceRate,
  change,
  conversions,
  countryLabel,
  DEFAULT_RANGE,
  duration,
  EVENT_LABELS,
  number,
  percent,
  restoreRange,
  selectedRange,
  MAX_RANGE_DAYS,
  type RangeSelection,
  type SiteReport,
} from "@/lib/site-analytics";
import { RankedPanel, CONTROL, type Ranking } from "./ranked-panel";
import { TrafficChart } from "./traffic-chart";
import { PropertyInsights } from "./property-insights";
import { SpeedInsights } from "./speed-insights";
import { useSiteAnalytics } from "./use-site-analytics";

export function AnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading website analytics"
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
function KPIs({
  report,
  previous,
}: {
  report: SiteReport;
  previous: SiteReport | null;
}) {
  const tiles = [
    {
      label: "Visitors",
      value: report.overview.visitors,
      prior: previous?.overview.visitors,
      format: number,
      tip: "Daily pseudonyms estimate visitors, so these are not cross-day unique people.",
    },
    {
      label: "Page views",
      value: report.overview.pageviews,
      prior: previous?.overview.pageviews,
      format: number,
    },
    {
      label: "Bounce rate",
      value: bounceRate(report),
      prior: previous ? bounceRate(previous) : undefined,
      format: percent,
      inverse: true,
    },
    {
      label: "Avg. engagement time",
      value: report.overview.avg_engagement_ms,
      prior: previous?.overview.avg_engagement_ms,
      format: duration,
    },
    {
      label: "Conversions",
      value: conversions(report),
      prior: previous ? conversions(previous) : undefined,
      format: number,
    },
  ];
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((tile) => {
        const delta = change(tile.value, tile.prior),
          better =
            delta === null || delta === 0
              ? null
              : tile.inverse
                ? delta < 0
                : delta > 0;
        return (
          <section
            key={tile.label}
            className="min-w-0 rounded-xl border bg-card p-4"
          >
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <h2>{tile.label}</h2>
              {tile.tip && (
                <button
                  type="button"
                  title={tile.tip}
                  aria-label={tile.tip}
                  className="rounded focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Info className="size-3" />
                </button>
              )}
            </div>
            <p
              className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
              title={tile.format(tile.value)}
            >
              {tile.format(tile.value)}
            </p>
            <p
              className={`mt-3 flex items-center gap-1 text-xs tabular-nums ${better === null ? "text-muted-foreground" : better ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
            >
              {delta !== null && (
                <>
                  {delta !== 0 &&
                    (delta > 0 ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    ))}
                  <span>
                    {delta > 0 ? "+" : ""}
                    {number(delta)}% vs previous
                  </span>
                </>
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}
export function TrafficPanels({ report }: { report: SiteReport }) {
  const dims = (keys: [string, string][]): Ranking[] =>
    keys.map(([key, label]) => ({
      key,
      label,
      rows: (report.dimensions[key] ?? []).map((r) => ({
        label: String(r.label),
        count: r.pageviews,
      })),
      total: report.overview.pageviews,
    }));
  const events: Ranking[] = [
    ["interaction", "Interactions"],
    ["conversion", "Conversions"],
    ["error", "Errors"],
  ].map(([key, label]) => ({
    key,
    label,
    rows: report.events
      .filter((e) => e.kind === key)
      .map((e) => ({
        label:
          (EVENT_LABELS[e.name] ?? e.name) +
          (e.name === "api_error" && e.status_code !== undefined
            ? ` · ${e.status_code}`
            : ""),
        count: e.events,
      })),
    note:
      key === "error"
        ? "The current site report groups API errors without status codes."
        : undefined,
  }));
  return (
    <>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <RankedPanel
          title="Pages"
          groups={dims([
            ["path", "Pages"],
            ["route", "Routes"],
            ["hostname", "Hostnames"],
          ])}
        />
        <RankedPanel
          title="Acquisition"
          chart
          groups={dims([
            ["referrer", "Referrers"],
            ["utm_source", "UTM source"],
            ["utm_medium", "UTM medium"],
            ["utm_campaign", "UTM campaign"],
          ])}
          formatLabel={(label) =>
            label === "(unknown)" ? "Direct / unknown" : label
          }
        />
        <RankedPanel
          title="Countries"
          groups={dims([["country", "Countries"]])}
          formatLabel={countryLabel}
          unknownLast
        />
        <RankedPanel
          title="Devices"
          chart
          groups={dims([
            ["device", "Device"],
            ["browser", "Browser"],
            ["os", "OS"],
          ])}
        />
        <RankedPanel
          title="Entry and exit pages"
          groups={[
            {
              key: "entries",
              label: "Entry pages",
              rows: report.entries.map((r) => ({
                label: r.path,
                count: r.sessions,
              })),
              total: report.overview.started_sessions,
            },
            {
              key: "exits",
              label: "Exit pages",
              rows: report.exits.map((r) => ({
                label: r.path,
                count: r.sessions,
              })),
              total: report.overview.started_sessions,
              note: "Last viewed pages; recent sessions may still be active.",
            },
          ]}
        />
        <RankedPanel title="Events" groups={events} />
      </div>
      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          More · language and timezone
        </summary>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <RankedPanel
            title="Language"
            groups={dims([["language", "Languages"]])}
          />
          <RankedPanel
            title="Timezone"
            groups={dims([["timezone", "Timezones"]])}
          />
        </div>
      </details>
    </>
  );
}

const PERIOD_PRESETS: { value: Exclude<RangeSelection["preset"], "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "180", label: "Last 6 months" },
];

export function SiteAnalyticsDashboard() {
  const [selection, setSelection] = usePersistedState<RangeSelection>(
    "site-analytics:range",
    DEFAULT_RANGE,
    { deserialize: restoreRange },
  );
  const [tab, setTab] = useState<"traffic" | "property" | "speed">("traffic");
  const range = selectedRange(selection);
  const {
    report,
    previous,
    error,
    comparisonError,
    loading,
    liveError,
    refresh,
  } = useSiteAnalytics(range);
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 pb-8 text-foreground">
      <PageActions mobile>
        <span
          title="Visitors with pageviews received in the last five minutes; refreshed every 30 seconds while visible."
          className="inline-flex h-8 items-center gap-2 px-2 text-sm text-muted-foreground"
        >
          <span
            className={`size-1.5 rounded-full ${liveError ? "bg-muted-foreground" : "bg-emerald-500"}`}
          />
          <span className="font-medium tabular-nums text-foreground">
            {liveError
              ? "—"
              : report?.realtime
                ? number(report.realtime.visitors)
                : "—"}
          </span>
          <span>{liveError ? "Unavailable" : "online"}</span>
          <span className="sr-only">visitors in the last 5 minutes</span>
        </span>
        <PeriodPicker<Exclude<RangeSelection["preset"], "custom">>
          presets={PERIOD_PRESETS}
          value={selection.preset}
          from={selection.from}
          to={selection.to}
          timeZone="UTC"
          note={`UTC days · up to ${MAX_RANGE_DAYS} days`}
          onPreset={(preset) => setSelection((s) => ({ ...s, preset }))}
          onRange={(from, to) => setSelection({ preset: "custom", from, to })}
        />
      </PageActions>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex gap-4"
          role="tablist"
          aria-label="Website analytics views"
        >
          {(["traffic", "property", "speed"] as const).map((key) => (
            <button
              type="button"
              key={key}
              role="tab"
              id={`analytics-${key}-tab`}
              aria-controls={`analytics-${key}-panel`}
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`border-b-2 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${tab === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {key === "traffic"
                ? "Web Analytics"
                : key === "property"
                  ? "Property Insights"
                  : "Speed Insights"}
            </button>
          ))}
        </div>
      </div>
      {!range ? (
        <div role="alert" className="rounded-xl border bg-card p-6 text-sm">
          Choose a start and end day at most {MAX_RANGE_DAYS} days apart.
        </div>
      ) : tab === "property" ? (
        <section
          id="analytics-property-panel"
          aria-labelledby="analytics-property-tab"
          role="tabpanel"
        >
          <PropertyInsights from={range.from} to={range.to} />
        </section>
      ) : loading ? (
        <AnalyticsSkeleton />
      ) : error ? (
        <DataCard title="Website analytics unavailable" columns={false}>
          <div role="alert" className="flex items-start gap-3 py-6">
            <TriangleAlert className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm">{error}</p>
              <button className={`${CONTROL} mt-4`} onClick={refresh}>
                Try again
              </button>
            </div>
          </div>
        </DataCard>
      ) : report ? (
        <section
          id={`analytics-${tab}-panel`}
          aria-labelledby={`analytics-${tab}-tab`}
          role="tabpanel"
          className="space-y-6"
        >
          {comparisonError && (
            <p role="status" className="text-sm text-muted-foreground">
              {comparisonError}
            </p>
          )}
          {report.overview.pageviews === 0 &&
          report.events.length === 0 &&
          report.performance.length === 0 ? (
            <DataCard title="No website activity in this range" columns={false}>
              <p className="py-8 text-sm text-muted-foreground">
                Try a different UTC date range. Visits appear here after the
                website collector is enabled and receives traffic.
              </p>
            </DataCard>
          ) : tab === "traffic" ? (
            <>
              <KPIs report={report} previous={previous} />
              <TrafficChart report={report} previous={previous} />
              <TrafficPanels report={report} />
            </>
          ) : (
            <SpeedInsights report={report} />
          )}
        </section>
      ) : null}
    </div>
  );
}
