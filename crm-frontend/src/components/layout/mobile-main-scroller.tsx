"use client";

import { useMobileHeader } from "./mobile-header-context";
import { type ReactNode, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { hidesTabBar } from "./mobile-navbar";
import { cn } from "@/lib/utils";

export function MainScrollArea({ children }: { children: ReactNode }) {
  const { setIsScrolled, resolvedTitle } = useMobileHeader();
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const handleWindowScroll = () => {
      // On mobile, the body scrolls.
      if (window.innerWidth < 768) {
        setIsScrolled(window.scrollY > 30);
      }
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [setIsScrolled]);

  const handleElementScroll = (e: React.UIEvent<HTMLElement>) => {
    // On desktop, the main element scrolls.
    if (window.innerWidth >= 768) {
      setIsScrolled(e.currentTarget.scrollTop > 35);
    }
  };

  return (
    <main
      ref={mainRef}
      onScroll={handleElementScroll}
      className="flex-1 w-full md:overflow-x-hidden md:overflow-y-auto scrollbar-hide lg:px-6 lg:pb-8 lg:pt-6 relative md:flex md:flex-col md:min-h-0"
    >
      {/* Large title under the clear nav bar; it hands over to the bar's small title on scroll */}
      <div className="md:hidden px-4 pb-1 pt-[calc(env(safe-area-inset-top)+2.75rem)]">
        <h1 className="truncate text-[32px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">{resolvedTitle}</h1>
      </div>
      {children}
      {/* Room for the dock, so the last row scrolls clear of it */}
      <div className={cn("md:hidden w-full shrink-0", hidesTabBar(pathname) ? "h-[env(safe-area-inset-bottom)]" : "h-[calc(env(safe-area-inset-bottom)+6.5rem)]")} />
    </main>
  );
}