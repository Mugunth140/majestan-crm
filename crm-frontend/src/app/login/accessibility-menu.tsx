"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Popover } from "@cloudflare/kumo/components/popover";
import { MoonIcon,WheelchairMotionIcon, SunIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
] as const;

// Floating accessibility button; opens a panel with the light / dark theme switcher.
export function AccessibilityMenu({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known on the client; avoid a hydration mismatch on the active option.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <Popover>
      <Popover.Trigger
        aria-label="Accessibility options"
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-white/10 text-gray-300 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[popup-open]:bg-white/20",
          className,
        )}
      >
        <WheelchairMotionIcon size={18} weight="fill" />
      </Popover.Trigger>
      <Popover.Content side="top" align="start" sideOffset={10} className="w-60 p-3">
        <Popover.Title className="text-sm font-semibold">Accessibility</Popover.Title>
        <p className="mt-3 mb-2 text-xs font-medium text-kumo-subtle">Theme</p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-1 rounded-lg bg-kumo-recessed p-1">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const active = mounted && resolvedTheme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-kumo-base text-kumo-default shadow-sm ring-1 ring-kumo-line"
                    : "text-kumo-subtle hover:text-kumo-default",
                )}
              >
                <Icon size={16} weight={active ? "fill" : "regular"} />
                {label}
              </button>
            );
          })}
        </div>
      </Popover.Content>
    </Popover>
  );
}
