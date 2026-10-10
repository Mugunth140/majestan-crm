"use client";

import { createElement } from "react";
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
import {
  IconPicker,
  resolveIcon,
  type PickerOption,
} from "@/components/shared/icon-picker";

export type FurnishingIconEntry = {
  /** Stored value (lucide PascalCase name). */
  name: string;
  label: string;
  Icon: LucideIcon;
};

/** Featured furnishing set — the picker's default view. Search reaches the
 *  full library, so this stays a staff-friendly shortlist. */
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

/** Resolve a stored icon name to its component, falling back to Sparkles.
 *  Accepts canonical PascalCase names and anything else the shared resolver
 *  understands. */
export function getFurnishingIcon(name?: string | null): LucideIcon {
  return resolveIcon(name) ?? Sparkles;
}

/** Render a stored furnishing icon by name. */
export function FurnishingIcon({ name, className }: { name?: string | null; className?: string }) {
  return createElement(getFurnishingIcon(name), { className });
}

const FURNISHING_FEATURED: PickerOption[] = FURNISHING_ICONS.map((i) => ({
  key: i.name,
  label: i.label,
  Icon: i.Icon,
}));

type FurnishingIconPickerProps = {
  value?: string | null;
  onChange: (name: string) => void;
};

/** Popup picker for a furnishing item's icon — featured shortlist up front,
 *  full library on search. */
export function FurnishingIconPicker({ value, onChange }: FurnishingIconPickerProps) {
  return (
    <IconPicker
      value={value}
      onChange={onChange}
      placeholder="Select icon"
      featured={FURNISHING_FEATURED}
      showLabels
    />
  );
}
