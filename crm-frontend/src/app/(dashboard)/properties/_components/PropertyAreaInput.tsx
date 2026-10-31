"use client";
import { Input } from "@/components/ui/input";
import { PropertyFormSelect } from "./PropertyFormSelect";
import { AREA_UNIT_OPTIONS, convertArea } from "./property-measurements";

export function PropertyAreaInput({
  name,
  value,
  unit,
  onChange,
  onUnitChange,
}: {
  name: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
}) {
  return (
    <div id={`pf-${name}`} className="flex gap-2">
      <Input
        name={name}
        aria-label={name.replace(/([a-z])([A-Z])/g, "$1 $2")}
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 min-w-0 flex-1 rounded-xl bg-muted/30"
      />
      <PropertyFormSelect
        name={`${name}Unit`}
        placeholder="Unit"
        className="w-32 shrink-0"
        options={AREA_UNIT_OPTIONS}
        value={unit}
        onValueChange={(next) => {
          onChange(convertArea(value, unit, next));
          onUnitChange(next);
        }}
      />
    </div>
  );
}
