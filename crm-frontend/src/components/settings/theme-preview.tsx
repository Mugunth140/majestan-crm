import { cn } from "@/lib/utils";

/** A tiny drawing of the app in a theme, so the choice is seen rather than read. */
export function ThemePreview({ mode, className }: { mode: "light" | "dark" | "system"; className?: string }) {
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
  return (
    <div className={cn("flex h-20 overflow-hidden rounded-md ring-1 ring-black/10 dark:ring-white/10", className)}>
      {mode === "system" ? <>{pane(false)}{pane(true)}</> : pane(mode === "dark")}
    </div>
  );
}
