"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState, RequirementsArt } from "@/components/record/empty-state";
import { formatPrice, formatPriceRange } from "@/lib/project-ranges";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any -- site rows arrive as loose API JSON */

export interface AutoMatches {
  properties: any[];
  projects: any[];
}

const label = (value?: string | null) =>
  value
    ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
    : "";
const number = (value: unknown) =>
  value == null || value === "" ? null : Number(value);

function Match({
  href,
  code,
  title,
  near,
  meta,
  price,
}: {
  href: string;
  code?: string;
  title: string;
  near: boolean;
  meta: string[];
  price: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">
            {title || "Untitled"}
          </span>
          {near && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Preferred area
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {[code, ...meta].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
        {price}
      </span>
    </Link>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="sticky top-0 z-10 flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-[12px] font-medium text-muted-foreground backdrop-blur">
        {title}
        <span className="tabular-nums">{count}</span>
      </h3>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

/** Site properties and projects that fit a lead's requirement. */
export function AutoMatchSheet({
  open,
  onOpenChange,
  matches,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: AutoMatches;
}) {
  const { properties, projects } = matches;
  const empty = !properties.length && !projects.length;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[450px] !max-w-[450px] flex-col gap-0 border-l p-0"
      >
        <SheetHeader className="shrink-0 border-b px-5 py-4">
          <SheetTitle className="text-[16px]">Matches</SheetTitle>
          <SheetDescription>
            Available properties and projects that fit this requirement.
          </SheetDescription>
        </SheetHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            empty && "flex items-center justify-center p-6",
          )}
        >
          {empty ? (
            <EmptyState
              art={<RequirementsArt />}
              title="No matches yet"
              hint="Nothing listed fits this requirement. Widening the budget, area or type usually brings up options."
            />
          ) : (
            <>
              {properties.length > 0 && (
                <Section title="Properties" count={properties.length}>
                  {properties.map((p) => (
                    <Match
                      key={`property-${p.id}`}
                      href={`/properties/${p.id}`}
                      code={p.code}
                      title={p.title}
                      near={Number(p.locality_match) === 1}
                      meta={[
                        label(p.property_type),
                        p.listing_type === "Rent"
                          ? "For rent"
                          : p.listing_type === "Sell"
                            ? "For sale"
                            : "",
                        number(p.bedrooms) ? `${p.bedrooms} BHK` : "",
                        number(p.area_sqft)
                          ? `${Math.round(Number(p.area_sqft)).toLocaleString("en-IN")} sqft`
                          : "",
                        p.locality || p.city,
                      ]}
                      price={`${formatPrice(number(p.price))}${p.listing_type === "Rent" && number(p.price) ? "/mo" : ""}`}
                    />
                  ))}
                </Section>
              )}
              {projects.length > 0 && (
                <Section title="Projects" count={projects.length}>
                  {projects.map((p) => (
                    <Match
                      key={`project-${p.id}`}
                      href={`/projects/${p.id}`}
                      code={p.code}
                      title={p.name}
                      near={Number(p.locality_match) === 1}
                      meta={[
                        label(p.project_type),
                        p.bedrooms
                          ? `${String(p.bedrooms).replace(/,/g, ", ")} BHK`
                          : "",
                        `${p.units} ${Number(p.units) === 1 ? "unit" : "units"}`,
                        p.locality || p.city,
                      ]}
                      price={formatPriceRange(
                        number(p.min_price),
                        number(p.max_price),
                      )}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
