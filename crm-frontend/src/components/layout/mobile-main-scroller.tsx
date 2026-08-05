"use client";

import { useMobileHeader } from "./mobile-header-context";
import { type ReactNode, useEffect, useRef } from "react";

export function MainScrollArea({ children }: { children: ReactNode }) {
  const { setIsScrolled, resolvedTitle } = useMobileHeader();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleWindowScroll = () => {
      // On mobile, the body scrolls.
      if (window.innerWidth < 768) {
        setIsScrolled(window.scrollY > 35);
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
      className="flex-1 w-full md:overflow-x-hidden md:overflow-y-auto scrollbar-hide lg:px-8 lg:pb-8 lg:pt-8 relative md:flex md:flex-col"
    >
      <div className="md:hidden px-4 pb-2 pt-[calc(env(safe-area-inset-top)+4.5rem)]">
        <h1 className="text-[34px] font-bold tracking-tight text-foreground leading-tight">{resolvedTitle}</h1>
      </div>
      {children}
      {/* Spacer to ensure content isn't hidden behind the floating bottom navbar on mobile */}
      <div className="md:hidden h-[calc(5rem+env(safe-area-inset-bottom))] shrink-0 w-full" />
    </main>
  );
}