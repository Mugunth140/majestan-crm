import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./prismark-loader.css";

// Filled cells of the Prismark mark on its 4×4 grid, in the order they assemble.
const MARK_CELLS: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [0, 1],
  [1, 1],
  [3, 1],
  [2, 2],
  [3, 2],
  [2, 3],
  [3, 3],
];

// The mark built cell by cell. `loop` keeps assembling and dissolving it (for loaders);
// otherwise it assembles once and stays. Fills with currentColor.
export function PrismarkAssembly({
  loop = false,
  className,
}: {
  loop?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 4 4"
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("pm-assembly", loop && "pm-assembly--loop", className)}
    >
      {MARK_CELLS.map(([x, y], i) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={1.01}
          height={1.01}
          fill="currentColor"
          className="pm-cell"
          style={{ "--dx": x < 2 ? "-60%" : "60%", "--i": i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

// Global page loader: the looping mark, centred in whatever space it is given.
export function PrismarkLoader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "flex w-full flex-1 items-center justify-center",
        className,
      )}
    >
      <PrismarkAssembly
        loop
        className="size-12 text-[#017D58] dark:text-[#2FB585]"
      />
    </div>
  );
}
