"use client";

import { cn } from "@/lib/utils";

/** A short list of choices shown all at once; picking the chosen one again clears it. */
export function ChoiceChips({ options, value, onChange, label }: {
  options: { label: string; value: string }[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** Names the group for screen readers. */
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? "" : o.value)}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 text-[13px] font-medium transition-colors",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-muted dark:bg-white/[0.04]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
