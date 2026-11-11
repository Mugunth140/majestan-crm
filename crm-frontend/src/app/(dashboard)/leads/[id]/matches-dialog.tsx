"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, RequirementsArt } from "@/components/record/empty-state";
import {
  HEADER_BUTTON,
  HEADER_PRIMARY,
} from "@/components/record/header-actions";
import { formatPrice, formatPriceRange } from "@/lib/project-ranges";
import {
  MAX_SHARE,
  listingHref,
  listingUrl,
  type ListingKind,
  type SharedListing,
} from "@/lib/listing-share";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useDebounce } from "@/hooks/use-debounce";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/* eslint-disable @typescript-eslint/no-explicit-any -- site rows arrive as loose API JSON */

export interface AutoMatches {
  properties: any[];
  projects: any[];
}

type Busy = "email" | "whatsapp" | "download" | null;

const label = (value?: string | null) =>
  value
    ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
    : "";
const number = (value: unknown) =>
  value == null || value === "" ? null : Number(value);

/** One match as the dialog shows it and as it is shared. */
interface Row extends SharedListing {
  photo: string | null;
  meta: string[];
  near: boolean;
  /** Outside the requirement but the closest available. */
  similar: boolean;
}

function propertyRow(p: any): Row {
  const rent = p.listing_type === "Rent";
  const price = formatPrice(number(p.price));
  return {
    kind: "property",
    id: p.id,
    code: p.code || `#${p.id}`,
    title: p.title || "Untitled",
    shareTitle: p.share_title || undefined,
    price: price === "-" ? "Price on request" : `${price}${rent ? "/mo" : ""}`,
    subtitle: [label(p.property_type), p.locality || p.city]
      .filter(Boolean)
      .join(" · "),
    url: listingUrl("property", p.slug),
    photo: p.photo,
    near: Number(p.locality_match) === 1,
    similar: p.match === "similar",
    meta: [
      label(p.property_type),
      rent ? "For rent" : p.listing_type === "Sell" ? "For sale" : "",
      number(p.bedrooms) ? `${p.bedrooms} BHK` : "",
      Number(p.area_sqft) >= 50
        ? `${Math.round(Number(p.area_sqft)).toLocaleString("en-IN")} sqft`
        : "",
      p.locality || p.city,
    ].filter(Boolean),
  };
}

function projectRow(p: any): Row {
  return {
    kind: "project",
    id: p.id,
    code: p.code || `#${p.id}`,
    title: p.name,
    price: formatPriceRange(number(p.min_price), number(p.max_price)),
    subtitle: [label(p.project_type), p.locality || p.city]
      .filter(Boolean)
      .join(" · "),
    url: listingUrl("project", p.slug),
    photo: p.photo,
    near: Number(p.locality_match) === 1,
    similar: p.match === "similar",
    meta: [
      label(p.project_type),
      p.bedrooms ? `${String(p.bedrooms).replace(/,/g, ", ")} BHK` : "",
      `${p.units} ${Number(p.units) === 1 ? "unit" : "units"}`,
      p.locality || p.city,
    ].filter(Boolean),
  };
}

const keyOf = (l: { kind: ListingKind; id: number }) => `${l.kind}:${l.id}`;

function MatchRow({
  row,
  picked,
  full,
  onToggle,
}: {
  row: Row;
  picked: boolean;
  full: boolean;
  onToggle: () => void;
}) {
  const disabled = !picked && full;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50",
        picked && "bg-muted/60 hover:bg-muted/70",
        disabled && "cursor-not-allowed opacity-60",
      )}
      title={disabled ? `Share up to ${MAX_SHARE} at a time` : undefined}
    >
      <Checkbox
        checked={picked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={`Select ${row.title}`}
      />
      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {row.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos come from the site's CDN at any size
          <img
            src={row.photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <Building2 className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Link
            href={listingHref(row)}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-[14px] font-medium text-foreground hover:underline"
          >
            {row.title}
          </Link>
          {row.near && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Preferred area
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
          {[row.code, ...row.meta].join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-right text-[13px] font-medium tabular-nums text-foreground">
        {row.price}
      </span>
    </label>
  );
}

/**
 * Properties and projects that fit a requirement. Staff tick the ones to send
 * and share them by email or WhatsApp; each goes as a branded PDF.
 */
export function MatchesDialog({
  leadId,
  open,
  onOpenChange,
  matches,
  requirement,
  canEmail,
  canWhatsapp,
  onEmail,
  onWhatsapp,
  onDownload,
}: {
  leadId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: AutoMatches;
  /** "Requirement #2", for the description. */
  requirement: string;
  canEmail: boolean;
  canWhatsapp: boolean;
  onEmail: (listings: SharedListing[]) => Promise<void>;
  onWhatsapp: (listings: SharedListing[]) => Promise<void>;
  onDownload: (listings: SharedListing[]) => Promise<void>;
}) {
  // Typing looks through every available listing, for ones the matches missed.
  const [query, setQuery] = useState("");
  const term = useDebounce(query.trim(), 300);
  const searching = term.length >= 2;
  const [found, setFound] = useState<(AutoMatches & { term: string }) | null>(null);
  const [searchError, setSearchError] = useState(false);
  useEffect(() => {
    if (!searching) return;
    let live = true;
    apiFetch(`${API_URL}/leads/${leadId}/listings/search?q=${encodeURIComponent(term)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!live) return;
        if (!body?.success) throw new Error();
        setSearchError(false);
        setFound({ term, properties: body.data.properties ?? [], projects: body.data.projects ?? [] });
      })
      .catch(() => { if (live) setSearchError(true); });
    return () => { live = false; };
  }, [leadId, term, searching]);
  const results = searching && found?.term === term ? found : null;
  const loadingSearch = searching && !results && !searchError;

  const source = searching ? (results ?? { properties: [], projects: [] }) : matches;
  const properties = source.properties.map(propertyRow);
  const projects = source.projects.map(projectRow);
  const [tab, setTab] = useState<ListingKind>(
    matches.properties.length || !matches.projects.length ? "property" : "project",
  );
  const [picked, setPicked] = useState<Row[]>([]);
  const [busy, setBusy] = useState<Busy>(null);

  const rows = tab === "property" ? properties : projects;
  const isPicked = (row: Row) => picked.some((p) => keyOf(p) === keyOf(row));
  const toggle = (row: Row) =>
    setPicked((list) =>
      list.some((p) => keyOf(p) === keyOf(row))
        ? list.filter((p) => keyOf(p) !== keyOf(row))
        : [...list, row],
    );
  const full = picked.length >= MAX_SHARE;
  const empty = !searching && !properties.length && !projects.length;

  const run = async (
    kind: Exclude<Busy, null>,
    action: (listings: SharedListing[]) => Promise<void>,
  ) => {
    setBusy(kind);
    try {
      // Only what the share needs; photos and labels stay in the dialog.
      await action(
        picked.map(({ kind, id, code, title, price, subtitle, url }) => ({
          kind,
          id,
          code,
          title,
          price,
          subtitle,
          url,
        })),
      );
    } finally {
      setBusy(null);
    }
  };

  const tabs: { key: ListingKind; label: string; count: number }[] = [
    { key: "property", label: "Properties", count: properties.length },
    { key: "project", label: "Projects", count: projects.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,88dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 gap-1 px-5 pt-5 pb-0">
          <DialogTitle className="text-[16px]">Matches</DialogTitle>
          <DialogDescription>
            {searching ? (
              <>Every available listing matching your search; booked, sold and rented ones are left out.</>
            ) : (
              <>
                Available listings that fit{" "}
                {requirement === "Requirement"
                  ? "this requirement"
                  : requirement.toLowerCase()}
                .
              </>
            )}{" "}
            Pick up to {MAX_SHARE} to send as PDFs.
          </DialogDescription>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any available property or project by name, code or area…"
              aria-label="Search listings"
              className="h-9 w-full rounded-lg border bg-background pl-9 pr-9 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {loadingSearch ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : query ? (
              <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {!empty && (
            <div
              role="tablist"
              aria-label="Listing type"
              className="-mx-5 mt-3 flex gap-5 border-b px-5"
            >
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] transition-colors",
                    tab === t.key
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-[240px] flex-1 overflow-y-auto">
          {empty ? (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                art={<RequirementsArt />}
                title="No matches yet"
                hint="Nothing listed in this city is close to this requirement yet. New listings will show up here as they are added."
              />
            </div>
          ) : rows.length ? (
            [rows.filter((r) => !r.similar), rows.filter((r) => r.similar)].map(
              (group, i) =>
                group.length > 0 && (
                  <section key={i}>
                    {i === 1 && (
                      <div className="sticky top-0 z-10 border-y bg-muted/60 px-5 py-2 backdrop-blur first:border-t-0">
                        <p className="text-[13px] font-medium text-foreground">
                          {rows.some((r) => !r.similar)
                            ? "Similar listings"
                            : "No exact matches · similar listings"}
                        </p>
                        <p className="text-[12px] text-muted-foreground">
                          Close to the requirement, but outside its budget, size
                          or type.
                        </p>
                      </div>
                    )}
                    <div className="divide-y divide-border/60">
                      {group.map((row) => (
                        <MatchRow
                          key={keyOf(row)}
                          row={row}
                          picked={isPicked(row)}
                          full={full}
                          onToggle={() => toggle(row)}
                        />
                      ))}
                    </div>
                  </section>
                ),
            )
          ) : (
            <p className="px-5 py-16 text-center text-[14px] text-muted-foreground">
              {searching
                ? loadingSearch
                  ? "Searching…"
                  : searchError
                    ? "Couldn't search listings. Try again."
                    : `No available ${tab === "property" ? "properties" : "projects"} match “${term}”.`
                : `No ${tab === "property" ? "properties" : "projects"} fit this requirement.`}
            </p>
          )}
        </div>

        {!empty && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
            <p className="text-[13px] text-muted-foreground">
              {picked.length ? (
                <>
                  <span className="font-medium text-foreground">
                    {picked.length}
                  </span>{" "}
                  selected
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="ml-2 text-foreground/80 underline-offset-2 hover:underline"
                  >
                    Clear
                  </button>
                </>
              ) : (
                "Select listings to share"
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!picked.length || !!busy}
                onClick={() => run("download", onDownload)}
                className={HEADER_BUTTON}
              >
                {busy === "download" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Download PDF
              </button>
              <button
                type="button"
                disabled={!picked.length || !!busy || !canWhatsapp}
                title={
                  canWhatsapp
                    ? undefined
                    : "Add a WhatsApp or mobile number to this lead first"
                }
                onClick={() => run("whatsapp", onWhatsapp)}
                className={HEADER_BUTTON}
              >
                {busy === "whatsapp" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Share on WhatsApp
              </button>
              <button
                type="button"
                disabled={!picked.length || !!busy || !canEmail}
                title={
                  canEmail
                    ? undefined
                    : "Add an email address to this lead first"
                }
                onClick={() => run("email", onEmail)}
                className={HEADER_PRIMARY}
              >
                {busy === "email" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Send by email
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
