"use client";
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
}: {
  value: PlotBoundary[];
  onChange?: (value: PlotBoundary[]) => void;
  readOnly?: boolean;
}) {
  const sides = value.length === 4 ? value : emptyPlotBoundaries();
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
          <svg
            viewBox="0 0 400 300"
            className="w-full"
            role="img"
            aria-label="Plot boundary preview"
          >
            <polygon
              points="115,75 285,90 275,225 90,210"
              fill="currentColor"
              fillOpacity="0.08"
              stroke="currentColor"
              strokeWidth="2"
            />
            {sides.map((side, index) => {
              const point = [
                { x: 200, y: 45 },
                { x: 335, y: 145 },
                { x: 195, y: 260 },
                { x: 48, y: 145 },
              ][index];
              return (
                <text
                  key={index}
                  x={point.x}
                  y={point.y}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
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
          <figcaption className="text-center text-xs text-muted-foreground">
            Live boundary labels · layout not to scale
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
