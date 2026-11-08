"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-context";
import { Section, SettingsPage } from "@/components/settings/settings-ui";
import { cn } from "@/lib/utils";

const THEMES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match device", icon: Monitor },
];

/** A tiny drawing of the app in the theme, so the choice is seen rather than read. */
function Preview({ mode }: { mode: string }) {
  const half = mode === "system";
  const pane = (dark: boolean) => (
    <div className={cn("flex h-full flex-1 gap-1 p-1.5", dark ? "bg-zinc-900" : "bg-zinc-50")}>
      <div className={cn("w-1/4 space-y-1 rounded-sm p-1", dark ? "bg-zinc-800" : "bg-zinc-200/70")}>
        <div className="h-1 w-full rounded-full bg-[#017D58]" />
        <div className={cn("h-1 w-3/4 rounded-full", dark ? "bg-zinc-600" : "bg-zinc-300")} />
        <div className={cn("h-1 w-2/3 rounded-full", dark ? "bg-zinc-600" : "bg-zinc-300")} />
      </div>
      <div className="flex-1 space-y-1">
        <div className={cn("h-3 rounded-sm", dark ? "bg-zinc-800" : "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]")} />
        <div className={cn("h-5 rounded-sm", dark ? "bg-zinc-800" : "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]")} />
      </div>
    </div>
  );
  return <div className="flex h-20 overflow-hidden rounded-md">{half ? <>{pane(false)}{pane(true)}</> : pane(mode === "dark")}</div>;
}

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  // next-themes only knows the choice in the browser.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  return (
    <SettingsPage title="Appearance" description="How the CRM looks on this device.">
      <Section title="Theme">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const on = mounted && theme === t.value;
            return (
              <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => setTheme(t.value)}
                className={cn("rounded-lg border p-1.5 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#017D58]/40",
                  on ? "border-[#017D58] shadow-[0_0_0_1px_#017D58] dark:border-[#2FB585] dark:shadow-[0_0_0_1px_#2FB585]" : "hover:border-foreground/25")}>
                <Preview mode={t.value} />
                <span className="mt-2 flex items-center gap-1.5 px-1 pb-0.5 text-[13px] font-medium">
                  <t.icon className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.label}</span>
                  {on && <Check className="size-3.5 text-[#017D58] dark:text-[#2FB585]" strokeWidth={2.5} />}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Sidebar" description="On computers, keep the sidebar open with labels or as a narrow strip of icons." className="max-md:hidden">
        <div role="radiogroup" aria-label="Sidebar" className="inline-flex rounded-lg bg-muted p-0.5">
          {[{ v: false, l: "Expanded" }, { v: true, l: "Collapsed" }].map(({ v, l }) => (
            <button key={l} type="button" role="radio" aria-checked={isCollapsed === v} onClick={() => setIsCollapsed(v)}
              className={cn("h-7 rounded-md px-3 text-[13px] font-medium transition-colors", isCollapsed === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
      </Section>
    </SettingsPage>
  );
}
