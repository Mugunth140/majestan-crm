"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { NAVIGATION } from "@/components/layout/nav-items";
import { MODULE_GROUPS } from "@/components/mobile/app-modules";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultNavAccess, NAV_KEYS, type NavKey } from "@/lib/nav-access";
import { cn } from "@/lib/utils";

const GROUPS = MODULE_GROUPS.map((g) => ({
  title: g.title,
  items: g.hrefs
    .map((href) => NAVIGATION.find((n) => (n.href ?? "/master") === href))
    .filter((n): n is (typeof NAVIGATION)[number] & { key: NavKey } => !!n?.key),
}));

/**
 * One checkbox per sidebar module. Until an admin ticks anything the user has
 * the defaults for their role and department; the first change saves a list
 * of their own, and "Use defaults" goes back.
 */
export function SidebarAccess({ role, department, blogAccess, value, disabled, onChange }: {
  role: string;
  department: string;
  blogAccess: boolean;
  /** The user's own list; null while they're on the defaults. */
  value: string[] | null;
  disabled?: boolean;
  onChange: (next: string[] | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const defaults = defaultNavAccess(role, department, blogAccess);
  const shown = new Set<string>(value ?? defaults);
  const custom = value !== null;

  const commit = async (next: string[] | null) => {
    setBusy(true);
    try { await onChange(next); } catch { /* toast shown */ } finally { setBusy(false); }
  };
  const set = (keys: string[], on: boolean) => {
    const next = new Set(shown);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    void commit(NAV_KEYS.filter((k) => next.has(k)));
  };

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2">
        <h3 className="text-[14px] font-semibold text-foreground">Sidebar</h3>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[12px] font-medium",
          custom ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground",
        )}>
          {custom ? "Custom" : `Defaults for ${department && role === "Staff" ? department : role}`}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {custom && !disabled && (
            <button type="button" disabled={busy} onClick={() => void commit(null)}
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50">
              <RotateCcw className="size-3.5" /> Use defaults
            </button>
          )}
        </span>
      </div>

      <div className="divide-y">
        {GROUPS.map((g) => {
          const keys = g.items.map((i) => i.key);
          const all = keys.every((k) => shown.has(k));
          return (
            <div key={g.title} className="px-4 py-3">
              <div className="mb-1.5 flex h-6 items-center justify-between">
                <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</span>
                {!disabled && (
                  <button type="button" disabled={busy} onClick={() => set(keys, !all)}
                    className="rounded px-1.5 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50">
                    {all ? "Clear" : "Select all"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const on = shown.has(item.key);
                  return (
                    <label key={item.key}
                      className={cn("-mx-2 flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 transition-colors hover:bg-accent/60", disabled && "cursor-default hover:bg-transparent")}>
                      <Checkbox checked={on} disabled={disabled || busy} onCheckedChange={(v) => set([item.key], !!v)} />
                      <Icon className={cn("size-4 shrink-0 transition-opacity", item.color, !on && "opacity-40")} strokeWidth={1.75} />
                      <span className={cn("truncate text-[14px]", on ? "text-foreground" : "text-muted-foreground")}>{item.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">
        The dashboard is always shown. Changing someone&rsquo;s role or department puts them back on the defaults.
      </p>
    </section>
  );
}
