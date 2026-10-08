"use client";

import { createElement, useState } from "react";
import {
  Archive,
  Armchair,
  Bath,
  BedDouble,
  BedSingle,
  BookOpen,
  Coffee,
  CookingPot,
  DoorOpen,
  Fan,
  AirVent,
  Heater,
  Lamp,
  LampDesk,
  LampFloor,
  Microwave,
  Package,
  Printer,
  Projector,
  Refrigerator,
  Shirt,
  ShowerHead,
  Snowflake,
  Sofa,
  Speaker,
  Thermometer,
  TreePine,
  Tv,
  UtensilsCrossed,
  Vault,
  WashingMachine,
  Wind,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FurnishingIconEntry = {
  /** Stored value (lucide PascalCase name). */
  name: string;
  label: string;
  Icon: LucideIcon;
};

/** Curated, staff-friendly icon set for furnishing items. */
export const FURNISHING_ICONS: FurnishingIconEntry[] = [
  { name: "Sofa", label: "Sofa", Icon: Sofa },
  { name: "Armchair", label: "Armchair", Icon: Armchair },
  { name: "BedDouble", label: "Double Bed", Icon: BedDouble },
  { name: "BedSingle", label: "Single Bed", Icon: BedSingle },
  { name: "Tv", label: "Television", Icon: Tv },
  { name: "Refrigerator", label: "Refrigerator", Icon: Refrigerator },
  { name: "WashingMachine", label: "Washing Machine", Icon: WashingMachine },
  { name: "Microwave", label: "Microwave", Icon: Microwave },
  { name: "CookingPot", label: "Cooktop / Hob", Icon: CookingPot },
  { name: "Coffee", label: "Coffee Maker", Icon: Coffee },
  { name: "Lamp", label: "Table Lamp", Icon: Lamp },
  { name: "LampDesk", label: "Desk Lamp", Icon: LampDesk },
  { name: "LampFloor", label: "Floor Lamp", Icon: LampFloor },
  { name: "Fan", label: "Ceiling Fan", Icon: Fan },
  { name: "AirVent", label: "Air Vent", Icon: AirVent },
  { name: "Heater", label: "Room Heater", Icon: Heater },
  { name: "Snowflake", label: "Air Conditioner", Icon: Snowflake },
  { name: "ShowerHead", label: "Shower", Icon: ShowerHead },
  { name: "Bath", label: "Bathtub", Icon: Bath },
  { name: "DoorOpen", label: "Main Door", Icon: DoorOpen },
  { name: "Archive", label: "Wardrobe / Storage", Icon: Archive },
  { name: "Package", label: "Storage Box", Icon: Package },
  { name: "Vault", label: "Safe / Locker", Icon: Vault },
  { name: "Shirt", label: "Laundry", Icon: Shirt },
  { name: "BookOpen", label: "Bookshelf", Icon: BookOpen },
  { name: "UtensilsCrossed", label: "Dining Set", Icon: UtensilsCrossed },
  { name: "Wind", label: "Ventilation", Icon: Wind },
  { name: "Thermometer", label: "Water Heater", Icon: Thermometer },
  { name: "Projector", label: "Home Theatre", Icon: Projector },
  { name: "Speaker", label: "Speakers", Icon: Speaker },
  { name: "Printer", label: "Printer", Icon: Printer },
  { name: "TreePine", label: "Indoor Plant", Icon: TreePine },
];

/** Resolve a stored icon name to its component, falling back to Sparkles. */
export function getFurnishingIcon(name?: string | null): LucideIcon {
  if (!name) return Sparkles;
  return FURNISHING_ICONS.find((i) => i.name === name)?.Icon ?? Sparkles;
}

/** Render a stored furnishing icon by name. */
export function FurnishingIcon({ name, className }: { name?: string | null; className?: string }) {
  return createElement(getFurnishingIcon(name), { className });
}

type FurnishingIconPickerProps = {
  value?: string | null;
  onChange: (name: string) => void;
};

/** Searchable icon grid for picking a furnishing item's icon. */
export function FurnishingIconPicker({ value, onChange }: FurnishingIconPickerProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = q
    ? FURNISHING_ICONS.filter((i) => `${i.name} ${i.label}`.toLowerCase().includes(q))
    : FURNISHING_ICONS;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search icons..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10"
      />
      <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2 sm:grid-cols-6">
        {list.map(({ name, label, Icon }) => {
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={selected}
              onClick={() => onChange(name)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 transition-colors",
                selected
                  ? "border-[#0052FF]/50 bg-[#0052FF]/10 text-[#0052FF]"
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="w-full truncate text-center text-[10px] font-medium leading-tight">
                {label}
              </span>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
            No icons match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
