"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { SETTINGS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** A settings page: one readable column. On phones the title sits in the app header. */
export function SettingsPage({ title, description, children, root }: { title: string; description?: string; children: ReactNode; root?: boolean }) {
  return (
    <>
      <MobileHeader title={title} showBack={!root} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-2 md:px-0 md:pb-10 md:pt-1">
        <header className="mb-5 max-md:hidden">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
          {description && <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>}
        </header>
        {description && <p className="mb-4 text-[13.5px] text-muted-foreground md:hidden">{description}</p>}
        <div className="space-y-4">{children}</div>
      </div>
    </>
  );
}

/** A card of related settings, with an optional footer for its Save button. */
export function Section({ title, description, children, footer, className }: {
  title?: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-background", className)}>
      {(title || description) && (
        <div className="px-5 pt-4">
          {title && <h2 className="text-[14.5px] font-semibold text-foreground">{title}</h2>}
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-5 py-3">{footer}</div>}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-[13px] font-medium text-foreground/85">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Phones have no sidebar panel, so the Settings home lists the other pages. */
export function MobileSettingsNav() {
  return (
    <nav aria-label="Settings" className="overflow-hidden rounded-2xl border bg-card md:hidden">
      {SETTINGS.subItems!.slice(1).map((s) => {
        const Icon = s.icon!;
        return (
          <Link key={s.href} href={s.href} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0 active:bg-muted/60">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted/70">
              <Icon className={cn("size-[17px]", s.color)} strokeWidth={1.75} />
            </span>
            <span className="flex-1 text-[15px] text-foreground">{s.name}</span>
            <ChevronRight className="size-4 text-muted-foreground/60" />
          </Link>
        );
      })}
    </nav>
  );
}
