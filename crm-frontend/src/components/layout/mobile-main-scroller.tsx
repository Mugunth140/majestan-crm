"use client";

import { useMobileHeader } from "./mobile-header-context";
import { type ReactNode } from "react";

export function MainScrollArea({ children }: { children: ReactNode }) {
  const { setIsScrolled, resolvedTitle } = useMobileHeader();

  return (
    <main
      onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 35)}
      className="flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8 lg:pt-8 relative"
    >
      <div className="md:hidden px-4 pb-2 pt-[calc(env(safe-area-inset-top)+4.5rem)]">
        <h1 className="text-[34px] font-bold tracking-tight text-foreground leading-tight">{resolvedTitle}</h1>
      </div>
      {children}
    </main>
  );
}