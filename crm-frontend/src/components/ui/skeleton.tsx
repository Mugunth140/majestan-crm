import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/40",
        "after:absolute after:inset-0",
        "after:-translate-x-full",
        "after:animate-[shimmer_1.5s_infinite_linear]",
        "after:bg-linear-to-r after:from-transparent after:via-muted-foreground/15 after:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
