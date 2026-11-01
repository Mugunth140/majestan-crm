"use client";
import { plotBoundaryGeometry } from "./plot-boundary-geometry";
import { Input } from "@/components/ui/input";
import { PropertyFormSelect } from "./PropertyFormSelect";
export interface PlotBoundary {
  direction: string;
  length: string;
  unit: string;
}
export const BOUNDARY_DIRECTIONS = [
  "North",
  "North East",
  "East",
  "South East",
  "South",
  "South West",
  "West",
  "North West",
];
export const emptyPlotBoundaries = (): PlotBoundary[] =>
  ["North", "East", "South", "West"].map((direction) => ({
    direction,
    length: "",
    unit: "ft",
  }));
export function restorePlotBoundaries(
  value: unknown,
  length?: unknown,
  width?: unknown,
): PlotBoundary[] {
  if (Array.isArray(value) && value.length === 4)
    return value.map((side, index) => ({
      direction: BOUNDARY_DIRECTIONS.includes(side?.direction)
        ? side.direction
        : emptyPlotBoundaries()[index].direction,
      length: side?.length == null ? "" : String(side.length),
      unit: side?.unit === "m" ? "m" : "ft",
    }));
  return emptyPlotBoundaries().map((side, index) => ({
    ...side,
    length:
      (index % 2 === 0 ? length : width) == null ||
      Number(index % 2 === 0 ? length : width) <= 0
        ? ""
        : String(index % 2 === 0 ? length : width),
  }));
}
export function convertBoundaryLength(
  value: string,
  from: string,
  to: string,
): string {
  if (!value.trim() || !Number.isFinite(Number(value)) || from === to)
    return value;
  return String(
    Number((Number(value) * (from === "ft" ? 0.3048 : 1 / 0.3048)).toFixed(8)),
  );
}
export function PropertyPlotBoundaries({
  value,
  onChange,
  readOnly = false,
  facing,
}: {
  value: PlotBoundary[];
  onChange?: (value: PlotBoundary[]) => void;
  readOnly?: boolean;
  facing?: string;
}) {
  const sides = value.length === 4 ? value : emptyPlotBoundaries();
  const normalize = (direction: string) =>
    direction.toLowerCase().replace(/[^a-z]/g, "");
  const facingSides = new Set<number>();
  for (const direction of (facing ?? "").split(/\s+to\s+/i)) {
    const target = normalize(direction);
    if (!target) continue;
    const exact = sides.flatMap((side, index) =>
      normalize(side.direction) === target ? [index] : [],
    );
    // A diagonal facing highlights its two cardinal sides when no boundary
    // has that exact diagonal label. Never infer facing from row position.
    const matches = exact.length
      ? exact
      : sides.flatMap((side, index) => {
          const cardinal = normalize(side.direction);
          return ["north", "south", "east", "west"].includes(cardinal) &&
            target.includes(cardinal)
            ? [index]
            : [];
        });
    for (const index of matches) facingSides.add(index);
  }
  const { corners, complete, invalid } = plotBoundaryGeometry(sides);
  const change = (index: number, key: keyof PlotBoundary, next: string) =>
    onChange?.(
      sides.map((side, i) =>
        i === index
          ? {
              ...side,
              ...(key === "unit"
                ? {
                    length: convertBoundaryLength(side.length, side.unit, next),
                  }
                : {}),
              [key]: next,
            }
          : side,
      ),
    );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {!readOnly && (
          <div className="space-y-3">
            {sides.map((side, index) => (
              <div key={index} className="space-y-2">
                <label className="text-sm font-medium">
                  Boundary {index + 1}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <PropertyFormSelect
                    name={`boundaryDirection${index}`}
                    placeholder="Direction"
                    value={side.direction}
                    options={BOUNDARY_DIRECTIONS.map((direction) => ({
                      value: direction,
                      label: direction,
                    }))}
                    onValueChange={(next) => change(index, "direction", next)}
                  />
                  <Input
                    aria-label={`Boundary ${index + 1} length`}
                    type="number"
                    min={0}
                    step="any"
                    value={side.length}
                    placeholder="Length"
                    onChange={(event) =>
                      change(index, "length", event.target.value)
                    }
                    className="h-12 rounded-xl"
                  />
                  <PropertyFormSelect
                    name={`boundaryUnit${index}`}
                    placeholder="Unit"
                    value={side.unit}
                    options={[
                      { value: "ft", label: "Feet" },
                      { value: "m", label: "Metres" },
                    ]}
                    onValueChange={(next) => change(index, "unit", next)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <figure className="rounded-xl border bg-muted/20 p-4">
          {facing ? (
            <div
              aria-label="Boundary legend"
              className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs"
            >
              <span className="inline-flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
                <span aria-hidden className="h-1 w-6 rounded-full bg-current" />
                Plot facing: {facing}
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span
                  aria-hidden
                  className="w-6 border-t-2 border-dashed border-current"
                />
                Other boundaries
              </span>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">
              {readOnly
                ? "Plot facing not recorded."
                : "Select plot facing to highlight the facing sides."}
            </p>
          )}
          {!invalid && (
            <svg
              viewBox="0 0 400 300"
              className="w-full"
              role="img"
              aria-label="Plot boundary preview"
            >
              <polygon
                points={corners.map((point) => point.join(",")).join(" ")}
                fill="currentColor"
                fillOpacity="0.08"
                stroke="none"
              />
              {sides.map((side, index) => {
                const start = corners[index];
                const end = corners[(index + 1) % corners.length];
                const highlighted = facingSides.has(index);
                return (
                  <line
                    key={`edge-${index}`}
                    x1={start[0]}
                    y1={start[1]}
                    x2={end[0]}
                    y2={end[1]}
                    data-boundary-direction={side.direction}
                    data-facing={highlighted}
                    className={
                      highlighted
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                    }
                    stroke="currentColor"
                    strokeWidth={highlighted ? 6 : 2}
                    strokeDasharray={highlighted ? undefined : "5 5"}
                    strokeLinecap="round"
                  />
                );
              })}
              {sides.map((side, index) => {
                const start = corners[index],
                  end = corners[(index + 1) % 4];
                const dx = end[0] - start[0],
                  dy = end[1] - start[1];
                const distance = Math.hypot(dx, dy) || 1;
                const point = {
                  x: Math.max(
                    48,
                    Math.min(
                      352,
                      (start[0] + end[0]) / 2 + (dy / distance) * 32,
                    ),
                  ),
                  y: Math.max(
                    28,
                    Math.min(
                      260,
                      (start[1] + end[1]) / 2 - (dx / distance) * 32 - 6,
                    ),
                  ),
                };
                return (
                  <text
                    key={index}
                    x={point.x}
                    y={point.y}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                    className={
                      facingSides.has(index)
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : undefined
                    }
                  >
                    <tspan x={point.x}>{side.direction}</tspan>
                    <tspan x={point.x} dy="18">
                      {side.length
                        ? `${side.length} ${side.unit}`
                        : "Enter length"}
                    </tspan>
                  </text>
                );
              })}
            </svg>
          )}
          {facing && !facingSides.size && (
            <p className="mb-2 text-center text-xs text-muted-foreground">
              No boundary direction matches this facing.
            </p>
          )}
          <figcaption className="text-center text-xs text-muted-foreground">
            {invalid
              ? complete
                ? "These lengths cannot form a closed plot. Each side must be shorter than the other three combined."
                : "Enter the remaining lengths to preview this plot."
              : complete
                ? "Approximate shape from side lengths. Actual angles may differ."
                : "Approximate preview. Enter all four lengths to update the shape."}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
