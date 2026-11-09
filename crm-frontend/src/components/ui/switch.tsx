"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Kumo's switch: a squircle track (not a pill) with a full-height thumb.
// Same props as before, so every toggle in the CRM picks up the look.
const SQUIRCLE = "rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle]"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center border-none p-0 ring outline-none transition-colors duration-150 ease-out motion-reduce:transition-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:ring-2 focus-visible:ring-kumo-brand aria-invalid:ring-destructive",
        "data-[size=default]:h-4.5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-8",
        "data-unchecked:bg-neutral-200 data-unchecked:ring-neutral-300 dark:data-unchecked:bg-neutral-700 dark:data-unchecked:ring-neutral-600",
        "data-checked:bg-blue-500 data-checked:ring-blue-600 dark:data-checked:bg-blue-600 dark:data-checked:ring-blue-500",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        SQUIRCLE,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 block bg-kumo-base shadow-[0_0_1px_0.5px_var(--color-kumo-shadow-edge),0_1px_2px_var(--color-kumo-shadow-drop)] transition-all duration-150 ease-out motion-reduce:transition-none",
          "group-data-[size=default]/switch:w-4.5 group-data-[size=sm]/switch:w-4",
          "group-data-[size=default]/switch:data-checked:left-4.5 group-data-[size=sm]/switch:data-checked:left-4",
          "dark:data-unchecked:bg-neutral-850 dark:data-checked:bg-blue-300",
          SQUIRCLE
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
