"use client";

import { useEffect, useState } from "react";
import { PrismarkAssembly } from "@/components/brand/prismark-loader";
import { cn } from "@/lib/utils";
import "./refresh-pill.css";

const FLAG = "crm_refreshing";
const RELOAD_DELAY_MS = 450; // let the pill land before the page goes away
const SETTLE_MS = 900; // keep it up a moment after the reloaded page mounts

type Phase = "hidden" | "in" | "out";

// Ctrl/⌘+R (and F5) drop a "Refreshing…" pill from the top centre, then reload.
// A session flag carries the pill across the reload so it eases out once the page is back.
export function RefreshPill() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    let remove: ReturnType<typeof setTimeout> | undefined;
    try {
      if (sessionStorage.getItem(FLAG)) {
        sessionStorage.removeItem(FLAG);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPhase("in");
        settle = setTimeout(() => setPhase("out"), SETTLE_MS);
        remove = setTimeout(() => setPhase("hidden"), SETTLE_MS + 400);
      }
    } catch {}

    const onKey = (e: KeyboardEvent) => {
      const reload = e.key === "F5" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r");
      if (!reload || e.repeat) return;
      e.preventDefault();
      setPhase("in");
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {}
      setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(settle);
      clearTimeout(remove);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (phase === "hidden") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "refresh-pill flex h-9 items-center gap-2.5 rounded-full bg-[#111] pl-3 pr-4 text-[13px] font-medium text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)_inset] dark:bg-white dark:text-[#111]",
          phase === "out" && "refresh-pill--out",
        )}
      >
        <PrismarkAssembly loop className="size-4 text-[#2FB585] dark:text-[#017D58]" />
        Refreshing…
      </div>
    </div>
  );
}
