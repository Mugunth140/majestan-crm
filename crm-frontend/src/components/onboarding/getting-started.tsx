"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Trophy, X } from "lucide-react";
import { meApi } from "@/lib/me-api";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "./steps";

/** The first-steps card at the top of the dashboard, until every step is done or it's put away. */
export function GettingStarted() {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    meApi.checklist().then((r) => { setItems(r.items); setHidden(r.dismissed || r.items.every((i) => i.done)); }).catch(() => {});
  }, []);

  if (hidden || !items) return null;
  const done = items.filter((i) => i.done).length;

  const dismiss = () => {
    setHidden(true);
    void meApi.updateOnboarding({ checklist_dismissed_at: new Date().toISOString() }).catch(() => {});
  };

  return (
    <section aria-label="Getting started" className="relative overflow-hidden rounded-xl border bg-card p-4 md:p-5">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[#2FB585]/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3.5 lg:w-72 lg:shrink-0">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#5FE0B0,#0B8F66_60%,#05543C)] text-white shadow-[0_4px_14px_-4px_rgba(11,143,102,0.6)]">
            <Trophy className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-foreground">Getting started</p>
            <p className="text-[12.5px] text-muted-foreground">{done} of {items.length} done. Finish them all for the badge.</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-[#2FB585] transition-[width] duration-700" style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <ul className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className={cn("group flex h-full items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                i.done ? "border-transparent bg-foreground/[0.03]" : "hover:border-foreground/20 hover:bg-foreground/[0.02]")}>
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", i.done ? "bg-[#2FB585] text-black" : "border border-foreground/25")}>
                  {i.done && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cn("min-w-0 flex-1 text-[13px] leading-snug", i.done ? "text-muted-foreground line-through decoration-foreground/30" : "text-foreground")}>{i.title}</span>
                {!i.done && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={dismiss} aria-label="Hide getting started"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
        <X className="size-4" />
      </button>
    </section>
  );
}
