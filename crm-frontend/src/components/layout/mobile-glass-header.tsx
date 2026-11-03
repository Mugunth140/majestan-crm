"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { useMobileHeader } from "./mobile-header-context";
import { CreateSheet, createRouteFor } from "./mobile-create";
import { guardNavigation } from "@/lib/leave-guard";
import { cn } from "@/lib/utils";

/**
 * Phone navigation bar. Clear over the large page title, it turns into frosted
 * material with the small title once the page scrolls under it. The trailing
 * "+" creates a record in the current module, or opens the Create sheet on Home.
 */
export function MobileGlassHeader() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { resolvedTitle, showBack: overrideBack, isScrolled } = useMobileHeader();
  const [createOpen, setCreateOpen] = useState(false);

  const showBack = overrideBack || pathname.split("/").filter(Boolean).length >= 2;
  const createRoute = createRouteFor(pathname);
  const canCreate = !!createRoute || pathname === "/";

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 select-none border-b pt-[env(safe-area-inset-top)] transition-[background-color,border-color,backdrop-filter] duration-200 md:hidden",
          isScrolled ? "m-bar" : "border-transparent bg-transparent",
        )}
      >
        <div className="relative flex h-11 items-center justify-between px-2">
          <div className="z-10 flex min-w-0 items-center">
            {showBack && (
              <button
                type="button"
                onClick={() => guardNavigation(() => router.back())}
                className="flex h-11 items-center pr-2 text-[#017D58] active:opacity-50 dark:text-[#2FB585]"
              >
                <ChevronLeft className="size-7" strokeWidth={2.25} />
                <span className="-ml-0.5 text-[17px]">Back</span>
              </button>
            )}
          </div>

          <h1
            aria-hidden={!isScrolled}
            className={cn(
              "pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold tracking-tight text-foreground transition-opacity duration-150",
              isScrolled ? "opacity-100" : "opacity-0",
            )}
          >
            {resolvedTitle}
          </h1>

          <div className="z-10 flex items-center pr-1">
            {canCreate && (
              <button
                type="button"
                aria-label="Create"
                onClick={() => (createRoute ? router.push(createRoute) : setCreateOpen(true))}
                className="flex size-9 items-center justify-center rounded-full bg-[#017D58] text-white shadow-[0_2px_8px_-2px_rgba(1,125,88,0.5)] transition-transform active:scale-90 dark:bg-[#2FB585] dark:text-black"
              >
                <Plus className="size-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </header>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
