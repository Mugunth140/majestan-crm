"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldRow } from "@/components/record/inline-field";
import { cn } from "@/lib/utils";

// The read-only record page shared by projects, properties, builders, ads and
// blog posts: tabs on the left, a summary panel on the right, actions in the
// top bar. Field rows match the editable ones on lead and inbound pages.

const PAGE = "flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]";

/** A label and its value; empty values show a dash. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <FieldRow label={label}>
      <span className={cn("flex min-h-8 min-w-0 items-center px-2 text-[14px]", empty ? "text-muted-foreground/60" : "text-foreground")}>{empty ? "—" : children}</span>
    </FieldRow>
  );
}

/** One group of facts on a tab, two columns wide on desktop. */
export function DataCard({ title, children, columns = true }: { title: string; children: ReactNode; columns?: boolean }) {
  return (
    <section className="@container overflow-hidden rounded-xl border bg-card">
      <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">{title}</h3>
      <div className={cn("px-3 py-2 md:px-4", columns && "grid grid-cols-1 gap-x-8 @xl:grid-cols-2")}>{children}</div>
    </section>
  );
}

export type RecordTab<K extends string> = { key: K; label: string; icon: LucideIcon; count?: number };

function TabButton({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count?: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]")}>{count}</span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

/** The top of the side panel: a picture (or icon) with the record's name. */
export function RecordSummary({ image, icon: Icon, title, subtitle, imageClass = "h-12 w-16 object-cover" }: {
  image?: string | null;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  imageClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b p-4">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail
        <img src={image} alt="" className={cn("shrink-0 rounded-lg border bg-muted", imageClass)} />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground"><Icon className="h-5 w-5" /></span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={title}>{title}</p>
        {subtitle && <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function RecordPage<K extends string>({ title, actions, phone, tabs, active, onTab, aside, children }: {
  title: string;
  /** The top bar's buttons (status, edit…). */
  actions: ReactNode;
  /** What phones show above the tabs, in place of the top bar and side panel. */
  phone: ReactNode;
  tabs: RecordTab<K>[];
  active: K;
  onTab: (key: K) => void;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={PAGE}>
      <MobileHeader title={title} showBack />
      <PageActions><div className="flex items-center gap-2">{actions}</div></PageActions>
      <div className="space-y-3 px-4 pb-4 pt-1 md:hidden">{phone}</div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div role="tablist" aria-label={`${title} sections`}
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0">
            {tabs.map((t) => (
              <TabButton key={t.key} active={active === t.key} onClick={() => onTab(t.key)} icon={t.icon} label={t.label} count={t.count} />
            ))}
          </div>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">{children}</div>
        </div>
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">{aside}</aside>
      </div>
    </div>
  );
}

export function RecordSkeleton({ title }: { title: string }) {
  return (
    <>
      <MobileHeader title={title} showBack />
      <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
          </div>
          <div className="space-y-5 p-4 md:p-10">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        </div>
        <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
          <div className="flex items-center gap-3 border-b p-4">
            <Skeleton className="h-12 w-16 rounded-lg" />
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
          </div>
          <div className="space-y-3 p-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
        </div>
      </div>
    </>
  );
}

/** The wide "Edit …" button phones show under the summary. */
export const PHONE_EDIT = "flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground/[0.06] px-3 text-[15px] font-medium text-foreground";
