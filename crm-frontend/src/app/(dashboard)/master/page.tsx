"use client";

import Link from "next/link";
import {
  Armchair, BedDouble, Building2, ChevronRight, ClipboardList, Filter, Map, MapPin, Plug, Receipt, Ruler, Signpost, Sparkles, UserSearch,
  type LucideIcon,
} from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { NAVIGATION } from "@/components/layout/nav-items";
import { ListFrame } from "@/components/layout/list-page";

// Icon, colour and a one-line summary per registry; the list itself comes from the sidebar.
const DETAILS: Record<string, { icon: LucideIcon; color: string; description: string }> = {
  "/master/amenities": { icon: Sparkles, color: "text-fuchsia-600 dark:text-fuchsia-400", description: "Features a property or project can list." },
  "/master/sources": { icon: Filter, color: "text-blue-600 dark:text-blue-400", description: "Channels incoming leads come from." },
  "/master/hr-sources": { icon: UserSearch, color: "text-indigo-600 dark:text-indigo-400", description: "Where HR candidates are found." },
  "/master/property-types": { icon: Building2, color: "text-violet-600 dark:text-violet-400", description: "How properties are classified." },
  "/master/cities": { icon: MapPin, color: "text-emerald-600 dark:text-emerald-400", description: "Cities you list and operate in." },
  "/master/sublocations": { icon: Map, color: "text-amber-600 dark:text-amber-400", description: "Localities within each city." },
  "/master/road-names": { icon: Signpost, color: "text-orange-600 dark:text-orange-400", description: "Roads used in property addresses." },
  "/master/room-names": { icon: BedDouble, color: "text-rose-600 dark:text-rose-400", description: "Room labels for floor plans." },
  "/master/room-dimensions": { icon: Ruler, color: "text-teal-600 dark:text-teal-400", description: "Standard room sizes." },
  "/master/furnishing-items": { icon: Armchair, color: "text-yellow-600 dark:text-yellow-400", description: "Furniture and fittings to list." },
  "/master/utilities": { icon: Plug, color: "text-cyan-600 dark:text-cyan-400", description: "Utilities a property can include." },
  "/master/specifications": { icon: ClipboardList, color: "text-sky-600 dark:text-sky-400", description: "Construction specification items." },
  "/master/registration-charges": { icon: Receipt, color: "text-lime-600 dark:text-lime-400", description: "Registration fee settings." },
};

const REGISTRIES = NAVIGATION.find((item) => item.subItems?.some((s) => s.href.startsWith("/master/")))?.subItems ?? [];

export default function MasterRegistryOverview() {
  return (
    <>
      <MobileHeader title="Master Registry" showBack />
      <ListFrame>
        <div className="px-4 pb-24 pt-3 md:px-5 md:pb-6">
          <p className="mb-3 text-[13px] text-muted-foreground">Dropdown options and reference data used across the CRM.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {REGISTRIES.map(({ name, href }) => {
              const d = DETAILS[href] ?? { icon: ClipboardList, color: "text-muted-foreground", description: "" };
              const Icon = d.icon;
              return (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-lg border bg-background px-3.5 py-3 outline-none transition-[background-color,box-shadow] hover:bg-muted/40 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-[#017D58]/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted/70">
                    <Icon className={`size-[18px] ${d.color}`} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{name}</span>
                    {d.description && <span className="block truncate text-[13px] text-muted-foreground">{d.description}</span>}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      </ListFrame>
    </>
  );
}
