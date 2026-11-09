"use client";

import { useState } from "react";
import { Loader2, Lock, RotateCcw } from "lucide-react";
import { NAVIGATION } from "@/components/layout/nav-items";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultNavAccess, lockedFor, NAV_KEYS, type NavKey } from "@/lib/nav-access";
import { cn } from "@/lib/utils";

/** Every module that can be shown or hidden, in sidebar order. */
const MODULES = NAVIGATION.filter((n): n is (typeof NAVIGATION)[number] & { key: NavKey } => !!n.key);

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
  const locked = lockedFor(role);
  const toggle = (key: NavKey, on: boolean) => {
    const next = new Set(shown);
    if (on) next.add(key);
    else next.delete(key);
    void commit(NAV_KEYS.filter((k) => next.has(k) && !locked.includes(k)));
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

      <div className="grid grid-cols-1 gap-0.5 p-2 sm:grid-cols-2">
        {MODULES.map((item) => {
          const Icon = item.icon;
          const lockedOut = locked.includes(item.key);
          const on = !lockedOut && shown.has(item.key);
          return (
            <label key={item.key}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-2 transition-colors",
                lockedOut || disabled ? "cursor-default" : "cursor-pointer hover:bg-accent/60",
              )}>
              <Checkbox checked={on} disabled={disabled || busy || lockedOut} onCheckedChange={(v) => toggle(item.key, !!v)} />
              <Icon className={cn("size-4 shrink-0 transition-opacity", item.color, !on && "opacity-40")} strokeWidth={1.75} />
              <span className={cn("min-w-0 flex-1 truncate text-[14px]", on ? "text-foreground" : "text-muted-foreground")}>{item.name}</span>
              {lockedOut && (
                <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
                  <Lock className="size-3" /> {item.key === "logger" ? "Team Lead and up" : "Admin & manager"}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">
        The dashboard is always shown. Changing someone&rsquo;s role or department puts them back on the defaults.
      </p>
    </section>
  );
}
