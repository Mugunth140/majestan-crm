"use client";
import { cn } from "@/lib/utils";
import { PROPERTY_FIELD } from "./property-form-styles";
import { Input } from "@/components/ui/input";

export function roomSides(
  value: string | null | undefined,
): [string, string] | null {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet)?$/i);
  return match ? [match[1], match[2]] : null;
}
export function PropertyRoomDimensions({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
}) {
  const partial = String(value ?? "")
    .trim()
    .match(/^(\d*(?:\.\d*)?)\s*[x×*]\s*(\d*(?:\.\d*)?)\s*(?:ft|feet)?$/i);
  const length = partial?.[1] ?? "";
  const width = partial?.[2] ?? "";
  // Partial manual values stay in the draft so submission can validate them.
  const change = (nextLength: string, nextWidth: string) =>
    onChange(nextLength || nextWidth ? `${nextLength} × ${nextWidth} ft` : "");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className={cn(PROPERTY_FIELD, "min-w-0")}
          aria-label="Room length in feet"
          type="number"
          min={0}
          step="any"
          placeholder="Length (ft)"
          value={length}
          onChange={(e) => change(e.target.value, width)}
        />
        <span aria-hidden>×</span>
        <Input
          className={cn(PROPERTY_FIELD, "min-w-0")}
          aria-label="Room width in feet"
          type="number"
          min={0}
          step="any"
          placeholder="Width (ft)"
          value={width}
          onChange={(e) => change(length, e.target.value)}
        />
      </div>
      {value && !partial && (
        <p className="text-sm text-muted-foreground">
          Saved dimensions: {value}. Enter both measurements to replace them.
        </p>
      )}
    </div>
  );
}

export function restoreRoomDimensions(
  value: unknown,
): { name: string; dimensions: string }[] {
  return Array.isArray(value)
    ? value
        .filter((row) => row && typeof row === "object")
        .map((row) => ({
          name: String(row.name ?? ""),
          dimensions: String(row.dimensions ?? ""),
        }))
    : [];
}
