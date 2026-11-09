"use client";

import { cn } from "@/lib/utils";

/**
 * A short list of options as toggle chips; any number can be on. An
 * `exclusive` option (e.g. "Any") clears the others, and picking another
 * clears it.
 */
export function ChipMultiSelect({ label, options, value, onChange, exclusive, className }: {
  label: string;
  options: { label: string; value: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  exclusive?: string;
  className?: string;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (v === exclusive) return onChange([v]);
    // Keep option order so the saved list reads naturally.
    onChange(options.map((o) => o.value).filter((x) => x !== exclusive && (x === v || value.includes(x))));
  };

  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              "h-9 min-w-9 rounded-md border px-3 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground/80 hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
