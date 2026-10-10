"use client";

import { useMemo, useState } from "react";
import {
  Accessibility,
  Ambulance,
  Anchor,
  Award,
  Baby,
  Banknote,
  BatteryCharging,
  Bell,
  Bike,
  Book,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Bus,
  CableCar,
  Calendar,
  Camera,
  Car,
  CarFront,
  CarTaxiFront,
  Castle,
  Cat,
  Check,
  Church,
  CircleParking,
  Clock,
  Coffee,
  Compass,
  CreditCard,
  Crown,
  Dog,
  Droplet,
  Dumbbell,
  Eye,
  Factory,
  Film,
  Flag,
  Flame,
  Flower2,
  Footprints,
  Forklift,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  Heart,
  Helicopter,
  Hospital,
  Hotel,
  House,
  Image,
  Info,
  Key,
  Landmark,
  Leaf,
  Library,
  Lightbulb,
  LocateFixed,
  Lock,
  Mail,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Medal,
  Milestone,
  Mountain,
  Music,
  Navigation,
  Palette,
  PartyPopper,
  Phone,
  PiggyBank,
  Pill,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plug,
  PlugZap,
  Radar,
  Recycle,
  Rocket,
  Route,
  Sailboat,
  School,
  Search,
  Shield,
  ShieldCheck,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Signpost,
  Siren,
  Sparkles,
  SquareParking,
  Star,
  Stethoscope,
  Store,
  Sun,
  Tent,
  ThumbsUp,
  Tractor,
  TrafficCone,
  TrainFront,
  TrainTrack,
  TramFront,
  Trees,
  Trophy,
  Truck,
  Tv,
  Users,
  Utensils,
  Video,
  Warehouse,
  Wallet,
  Waves,
  Wifi,
  Wrench,
  Zap,
  ChevronDown,
  Search as SearchIcon,
  X,
  type LucideIcon,
} from "lucide-react";
import { icons as LUCIDE_ICONS } from "lucide-react";
import * as LucideComponents from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ConnectivityIconOption {
  /** Stable stored id (kebab-case) — persisted on connectivity rows. */
  value: string;
  label: string;
  category: string;
  Icon: LucideIcon;
}

const opt = (
  value: string,
  label: string,
  category: string,
  Icon: LucideIcon,
): ConnectivityIconOption => ({ value, label, category, Icon });

/** Full icon library for connectivity highlights (and anywhere else an icon
 *  needs picking). Values are stable ids — never rename an existing one. */
export const CONNECTIVITY_ICONS: ConnectivityIconOption[] = [
  // Transport
  opt("bus", "Bus", "Transport", Bus),
  opt("train", "Train", "Transport", TrainFront),
  opt("tram", "Tram", "Transport", TramFront),
  opt("car", "Car", "Transport", Car),
  opt("car-front", "Car Front", "Transport", CarFront),
  opt("taxi", "Taxi", "Transport", CarTaxiFront),
  opt("bike", "Bike", "Transport", Bike),
  opt("plane", "Plane", "Transport", Plane),
  opt("plane-takeoff", "Plane Takeoff", "Transport", PlaneTakeoff),
  opt("plane-landing", "Plane Landing", "Transport", PlaneLanding),
  opt("ship", "Ship", "Transport", Ship),
  opt("sailboat", "Sailboat", "Transport", Sailboat),
  opt("anchor", "Anchor", "Transport", Anchor),
  opt("helicopter", "Helicopter", "Transport", Helicopter),
  opt("rocket", "Rocket", "Transport", Rocket),
  opt("fuel", "Fuel Station", "Transport", Fuel),
  opt("parking", "Parking", "Transport", SquareParking),
  opt("circle-parking", "Parking Alt", "Transport", CircleParking),
  opt("truck", "Truck", "Transport", Truck),
  opt("ambulance", "Ambulance", "Transport", Ambulance),
  opt("tractor", "Tractor", "Transport", Tractor),
  opt("forklift", "Forklift", "Transport", Forklift),
  opt("cable-car", "Cable Car", "Transport", CableCar),
  opt("train-track", "Train Track", "Transport", TrainTrack),
  opt("traffic-cone", "Traffic", "Transport", TrafficCone),
  opt("milestone", "Milestone", "Transport", Milestone),
  opt("signpost", "Signpost", "Transport", Signpost),
  // Navigation & Places
  opt("navigation", "Navigation", "Navigation & Places", Navigation),
  opt("map-pin", "Map Pin", "Navigation & Places", MapPin),
  opt("map-pinned", "Map Pinned", "Navigation & Places", MapPinned),
  opt("map", "Map", "Navigation & Places", MapIcon),
  opt("compass", "Compass", "Navigation & Places", Compass),
  opt("locate", "Locate", "Navigation & Places", LocateFixed),
  opt("radar", "Radar", "Navigation & Places", Radar),
  opt("globe", "Globe", "Navigation & Places", Globe),
  opt("route", "Route", "Navigation & Places", Route),
  opt("footprints", "Walking", "Navigation & Places", Footprints),
  opt("flag", "Flag", "Navigation & Places", Flag),
  opt("landmark", "Landmark", "Navigation & Places", Landmark),
  opt("castle", "Castle", "Navigation & Places", Castle),
  opt("church", "Church", "Navigation & Places", Church),
  opt("hotel", "Hotel", "Navigation & Places", Hotel),
  opt("warehouse", "Warehouse", "Navigation & Places", Warehouse),
  // Buildings
  opt("building", "Building", "Buildings", Building),
  opt("building-2", "Towers", "Buildings", Building2),
  opt("house", "House", "Buildings", House),
  opt("store", "Store", "Buildings", Store),
  opt("shopping-bag", "Shopping", "Buildings", ShoppingBag),
  opt("shopping-cart", "Cart", "Buildings", ShoppingCart),
  opt("school", "School", "Buildings", School),
  opt("graduation-cap", "College", "Buildings", GraduationCap),
  opt("hospital", "Hospital", "Buildings", Hospital),
  opt("factory", "Factory", "Buildings", Factory),
  opt("library", "Library", "Buildings", Library),
  // Amenities & Lifestyle
  opt("wifi", "WiFi", "Amenities & Lifestyle", Wifi),
  opt("coffee", "Cafe", "Amenities & Lifestyle", Coffee),
  opt("utensils", "Restaurant", "Amenities & Lifestyle", Utensils),
  opt("dumbbell", "Gym", "Amenities & Lifestyle", Dumbbell),
  opt("tv", "TV", "Amenities & Lifestyle", Tv),
  opt("music", "Music", "Amenities & Lifestyle", Music),
  opt("film", "Cinema", "Amenities & Lifestyle", Film),
  opt("gamepad-2", "Gaming", "Amenities & Lifestyle", Gamepad2),
  opt("book", "Book", "Amenities & Lifestyle", Book),
  opt("book-open", "Reading", "Amenities & Lifestyle", BookOpen),
  opt("baby", "Kids", "Amenities & Lifestyle", Baby),
  opt("dog", "Pet Friendly", "Amenities & Lifestyle", Dog),
  opt("cat", "Cat", "Amenities & Lifestyle", Cat),
  opt("sparkles", "Sparkles", "Amenities & Lifestyle", Sparkles),
  opt("star", "Star", "Amenities & Lifestyle", Star),
  opt("heart", "Heart", "Amenities & Lifestyle", Heart),
  opt("trees", "Park", "Amenities & Lifestyle", Trees),
  opt("leaf", "Green", "Amenities & Lifestyle", Leaf),
  opt("flower-2", "Garden", "Amenities & Lifestyle", Flower2),
  opt("sun", "Sun", "Amenities & Lifestyle", Sun),
  opt("waves", "Pool", "Amenities & Lifestyle", Waves),
  opt("mountain", "Hills", "Amenities & Lifestyle", Mountain),
  opt("tent", "Camping", "Amenities & Lifestyle", Tent),
  opt("trophy", "Sports", "Amenities & Lifestyle", Trophy),
  opt("palette", "Art", "Amenities & Lifestyle", Palette),
  // Services
  opt("phone", "Phone", "Services", Phone),
  opt("mail", "Mail", "Services", Mail),
  opt("bell", "Alerts", "Services", Bell),
  opt("shield", "Security", "Services", Shield),
  opt("shield-check", "Gated", "Services", ShieldCheck),
  opt("siren", "Emergency", "Services", Siren),
  opt("briefcase", "Business", "Services", Briefcase),
  opt("banknote", "Cash", "Services", Banknote),
  opt("credit-card", "Card", "Services", CreditCard),
  opt("wallet", "Wallet", "Services", Wallet),
  opt("piggy-bank", "Savings", "Services", PiggyBank),
  opt("plug", "Power", "Services", Plug),
  opt("plug-zap", "EV Charging", "Services", PlugZap),
  opt("wrench", "Maintenance", "Services", Wrench),
  opt("hammer", "Workshop", "Services", Hammer),
  opt("lightbulb", "Idea", "Services", Lightbulb),
  opt("droplet", "Water", "Services", Droplet),
  opt("flame", "Fire", "Services", Flame),
  opt("zap", "Energy", "Services", Zap),
  opt("battery-charging", "Backup Power", "Services", BatteryCharging),
  opt("recycle", "Recycle", "Services", Recycle),
  opt("pill", "Pharmacy", "Services", Pill),
  opt("stethoscope", "Clinic", "Services", Stethoscope),
  opt("clock", "24x7", "Services", Clock),
  opt("calendar", "Events", "Services", Calendar),
  opt("users", "Community", "Services", Users),
  opt("accessibility", "Accessible", "Services", Accessibility),
  // General
  opt("check", "Check", "General", Check),
  opt("info", "Info", "General", Info),
  opt("search", "Search", "General", Search),
  opt("eye", "View", "General", Eye),
  opt("camera", "Camera", "General", Camera),
  opt("image", "Gallery", "General", Image),
  opt("video", "Video", "General", Video),
  opt("award", "Award", "General", Award),
  opt("medal", "Medal", "General", Medal),
  opt("crown", "Premium", "General", Crown),
  opt("gem", "Luxury", "General", Gem),
  opt("key", "Handover", "General", Key),
  opt("lock", "Secure", "General", Lock),
  opt("gift", "Offers", "General", Gift),
  opt("party-popper", "Launch", "General", PartyPopper),
  opt("thumbs-up", "Recommended", "General", ThumbsUp),
];

export const connectivityIconMap: Record<string, LucideIcon> =
  Object.fromEntries(CONNECTIVITY_ICONS.map((o) => [o.value, o.Icon]));

// ---- Full lucide library ------------------------------------------------
// `icons` holds every canonical icon (PascalCase name → icon node, ~1700).
// The component for a canonical name is read from the package namespace on
// demand and cached, so pickers can offer the entire library while the
// curated lists stay the human-friendly default view.
export const ALL_ICON_NAMES: string[] = Object.keys(LUCIDE_ICONS);

const componentCache = new Map<string, LucideIcon | null>();

export function canonicalIconComponent(name: string): LucideIcon | null {
  if (componentCache.has(name)) return componentCache.get(name) ?? null;
  const c = (LucideComponents as Record<string, unknown>)[name];
  const valid =
    typeof c === "function" || (typeof c === "object" && c !== null);
  const comp = valid ? (c as LucideIcon) : null;
  componentCache.set(name, comp);
  return comp;
}

export const kebabToPascal = (kebab: string): string =>
  kebab
    .split("-")
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join("");

export const pascalToKebab = (pascal: string): string =>
  pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

export const humanizeIconName = (pascal: string): string =>
  pascal
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim();

/** Resolve any stored icon id to its component: canonical PascalCase first
 *  ("Sofa"), then legacy kebab aliases ("bus", "map-pin"), then a generic
 *  kebab→PascalCase attempt. Returns null when unknown. */
export function resolveIcon(value?: string | null): LucideIcon | null {
  if (!value) return null;
  const direct = canonicalIconComponent(value);
  if (direct) return direct;
  const alias = CONNECTIVITY_ICONS.find((o) => o.value === value);
  if (alias) return alias.Icon;
  return canonicalIconComponent(kebabToPascal(value));
}

export function iconLabelFor(value?: string | null): string {
  if (!value) return "";
  const alias = CONNECTIVITY_ICONS.find((o) => o.value === value);
  if (alias) return alias.label;
  return humanizeIconName(value);
}

/** Back-compat alias — resolves connectivity icon ids (kebab or canonical). */
export function getConnectivityIcon(value?: string | null): LucideIcon | null {
  return resolveIcon(value);
}

export interface PickerOption {
  /** Stored value written on pick. */
  key: string;
  label: string;
  Icon: LucideIcon;
  category?: string;
}

const toPickerOption = (o: ConnectivityIconOption): PickerOption => ({
  key: o.value,
  label: o.label,
  Icon: o.Icon,
  category: o.category,
});

const FEATURED_CATEGORIES = (list: PickerOption[]) =>
  Array.from(new Set(list.map((o) => o.category ?? "")));

const SEARCH_RENDER_CAP = 150;

interface IconPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Default (unfiltered) view. Defaults to the connectivity library. */
  featured?: PickerOption[];
  /** Show a tiny label under each icon cell. */
  showLabels?: boolean;
}

export function IconPicker({
  value,
  onChange,
  placeholder = "Select icon",
  featured,
  showLabels = false,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const featuredList = useMemo(
    () => featured ?? CONNECTIVITY_ICONS.map(toPickerOption),
    [featured],
  );

  const SelectedIcon = resolveIcon(value);
  const selectedLabel = iconLabelFor(value);

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return null;
    const out: PickerOption[] = [];
    const seen = new Set<string>();
    for (const name of ALL_ICON_NAMES) {
      const label = humanizeIconName(name);
      if (
        name.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        pascalToKebab(name).includes(q)
      ) {
        const Icon = canonicalIconComponent(name);
        if (Icon) {
          out.push({ key: name, label, Icon });
          seen.add(name);
        }
      }
    }
    // Legacy kebab ids that canonical search can't reach.
    for (const o of CONNECTIVITY_ICONS) {
      if (
        !seen.has(o.value) &&
        (o.label.toLowerCase().includes(q) || o.value.includes(q))
      ) {
        out.push(toPickerOption(o));
      }
    }
    return out;
  }, [q]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const renderOption = (o: PickerOption) => {
    const isActive = o.key === value;
    return (
      <button
        key={o.key}
        type="button"
        title={o.label}
        aria-label={o.label}
        aria-pressed={isActive}
        onClick={() => pick(o.key)}
        className={cn(
          showLabels
            ? "flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 transition-colors"
            : "h-10 w-10 inline-flex items-center justify-center rounded-lg border transition-all active:scale-90",
          isActive
            ? "bg-[#0052FF]/10 border-[#0052FF]/50 text-[#0052FF]"
            : "bg-card text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground",
        )}
      >
        <o.Icon className="h-5 w-5" />
        {showLabels && (
          <span className="w-full truncate text-center text-[10px] font-medium leading-tight">
            {o.label}
          </span>
        )}
      </button>
    );
  };

  const shown = searchResults?.slice(0, SEARCH_RENDER_CAP) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="w-full h-12 rounded-xl bg-muted/30 border border-border/60 focus:ring-2 focus:ring-[#0052FF]/20 focus:border-[#0052FF] transition-all text-[15px] px-3 flex items-center gap-2 min-w-0"
          >
            {SelectedIcon ? (
              <>
                <SelectedIcon className="h-4 w-4 shrink-0 text-foreground" />
                <span className="flex-1 truncate text-left font-medium text-foreground text-[14px]">
                  {selectedLabel}
                </span>
              </>
            ) : (
              <span className="flex-1 truncate text-left text-muted-foreground text-[14px]">
                {placeholder}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
        <div className="p-2 border-b border-border/60 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${ALL_ICON_NAMES.length}+ icons...`}
              className="pl-8 h-9 rounded-lg bg-muted/30 border-border/60 text-[13.5px]"
            />
          </div>
          {value ? (
            <button
              type="button"
              title="Clear icon"
              onClick={() => pick("")}
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="max-h-72 overflow-y-auto p-2.5 space-y-3">
          {shown ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {searchResults!.length} result{searchResults!.length === 1 ? "" : "s"}
                {searchResults!.length > SEARCH_RENDER_CAP
                  ? ` — showing first ${SEARCH_RENDER_CAP}, refine to narrow`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-1.5">{shown.map(renderOption)}</div>
            </div>
          ) : (
            FEATURED_CATEGORIES(featuredList).map((cat) => (
              <div key={cat || "all"}>
                {cat ? (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {cat}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {featuredList
                    .filter((o) => (o.category ?? "") === cat)
                    .map(renderOption)}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
