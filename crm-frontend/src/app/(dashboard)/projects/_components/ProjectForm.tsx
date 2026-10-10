"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/shared/form-select";
import { DatePicker } from "@/components/shared/date-picker";
import { PriceInput } from "@/components/shared/price-input";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ArrowLeft, ChevronDown, ImagePlus, Loader2, MapPin, Plus, Trash2, X } from "lucide-react";
import { projectsApi } from "@/lib/projects-api";
import { propertiesApi } from "@/lib/properties-api";
import { resolveCenterFromText, fetchPostalCode } from "@/lib/nearby-places";
import { parseIndianCurrency } from "@/lib/indian-currency";
import { computeProjectRanges, formatPriceRange } from "@/lib/project-ranges";

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";
const unitSectionTitle = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2";

const PROJECT_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
];

const POSSESSION_OPTIONS = [
  { value: "new_launch", label: "New Launch" },
  { value: "under_construction", label: "Under Construction" },
  { value: "ready_to_move", label: "Ready To Move" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "booked", label: "Booked" },
  { value: "archived", label: "Archived" },
];

const FACING_OPTIONS = [
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
];

const FURNISHED_OPTIONS = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi Furnished" },
  { value: "fully_furnished", label: "Fully Furnished" },
  { value: "bareshell", label: "Bareshell" },
];

const PARKING_TYPE_OPTIONS = [
  { value: "covered", label: "Covered" },
  { value: "open", label: "Open" },
];

const UNIT_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "booked", label: "Booked" },
  { value: "sold", label: "Sold" },
  { value: "rented", label: "Rented" },
  { value: "inactive", label: "Inactive" },
];

const UNIT_TABS = [
  { id: "basic", label: "Basic" },
  { id: "areas", label: "Areas & Rooms" },
  { id: "features", label: "Features & Parking" },
  { id: "price", label: "Price & Media" },
] as const;

type UnitTabId = (typeof UNIT_TABS)[number]["id"];

const UNIT_TYPE_OPTIONS = [
  { value: "studio", label: "Studio" },
  { value: "1bhk", label: "1 BHK" },
  { value: "2bhk", label: "2 BHK" },
  { value: "3bhk", label: "3 BHK" },
  { value: "4bhk", label: "4 BHK" },
  { value: "penthouse", label: "Penthouse" },
  { value: "villa_unit", label: "Villa Unit" },
  { value: "other", label: "Other" },
];

const PLOT_UNIT_TYPE_OPTIONS = [{ value: "plot_unit", label: "Plot" }];

// Project Area is collected in any unit but always stored as sqft.
const PROJECT_AREA_UNITS = [
  { value: "sqft", label: "Sq Ft", factor: 1 },
  { value: "cents", label: "Cents", factor: 435.6 },
  { value: "acres", label: "Acres", factor: 43560 },
  { value: "grounds", label: "Grounds", factor: 2400 },
];

interface RoomDimensionRow {
  name: string;
  dimensions: string;
}

interface UnitRow {
  unitCode: string;
  title: string;
  unitType: string;
  bedrooms: string;
  bathrooms: string;
  carpetAreaSqft: string;
  builtupAreaSqft: string;
  superBuiltupAreaSqft: string;
  udsAreaSqft: string;
  plotAreaSqft: string;
  plotAreaCents: string;
  parking: string;
  parkingType: string;
  unitGuestParking: boolean;
  balconies: string;
  floorNo: string;
  totalFloors: string;
  poojaRoom: boolean;
  studyRoom: boolean;
  openSides: string;
  boundaryWall: boolean;
  roomDimensions: RoomDimensionRow[];
  price: string;
  facing: string;
  furnishedStatus: string;
  floorPlanImageUrl: string;
  floorPlanImageKey: string;
  status: string;
}

const emptyRoomDimension = (): RoomDimensionRow => ({ name: "", dimensions: "" });

// Mirrors PropertyForm: "12" + "10" → "12 × 10 ft", null when incomplete.
const formatRoomDimension = (lengthFt: unknown, widthFt: unknown): string | null => {
  const l = typeof lengthFt === "string" ? parseFloat(lengthFt) : typeof lengthFt === "number" ? lengthFt : NaN;
  const w = typeof widthFt === "string" ? parseFloat(widthFt) : typeof widthFt === "number" ? widthFt : NaN;
  if (!Number.isFinite(l) || l <= 0 || !Number.isFinite(w) || w <= 0) return null;
  return `${String(parseFloat(l.toFixed(2)))} × ${String(parseFloat(w.toFixed(2)))} ft`;
};

// Keeps a stored string selectable even when it isn't in the masters.
const withLegacyOption = (options: { value: string; label: string }[], current: string) => {
  if (current && !options.some((o) => o.value === current)) {
    return [...options, { value: current, label: current }];
  }
  return options;
};

const emptyUnit = (): UnitRow => ({
  unitCode: "",
  title: "",
  unitType: "",
  bedrooms: "",
  bathrooms: "",
  carpetAreaSqft: "",
  builtupAreaSqft: "",
  superBuiltupAreaSqft: "",
  udsAreaSqft: "",
  plotAreaSqft: "",
  plotAreaCents: "",
  parking: "",
  parkingType: "",
  unitGuestParking: false,
  balconies: "",
  floorNo: "",
  totalFloors: "",
  poojaRoom: false,
  studyRoom: false,
  openSides: "",
  boundaryWall: false,
  roomDimensions: [],
  price: "",
  facing: "",
  furnishedStatus: "",
  floorPlanImageUrl: "",
  floorPlanImageKey: "",
  status: "available",
});

interface TowerDetailRow {
  tower: string;
  floors: string;
  units: string;
}

const emptyTowerDetail = (): TowerDetailRow => ({ tower: "", floors: "", units: "" });

interface SpecificationRow {
  label: string;
  value: string;
}

const emptySpecification = (): SpecificationRow => ({ label: "", value: "" });

interface GalleryItem {
  key: string;
  preview: string;
}

interface ProjectFormProps {
  mode: "create" | "edit";
  initialData?: any;
  onSuccess?: () => void;
}

export function ProjectForm({ mode, initialData, onSuccess }: ProjectFormProps) {
  const router = useRouter();
  const d = initialData as any;
  const isLandProject = (projectTypeValue: string) =>
    projectTypeValue === "villa" || projectTypeValue === "plot";
  const isPlotProject = (projectTypeValue: string) => projectTypeValue === "plot";
  const isVillaProject = (projectTypeValue: string) => projectTypeValue === "villa";

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<{
    cities: any[];
    sublocations: any[];
    amenities: any[];
    roomNames: { value: string; label: string }[];
    roomDimensions: { value: string; label: string; lengthFt: number | null; widthFt: number | null }[];
    specifications: { value: string; label: string }[];
  }>({ cities: [], sublocations: [], amenities: [], roomNames: [], roomDimensions: [], specifications: [] });

  useEffect(() => {
    propertiesApi
      .formData()
      .then((res: any) => {
        const data = res?.data ?? res ?? {};
        setFormData({
          cities: data.cities ?? [],
          sublocations: data.sublocations ?? [],
          amenities: data.amenities ?? [],
          roomNames: data.roomNames ?? [],
          roomDimensions: data.roomDimensions ?? [],
          specifications: data.specifications ?? [],
        });
      })
      .catch(() => {});
  }, []);

  const cityIdOf = (cityName: string) => {
    const found = formData.cities.find(
      (c: any) => (c.cityName ?? c.city_name ?? "") === cityName
    );
    return found ? String(found.id) : "";
  };

  // State dropdown options come from the managed cities master (unique
  // state names); the stored value is kept even if it isn't in the list.
  const [state, setState] = useState(d?.state ?? "");
  const stateOptions = useMemo(() => {
    const names = formData.cities
      .map((c: any) => (c.stateName ?? c.state_name ?? "").trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(names)).sort();
    if (state.trim() && !uniq.includes(state.trim())) uniq.push(state.trim());
    return uniq.map((n) => ({ label: n, value: n }));
  }, [formData.cities, state]);

  const [name, setName] = useState(d?.name ?? "");
  const [projectType, setProjectType] = useState(d?.projectType ?? "apartment");
  const [builderName, setBuilderName] = useState(d?.builderName ?? "");
  const [reraNumber, setReraNumber] = useState(d?.reraNumber ?? "");
  const [possessionDate, setPossessionDate] = useState(d?.possessionDate ? String(d.possessionDate).split("T")[0] : "");
  const [possessionStatus, setPossessionStatus] = useState(d?.possessionStatus ?? "under_construction");
  const [city, setCity] = useState(d?.city ?? "");
  const [sublocation, setSublocation] = useState(d?.sublocation ?? "");
  const [address, setAddress] = useState(d?.address ?? "");
  const [pincode, setPincode] = useState(d?.pincode ?? "");
  const [latitude, setLatitude] = useState(d?.latitude != null ? String(d.latitude) : "");
  const [longitude, setLongitude] = useState(d?.longitude != null ? String(d.longitude) : "");
  const [towers, setTowers] = useState(d?.towers ? String(d.towers) : "");
  const [totalFloors, setTotalFloors] = useState(d?.totalFloors ? String(d.totalFloors) : "");
  const [totalUnits, setTotalUnits] = useState(d?.totalUnits ? String(d.totalUnits) : "");
  const [projectAreaSqft, setProjectAreaSqft] = useState(d?.projectAreaSqft != null ? String(d.projectAreaSqft) : "");
  const [projectAreaUnit, setProjectAreaUnit] = useState("sqft");
  const [description, setDescription] = useState(d?.description ?? "");
  const [highlights, setHighlights] = useState(d?.highlights ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(d?.coverImageUrl ?? "");
  const [coverPreview, setCoverPreview] = useState(d?.coverImageUrl ?? "");
  const [brochureKey, setBrochureKey] = useState(d?.brochureKey ?? "");
  const [brochureName, setBrochureName] = useState(d?.brochureName ?? "");
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const brochureInputRef = useRef<HTMLInputElement>(null);
  const [floorPlanPreviews, setFloorPlanPreviews] = useState<Record<number, string>>({});
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFloorPlanIdx, setUploadingFloorPlanIdx] = useState<number | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [locating, setLocating] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(d?.status ?? "draft");

  const [towerDetails, setTowerDetails] = useState<TowerDetailRow[]>(() => {
    const existing = d?.towerDetails ?? [];
    if (!Array.isArray(existing) || existing.length === 0) return [];
    return existing.map((t: any) => ({
      tower: t.tower ?? "",
      floors: t.floors != null ? String(t.floors) : "",
      units: t.units != null ? String(t.units) : "",
    }));
  });

  const [specifications, setSpecifications] = useState<SpecificationRow[]>(() => {
    const existing = d?.specifications ?? [];
    if (!Array.isArray(existing) || existing.length === 0) return [];
    return existing.map((s: any) => ({ label: s.label ?? "", value: s.value ?? "" }));
  });

  const [amenityIds, setAmenityIds] = useState<number[]>(() => {
    const fromJoin = d?.projectAmenities ?? d?.__projectAmenities__ ?? [];
    if (Array.isArray(fromJoin) && fromJoin.length > 0) {
      return fromJoin.map((a: any) => Number(a.amenityId ?? a.amenity?.id)).filter((n: number) => Number.isFinite(n));
    }
    return Array.isArray(d?.amenityIds) ? d.amenityIds : [];
  });

  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    const existing = d?.galleryImageUrls ?? [];
    if (!Array.isArray(existing) || existing.length === 0) return [];
    return existing.map((g: any) => ({
      key: typeof g === "string" ? g : (g.imageKey ?? g.imageUrl ?? ""),
      preview: typeof g === "string" && g.startsWith("http") ? g : "",
    }));
  });

  const [units, setUnits] = useState<UnitRow[]>(() => {    const existing = d?.units ?? d?.__units__ ?? [];
    if (existing.length === 0) return [emptyUnit()];
    return existing.map((u: any) => ({
      unitCode: u.unitCode ?? "",
      title: u.title ?? "",
      unitType: u.unitType ?? "",
      bedrooms: u.bedrooms != null ? String(u.bedrooms) : "",
      bathrooms: u.bathrooms != null ? String(u.bathrooms) : "",
      carpetAreaSqft: u.carpetAreaSqft != null ? String(u.carpetAreaSqft) : "",
      builtupAreaSqft: u.builtupAreaSqft != null ? String(u.builtupAreaSqft) : "",
      superBuiltupAreaSqft: u.superBuiltupAreaSqft != null ? String(u.superBuiltupAreaSqft) : "",
      udsAreaSqft: u.udsAreaSqft != null ? String(u.udsAreaSqft) : "",
      plotAreaSqft: u.plotAreaSqft != null ? String(u.plotAreaSqft) : "",
      plotAreaCents: u.plotAreaCents != null ? String(u.plotAreaCents) : "",
      parking: u.parking != null ? String(u.parking) : "",
      parkingType: u.parkingType ?? "",
      unitGuestParking: u.unitGuestParking ?? false,
      balconies: u.balconies != null ? String(u.balconies) : "",
      floorNo: u.floorNo != null ? String(u.floorNo) : "",
      totalFloors: u.totalFloors != null ? String(u.totalFloors) : "",
      poojaRoom: u.poojaRoom ?? false,
      studyRoom: u.studyRoom ?? false,
      openSides: u.openSides != null ? String(u.openSides) : "",
      boundaryWall: u.boundaryWall ?? false,
      roomDimensions: Array.isArray(u.roomDimensions)
        ? u.roomDimensions.map((r: any) => ({ name: r.name ?? "", dimensions: r.dimensions ?? "" }))
        : [],
      price: u.price != null ? String(u.price) : "",
      facing: u.facing ?? "",
      furnishedStatus: u.furnishedStatus ?? "",
      floorPlanImageUrl: u.floorPlanImageUrl ?? "",
      floorPlanImageKey: u.floorPlanImageKey ?? "",
      status: u.status ?? "available",
    }));
  });

  const preview = useMemo(() => {
    const rows = units
      .filter((u) => u.unitCode.trim())
      .map((u) => ({
        price: u.price ? parseIndianCurrency(u.price) || null : null,
        builtupAreaSqft: u.builtupAreaSqft ? Number(u.builtupAreaSqft) : null,
        carpetAreaSqft: u.carpetAreaSqft ? Number(u.carpetAreaSqft) : null,
        superBuiltupAreaSqft: u.superBuiltupAreaSqft ? Number(u.superBuiltupAreaSqft) : null,
        bedrooms: u.bedrooms ? Number(u.bedrooms) : null,
        status: u.status,
      }));
    return computeProjectRanges(rows);
  }, [units]);

  const updateUnit = (idx: number, patch: Partial<UnitRow>) => {
    setUnits((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  };

  const updateUnitRoom = (idx: number, rIdx: number, patch: Partial<RoomDimensionRow>) => {
    setUnits((prev) =>
      prev.map((u, i) =>
        i === idx
          ? { ...u, roomDimensions: u.roomDimensions.map((r, j) => (j === rIdx ? { ...r, ...patch } : r)) }
          : u
      )
    );
  };

  const removeUnit = (idx: number) => {
    setUnits((prev) => (prev.length === 1 ? [emptyUnit()] : prev.filter((_, i) => i !== idx)));
    const shiftKeys = <T,>(map: Record<number, T>): Record<number, T> => {
      const next: Record<number, T> = {};
      Object.entries(map).forEach(([k, v]) => {
        const n = Number(k);
        if (n === idx) return;
        next[n > idx ? n - 1 : n] = v;
      });
      return next;
    };
    setOpenUnits((prev) => shiftKeys(prev));
    setUnitTabs((prev) => shiftKeys(prev));
  };

  // Collapsible unit cards — only the first is open initially so a long
  // unit list reads as tidy summaries instead of a wall of fields.
  const [openUnits, setOpenUnits] = useState<Record<number, boolean>>({ 0: true });
  const isUnitOpen = (idx: number) => openUnits[idx] ?? false;
  const toggleUnit = (idx: number) => setOpenUnits((prev) => ({ ...prev, [idx]: !(prev[idx] ?? false) }));

  // Active inner tab per unit card. Only one group shows at a time so the
  // open card stays compact. Plots have no Features tab — fall back to Basic.
  const [unitTabs, setUnitTabs] = useState<Record<number, UnitTabId>>({});
  const unitTab = (idx: number): UnitTabId => {
    const stored = unitTabs[idx] ?? "basic";
    if (stored === "features" && projectType === "plot") return "basic";
    return stored;
  };
  const setUnitTab = (idx: number, tab: UnitTabId) =>
    setUnitTabs((prev) => ({ ...prev, [idx]: tab }));

  const unitStatusLabel = (status: string) =>
    UNIT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;

  const unitSummary = (u: UnitRow): string =>
    [
      u.unitCode.trim() || "Untitled unit",
      u.bedrooms.trim() ? `${u.bedrooms.trim()} BHK` : null,
      u.price.trim() || null,
      unitStatusLabel(u.status),
    ]
      .filter(Boolean)
      .join(" · ");

  // A unit with entered data but no code would be silently dropped on
  // submit — catch it first and open it for the user to fix.
  const unitHasContent = (u: UnitRow): boolean =>
    [
      u.title, u.unitType, u.bedrooms, u.bathrooms, u.carpetAreaSqft, u.builtupAreaSqft,
      u.superBuiltupAreaSqft, u.udsAreaSqft, u.plotAreaSqft, u.plotAreaCents, u.parking, u.balconies,
      u.floorNo, u.totalFloors, u.openSides, u.price, u.facing, u.furnishedStatus,
      u.floorPlanImageUrl, u.floorPlanImageKey,
    ].some((v) => v.trim() !== "") ||
    u.poojaRoom || u.studyRoom || u.boundaryWall || u.unitGuestParking ||
    u.roomDimensions.length > 0;

  const handleCoverFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (!file) return;
    setUploadingCover(true);
    try {
      const result = await propertiesApi.uploadImages([file]);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      setCoverImageUrl(uploaded[0].imageKey);
      setCoverPreview(URL.createObjectURL(file));
    } catch {
      toast.error("Failed to upload cover image. Please try again.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleBrochureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (brochureInputRef.current) brochureInputRef.current.value = "";
    if (!file) return;
    // Must match the server's upload-docs cap — instant feedback instead of
    // a post-upload 413.
    const MAX_BROCHURE_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_BROCHURE_BYTES) {
      toast.error("Brochure must be under 15 MB. Please compress the PDF and try again.");
      return;
    }
    setUploadingBrochure(true);
    try {
      const result = await propertiesApi.uploadDocs([file]);
      const item = result?.data?.[0];
      if (!result?.success || !item?.fileKey) throw new Error("Upload failed");
      setBrochureKey(item.fileKey);
      setBrochureName(item.fileName ?? file.name);
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setUploadingBrochure(false);
    }
  };

  const handleGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (files.length === 0) return;
    setUploadingGallery(true);
    try {
      const result = await propertiesApi.uploadImages(files);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      setGallery((prev) => [
        ...prev,
        ...uploaded.map((u: any, i: number) => ({
          key: u.imageKey,
          preview: URL.createObjectURL(files[i]),
        })),
      ]);
    } catch {
      toast.error("Failed to upload gallery images. Please try again.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleFloorPlanFiles = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingFloorPlanIdx(idx);
    try {
      const result = await propertiesApi.uploadImages([file]);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      updateUnit(idx, { floorPlanImageUrl: uploaded[0].imageKey, floorPlanImageKey: uploaded[0].imageKey });
      setFloorPlanPreviews((prev) => ({ ...prev, [idx]: URL.createObjectURL(file) }));
    } catch {
      toast.error("Failed to upload floor plan. Please try again.");
    } finally {
      setUploadingFloorPlanIdx(null);
    }
  };

  const handleLocateCoordinates = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      toast.error("Google Maps API key is missing. Please configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      return;
    }
    // Prefer the full address for accuracy; fall back to locality + city + state.
    const addressQuery = [address.trim(), sublocation.trim(), city.trim(), state.trim()].filter(Boolean).join(", ");
    const localityQuery = [sublocation.trim(), city.trim(), state.trim()].filter(Boolean).join(", ");
    const query = address.trim() ? addressQuery : localityQuery;
    if (!query) {
      toast.error("Enter an address, locality or city first.");
      return;
    }
    setLocating(true);
    try {
      const resolved = await resolveCenterFromText(query, apiKey);
      setLatitude(String(resolved.latitude));
      setLongitude(String(resolved.longitude));
      try {
        const pin = await fetchPostalCode(resolved.latitude, resolved.longitude, apiKey);
        if (pin) setPincode(pin);
      } catch {
        /* keep existing pincode */
      }
      toast.success(`Location auto-populated from ${resolved.label}.`);
    } catch {
      toast.error(`Could not locate "${query}" on Google Maps.`);
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required.");
      return;
    }
    if (!city.trim()) {
      toast.error("City is required.");
      return;
    }
    if (!sublocation.trim()) {
      toast.error("Locality is required.");
      return;
    }
    const validUnits = units.filter((u) => u.unitCode.trim());
    const incompleteIdx = units.findIndex((u) => !u.unitCode.trim() && unitHasContent(u));
    if (incompleteIdx >= 0) {
      setOpenUnits((prev) => ({ ...prev, [incompleteIdx]: true }));
      toast.error(`Unit ${incompleteIdx + 1} has details but no unit code.`);
      return;
    }
    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        projectType,
        builderName: builderName.trim() || undefined,
        reraNumber: reraNumber.trim() || undefined,
        possessionDate: possessionDate || undefined,
        possessionStatus,
        city: city.trim(),
        state: state.trim() || undefined,
        sublocation: sublocation.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        latitude: latitude !== "" && !isNaN(Number(latitude)) ? Number(latitude) : undefined,
        longitude: longitude !== "" && !isNaN(Number(longitude)) ? Number(longitude) : undefined,
        towers: projectType === "apartment" && towers ? Number(towers) : undefined,
        totalFloors: projectType === "apartment" && totalFloors ? Number(totalFloors) : undefined,
        totalUnits: totalUnits ? Number(totalUnits) : undefined,
        projectAreaSqft: (() => {
          if (!projectAreaSqft || isNaN(Number(projectAreaSqft))) return undefined;
          const factor = PROJECT_AREA_UNITS.find((u) => u.value === projectAreaUnit)?.factor ?? 1;
          return Math.round(Number(projectAreaSqft) * factor * 100) / 100;
        })(),
        towerDetails: projectType !== "apartment"
          ? undefined
          : towerDetails
              .filter((t) => t.tower.trim() || t.floors || t.units)
              .map((t) => ({
                tower: t.tower.trim() || undefined,
                floors: t.floors ? Number(t.floors) : undefined,
                units: t.units ? Number(t.units) : undefined,
              })),
        description: description.trim() || undefined,
        highlights: projectType === "plot" ? undefined : highlights.trim() || undefined,
        specifications: projectType === "plot"
          ? undefined
          : specifications
              .filter((s) => s.label.trim() && s.value.trim())
              .map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
        coverImageUrl: coverImageUrl.trim() || undefined,
        brochureKey: brochureKey.trim() || undefined,
        brochureName: brochureKey.trim() ? brochureName.trim() || undefined : undefined,
        galleryImageUrls: gallery.length > 0 ? gallery.map((g) => g.key) : undefined,
        status,
        amenities: projectType === "plot" ? [] : amenityIds.map((id) => ({ amenityId: id })),
        units: validUnits.map((u) => {
          // Plot units are land parcels: strip every building-only key so
          // legacy apartment data can't ride along after a type switch.
          const isPlotUnit = projectType === "plot";
          const isVillaUnit = projectType === "villa";
          return {
            unitCode: u.unitCode.trim(),
            title: u.title.trim() || undefined,
            unitType: u.unitType || undefined,
            bedrooms: !isPlotUnit && u.bedrooms ? Number(u.bedrooms) : undefined,
            bathrooms: !isPlotUnit && u.bathrooms ? Number(u.bathrooms) : undefined,
            carpetAreaSqft: !isPlotUnit && u.carpetAreaSqft ? Number(u.carpetAreaSqft) : undefined,
            builtupAreaSqft: !isPlotUnit && u.builtupAreaSqft ? Number(u.builtupAreaSqft) : undefined,
            superBuiltupAreaSqft: !isPlotUnit && u.superBuiltupAreaSqft ? Number(u.superBuiltupAreaSqft) : undefined,
            udsAreaSqft: isVillaUnit && u.udsAreaSqft ? Number(u.udsAreaSqft) : undefined,
            plotAreaSqft: isVillaUnit && u.plotAreaSqft ? Number(u.plotAreaSqft) : undefined,
            plotAreaCents: isPlotUnit && u.plotAreaCents ? Number(u.plotAreaCents) : undefined,
            parking: !isPlotUnit && u.parking ? Number(u.parking) : undefined,
            parkingType: !isPlotUnit && u.parkingType ? u.parkingType : undefined,
            unitGuestParking: !isPlotUnit ? u.unitGuestParking : undefined,
            balconies: !isPlotUnit && u.balconies ? Number(u.balconies) : undefined,
            floorNo: !isPlotUnit && u.floorNo ? Number(u.floorNo) : undefined,
            totalFloors: !isPlotUnit && u.totalFloors ? Number(u.totalFloors) : undefined,
            poojaRoom: !isPlotUnit ? u.poojaRoom : undefined,
            studyRoom: !isPlotUnit ? u.studyRoom : undefined,
            openSides: u.openSides ? Number(u.openSides) : undefined,
            boundaryWall: u.boundaryWall,
            roomDimensions: !isPlotUnit
              ? u.roomDimensions.filter((r) => r.name.trim() && r.dimensions.trim())
              : [],
            price: u.price ? parseIndianCurrency(u.price) || undefined : undefined,
            facing: u.facing || undefined,
            furnishedStatus: !isPlotUnit && u.furnishedStatus ? u.furnishedStatus : undefined,
            floorPlanImageUrl: !isPlotUnit && u.floorPlanImageUrl.trim() ? u.floorPlanImageUrl.trim() : undefined,
            floorPlanImageKey: !isPlotUnit && u.floorPlanImageKey.trim() ? u.floorPlanImageKey.trim() : undefined,
            status: u.status || undefined,
          };
        }),
      };
      if (!payload.towerDetails || payload.towerDetails.length === 0) delete payload.towerDetails;
      if (!payload.specifications || payload.specifications.length === 0) delete payload.specifications;
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      let result: any;
      if (mode === "create") {
        result = await projectsApi.create(payload);
      } else {
        result = await projectsApi.update(d.id, payload);
      }
      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode} project.`);
        return;
      }
      toast.success(`Project ${mode === "create" ? "created" : "updated"} successfully!`);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/projects");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <MobileHeader title={mode === "create" ? "New Project" : "Edit Project"} showBack />
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto w-full flex flex-col gap-6 pb-10 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[28px] font-bold tracking-tight">
            {mode === "create" ? "Add New Project" : "Edit Project"}
          </h1>
        </div>
        {preview.unitsCount > 0 && (
          <p className="text-muted-foreground text-sm">
            {`${formatPriceRange(preview.minPrice, preview.maxPrice)} · ${preview.bhk.length ? preview.bhk.map((b) => `${b}BHK`).join(", ") : "No BHK"} · ${preview.unitsCount} unit${preview.unitsCount > 1 ? "s" : ""}`}
          </p>
        )}

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Project Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emerald Heights" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Project Type *</label>
              <FormSelect name="projectType" options={PROJECT_TYPE_OPTIONS} value={projectType} onValueChange={(v) => setProjectType(v)} placeholder="Select type" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Status</label>
              <FormSelect name="status" options={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v)} placeholder="Select status" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>City *</label>
              <FormSelect
                name="city"
                options={formData.cities.map((c: any) => {
                  const n = c.cityName ?? c.city_name ?? "";
                  return { label: n, value: n };
                })}
                value={city}
                onValueChange={(v) => {
                  setCity(v || "");
                  setSublocation("");
                  const match = formData.cities.find(
                    (c: any) => (c.cityName ?? c.city_name ?? "") === v
                  );
                  const st = match?.stateName ?? match?.state_name ?? "";
                  if (st) setState(String(st).trim());
                }}
                placeholder="Select city"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>State</label>
              <FormSelect
                name="state"
                options={stateOptions}
                value={state}
                onValueChange={(v) => setState(v || "")}
                placeholder={stateOptions.length ? "Select state" : "No states in master list"}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Sublocation / Locality *</label>
              <FormSelect
                name="sublocation"
                options={formData.sublocations
                  .filter((s: any) => {
                    const cid = cityIdOf(city);
                    return !cid || String(s.cityId ?? s.city_id ?? "") === cid;
                  })
                  .map((s: any) => {
                    const n = s.localityName ?? s.locality_name ?? "";
                    return { label: n, value: n };
                  })}
                value={sublocation}
                onValueChange={(v) => {
                  setSublocation(v || "");
                  if (!pincode.trim() && v) {
                    const sub = formData.sublocations.find(
                      (s: any) => (s.localityName ?? s.locality_name ?? "") === v
                    );
                    const pin = sub?.postalCode ?? sub?.postal_code ?? "";
                    if (pin) setPincode(String(pin).trim());
                  }
                }}
                placeholder={city ? "Select locality" : "Select city first"}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Pincode</label>
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g. 641004" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Latitude</label>
              <Input type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="e.g. 11.0168" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Longitude</label>
              <Input type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="e.g. 76.9558" className={inputClass} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={locating}
                onClick={handleLocateCoordinates}
                className="h-11 rounded-xl px-5"
              >
                {locating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                {locating ? "Locating..." : "Auto Populate"}
              </Button>
              <p className="text-xs text-muted-foreground">Uses the address above (falls back to locality, city and state). Fills pincode, latitude and longitude.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>Address</label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Site address" className="rounded-xl bg-muted/30 min-h-[90px]" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Possession</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Possession Status</label>
              <FormSelect name="possessionStatus" options={POSSESSION_OPTIONS} value={possessionStatus} onValueChange={(v) => setPossessionStatus(v)} placeholder="Select status" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Possession Date</label>
              <DatePicker
                value={possessionDate ? new Date(`${possessionDate}T00:00:00`) : undefined}
                onChange={(d) => setPossessionDate(d ? format(d, "yyyy-MM-dd") : "")}
                placeholder="Pick possession date"
                className="h-12 rounded-xl bg-muted/30"
              />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Builder</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Builder Name</label>
              <Input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="Builder name" className={inputClass} />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>RERA Number</label>
              <Input value={reraNumber} onChange={(e) => setReraNumber(e.target.value)} placeholder="RERA registration no." className={inputClass} />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">About</h3>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About this project..." className="rounded-xl bg-muted/30 min-h-[120px]" />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Cover Image</label>
              <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverFiles} />
              {coverPreview && (coverPreview.startsWith("http") || coverPreview.startsWith("blob:")) ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border/60 bg-muted/20">
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverPreview("");
                    }}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 text-white hover:bg-red-600 transition-colors"
                    aria-label="Remove cover image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : coverImageUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
                  <span className="flex-1 truncate text-xs text-muted-foreground">{coverImageUrl}</span>
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="!px-3 !py-1.5 !text-[12px] !font-medium !text-[#0052FF] hover:!bg-[#0052FF]/10 !rounded-lg"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl("");
                      setCoverPreview("");
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove cover image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-[#0052FF]/50 hover:text-[#0052FF] transition-colors disabled:opacity-60"
                >
                  {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {uploadingCover ? "Uploading..." : "Upload cover image"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Brochure (PDF)</label>
              <input ref={brochureInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleBrochureFile} />
              {brochureKey ? (
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
                  <span className="flex-1 truncate text-xs text-muted-foreground">{brochureName || brochureKey}</span>
                  <button
                    type="button"
                    onClick={() => brochureInputRef.current?.click()}
                    className="!px-3 !py-1.5 !text-[12px] !font-medium !text-[#0052FF] hover:!bg-[#0052FF]/10 !rounded-lg"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBrochureKey("");
                      setBrochureName("");
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    aria-label="Remove brochure"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingBrochure}
                  onClick={() => brochureInputRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-[#0052FF]/50 hover:text-[#0052FF] transition-colors disabled:opacity-60"
                >
                  {uploadingBrochure ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {uploadingBrochure ? "Uploading..." : "Upload brochure PDF (max 15 MB)"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Structure &amp; Layout</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Project Area</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={projectAreaSqft}
                  onChange={(e) => setProjectAreaSqft(e.target.value)}
                  placeholder="e.g. 50000"
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <FormSelect
                  name="projectAreaUnit"
                  className="w-32 shrink-0"
                  placeholder="Unit"
                  options={PROJECT_AREA_UNITS.map((u) => ({ label: u.label, value: u.value }))}
                  value={projectAreaUnit}
                  onValueChange={(v) => setProjectAreaUnit(v || "sqft")}
                />
              </div>
            </div>
            {projectType === "apartment" && (
              <div className="space-y-2">
                <label className={labelClass}>Towers</label>
                <Input type="number" min={0} value={towers} onChange={(e) => setTowers(e.target.value)} placeholder="No. of towers" className={inputClass} />
              </div>
            )}
            {projectType === "apartment" && (
              <div className="space-y-2">
                <label className={labelClass}>Total Floors</label>
                <Input type="number" min={0} value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} placeholder="e.g. 12" className={inputClass} />
              </div>
            )}
            <div className="space-y-2">
              <label className={labelClass}>Total Units{projectType === "plot" ? " (No. of Plots)" : " (No. of Flats)"}</label>
              <Input type="number" min={0} value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} placeholder="e.g. 120" className={inputClass} />
            </div>
          </div>
          {projectType === "apartment" && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Tower Details</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTowerDetails((prev) => [...prev, emptyTowerDetail()])}
                className="h-9 rounded-full px-4"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Tower
              </Button>
            </div>
            {towerDetails.map((t, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <label className={labelClass}>Tower</label>
                    <Input value={t.tower} onChange={(e) => setTowerDetails((prev) => prev.map((row, j) => (j === i ? { ...row, tower: e.target.value } : row)))} placeholder="e.g. A" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Floors</label>
                    <Input type="number" min={0} value={t.floors} onChange={(e) => setTowerDetails((prev) => prev.map((row, j) => (j === i ? { ...row, floors: e.target.value } : row)))} placeholder="e.g. 12" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Units</label>
                    <Input type="number" min={0} value={t.units} onChange={(e) => setTowerDetails((prev) => prev.map((row, j) => (j === i ? { ...row, units: e.target.value } : row)))} placeholder="e.g. 48" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <span className={labelClass + " invisible select-none"} aria-hidden="true">Remove</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setTowerDetails((prev) => prev.filter((_, j) => j !== i))}
                      className="h-12 w-12 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove tower"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
            ))}
          </div>
          )}
        </div>

        {projectType !== "plot" && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Amenities</h3>
          {formData.amenities.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No amenities available in the master list.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.amenities.map((amenity: any) => (
                <label
                  key={amenity.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    amenityIds.includes(amenity.id)
                      ? "bg-[#0052FF]/5 border-[#0052FF]/30"
                      : "bg-muted/10 border-border/40 hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={amenityIds.includes(amenity.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setAmenityIds((prev) => [...prev, amenity.id]);
                      else setAmenityIds((prev) => prev.filter((id) => id !== amenity.id));
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate capitalize" title={amenity.name}>
                      {amenity.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                      {amenity.category || "General"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
          </div>
        )}

        {projectType !== "plot" && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Highlights &amp; Specifications</h3>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className={labelClass}>Highlights</label>
              <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="Key selling points of this project..." className="rounded-xl bg-muted/30 min-h-[90px]" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">Specifications</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSpecifications((prev) => [...prev, emptySpecification()])}
                  className="h-9 rounded-full px-4"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Row
                </Button>
              </div>
              {specifications.map((s, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 items-end">
                  <div className="space-y-2">
                    <label className={labelClass}>Label</label>
                    <FormSelect
                      name={`specLabel-${i}`}
                      options={withLegacyOption(
                        formData.specifications.map((sp) => ({ value: sp.value, label: sp.label })),
                        s.label
                      )}
                      value={s.label || null}
                      onValueChange={(v) =>
                        setSpecifications((prev) => prev.map((row, j) => (j === i ? { ...row, label: v || "" } : row)))
                      }
                      placeholder="Select specification"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Value</label>
                    <Input value={s.value} onChange={(e) => setSpecifications((prev) => prev.map((row, j) => (j === i ? { ...row, value: e.target.value } : row)))} placeholder="e.g. Vitrified tiles" className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <span className={labelClass + " invisible select-none"} aria-hidden="true">Remove</span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSpecifications((prev) => prev.filter((_, j) => j !== i))}
                      className="h-12 w-12 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove specification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3 mb-6">
            <h3 className="text-lg font-bold text-foreground">Gallery ({gallery.length})</h3>
            <Button
              type="button"
              variant="outline"
              disabled={uploadingGallery}
              onClick={() => galleryInputRef.current?.click()}
              className="h-9 rounded-full px-4"
            >
              {uploadingGallery ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
              {uploadingGallery ? "Uploading..." : "Add Images"}
            </Button>
          </div>
          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleGalleryFiles} />
          {gallery.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No gallery images yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {gallery.map((g, i) => (
                <div key={`${g.key}-${i}`} className="relative h-28 rounded-xl overflow-hidden border border-border/60 bg-muted/20">
                  {g.preview || g.key.startsWith("http") ? (
                    <img src={g.preview || g.key} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center p-2 text-[11px] text-muted-foreground truncate">{g.key}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setGallery((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600 transition-colors"
                    aria-label={`Remove gallery image ${i + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3 mb-6">
            <h3 className="text-lg font-bold text-foreground">Units ({units.filter((u) => u.unitCode.trim()).length})</h3>
            <div className="flex items-center gap-3">
              {preview.unitsCount > 0 && (
                <span className="text-sm font-semibold text-[#0052FF]">
                  {formatPriceRange(preview.minPrice, preview.maxPrice)}
                </span>
              )}
              {units.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenUnits(Object.fromEntries(units.map((_, i) => [i, true])))}
                    className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Expand all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpenUnits({})}
                    className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Collapse all
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-5">
            {units.map((unit, idx) => (
              <div key={idx} className="border border-border/60 rounded-2xl bg-muted/10 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-5 cursor-pointer select-none"
                  onClick={() => toggleUnit(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleUnit(idx);
                    }
                  }}
                  aria-expanded={isUnitOpen(idx)}
                >
                  <span className="text-sm font-bold text-foreground shrink-0">Unit {idx + 1}</span>
                  <span className="flex-1 truncate text-[13px] text-muted-foreground">{unitSummary(unit)}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isUnitOpen(idx) ? "rotate-180" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUnit(idx);
                    }}
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    aria-label={`Remove unit ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {isUnitOpen(idx) && (
                <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
                <div className="flex gap-1 rounded-xl bg-muted/40 p-1 overflow-x-auto" role="tablist" aria-label={`Unit ${idx + 1} sections`}>
                  {UNIT_TABS.filter((t) => t.id !== "features" || !isPlotProject(projectType)).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={unitTab(idx) === t.id}
                      onClick={() => setUnitTab(idx, t.id)}
                      className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer ${
                        unitTab(idx) === t.id
                          ? "bg-white text-[#0052FF] shadow-sm dark:bg-card dark:text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {unitTab(idx) === "basic" && (
                <>
                <p className={unitSectionTitle}>Identity</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Unit Code *</label>
                    <Input value={unit.unitCode} onChange={(e) => updateUnit(idx, { unitCode: e.target.value })} placeholder={isPlotProject(projectType) ? "e.g. Plot No. 12" : "e.g. 3BHK-A"} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Title</label>
                    <Input value={unit.title} onChange={(e) => updateUnit(idx, { title: e.target.value })} placeholder={isPlotProject(projectType) ? "e.g. East-facing plot" : "e.g. East-facing 3BHK"} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Unit Type</label>
                    <FormSelect name={`unitType-${idx}`} options={isPlotProject(projectType) ? PLOT_UNIT_TYPE_OPTIONS : UNIT_TYPE_OPTIONS} value={unit.unitType} onValueChange={(v) => updateUnit(idx, { unitType: v || "" })} placeholder="Any" />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Unit Status</label>
                    <FormSelect name={`unitStatus-${idx}`} options={UNIT_STATUS_OPTIONS} value={unit.status} onValueChange={(v) => updateUnit(idx, { status: v })} placeholder="Status" />
                  </div>
                </div>
                <p className={unitSectionTitle}>Configuration</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {!isPlotProject(projectType) && (
                    <>
                      <div className="space-y-2">
                        <label className={labelClass}>Bedrooms</label>
                        <Input type="number" min={0} value={unit.bedrooms} onChange={(e) => updateUnit(idx, { bedrooms: e.target.value })} placeholder="3" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Bathrooms</label>
                        <Input type="number" min={0} value={unit.bathrooms} onChange={(e) => updateUnit(idx, { bathrooms: e.target.value })} placeholder="2" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Balconies</label>
                        <Input type="number" min={0} value={unit.balconies} onChange={(e) => updateUnit(idx, { balconies: e.target.value })} placeholder="2" className={inputClass} />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <label className={labelClass}>Facing</label>
                    <FormSelect name={`facing-${idx}`} options={FACING_OPTIONS} value={unit.facing} onValueChange={(v) => updateUnit(idx, { facing: v || "" })} placeholder="Any" />
                  </div>
                  {!isPlotProject(projectType) && (
                    <>
                      <div className="space-y-2">
                        <label className={labelClass}>Furnishing</label>
                        <FormSelect name={`furnished-${idx}`} options={FURNISHED_OPTIONS} value={unit.furnishedStatus} onValueChange={(v) => updateUnit(idx, { furnishedStatus: v || "" })} placeholder="Any" />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Floor No</label>
                        <Input type="number" min={0} value={unit.floorNo} onChange={(e) => updateUnit(idx, { floorNo: e.target.value })} placeholder="e.g. 4" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Total Floors</label>
                        <Input type="number" min={0} value={unit.totalFloors} onChange={(e) => updateUnit(idx, { totalFloors: e.target.value })} placeholder="e.g. 12" className={inputClass} />
                      </div>
                    </>
                  )}
                </div>
                </>
                )}
                {unitTab(idx) === "areas" && (
                <>
                {!isPlotProject(projectType) && (
                  <>
                    <p className={unitSectionTitle}>Areas (sqft)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Carpet (sqft)</label>
                        <Input type="number" min={0} value={unit.carpetAreaSqft} onChange={(e) => updateUnit(idx, { carpetAreaSqft: e.target.value })} placeholder="1000" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Built-up (sqft)</label>
                        <Input type="number" min={0} value={unit.builtupAreaSqft} onChange={(e) => updateUnit(idx, { builtupAreaSqft: e.target.value })} placeholder="1200" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Super Built-up</label>
                        <Input type="number" min={0} value={unit.superBuiltupAreaSqft} onChange={(e) => updateUnit(idx, { superBuiltupAreaSqft: e.target.value })} placeholder="1450" className={inputClass} />
                      </div>
                    </div>
                  </>
                )}
                {isLandProject(projectType) && (
                  <>
                    <p className={unitSectionTitle}>{isPlotProject(projectType) ? "Plot Details" : "Villa Details"}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {isVillaProject(projectType) && (
                        <div className="space-y-2">
                          <label className={labelClass}>UDS Area (sqft)</label>
                          <Input type="number" min={0} value={unit.udsAreaSqft} onChange={(e) => updateUnit(idx, { udsAreaSqft: e.target.value })} placeholder="e.g. 200" className={inputClass} />
                        </div>
                      )}
                      {isVillaProject(projectType) && (
                        <div className="space-y-2">
                          <label className={labelClass}>Plot Area (sqft)</label>
                          <Input type="number" min={0} value={unit.plotAreaSqft} onChange={(e) => updateUnit(idx, { plotAreaSqft: e.target.value })} placeholder="e.g. 2400" className={inputClass} />
                        </div>
                      )}
                      {isPlotProject(projectType) && (
                        <div className="space-y-2">
                          <label className={labelClass}>Plot Area (cents)</label>
                          <Input type="number" min={0} value={unit.plotAreaCents} onChange={(e) => updateUnit(idx, { plotAreaCents: e.target.value })} placeholder="e.g. 10" className={inputClass} />
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className={labelClass}>Open Sides</label>
                        <Input type="number" min={0} max={4} value={unit.openSides} onChange={(e) => updateUnit(idx, { openSides: e.target.value })} placeholder="e.g. 2" className={inputClass} />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer self-end pb-3">
                        <Checkbox checked={unit.boundaryWall} onCheckedChange={(checked) => updateUnit(idx, { boundaryWall: checked === true })} />
                        Boundary Wall
                      </label>
                    </div>
                  </>
                )}
                </>
                )}
                {unitTab(idx) === "features" && (
                <>
                {!isPlotProject(projectType) && (
                  <>
                    <p className={unitSectionTitle}>Features</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(
                        [
                          { key: "poojaRoom", label: "Pooja Room" },
                          { key: "studyRoom", label: "Study / Store Room" },
                        ] as { key: "poojaRoom" | "studyRoom"; label: string }[]
                      ).map(({ key, label }) => {
                    const checked = unit[key] === true;
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? "bg-[#0052FF]/5 border-[#0052FF]/30"
                            : "bg-muted/10 border-border/40 hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => updateUnit(idx, { [key]: c === true } as Partial<UnitRow>)}
                        />
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                      </label>
                    );
                  })}
                </div>
                </>
                )}
                {!isPlotProject(projectType) && (
                  <>
                    <p className={unitSectionTitle}>Parking</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className={labelClass}>Parking</label>
                        <Input type="number" min={0} value={unit.parking} onChange={(e) => updateUnit(idx, { parking: e.target.value })} placeholder="2" className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Parking Type</label>
                        <FormSelect name={`parkingType-${idx}`} options={PARKING_TYPE_OPTIONS} value={unit.parkingType} onValueChange={(v) => updateUnit(idx, { parkingType: v || "" })} placeholder="Any" />
                      </div>
                      <div className="space-y-2">
                        <span className={labelClass}>Guest Parking</span>
                        <label
                          className={`flex h-12 items-center gap-3 px-4 rounded-xl border cursor-pointer transition-colors ${
                            unit.unitGuestParking
                              ? "bg-[#0052FF]/5 border-[#0052FF]/30"
                              : "bg-muted/10 border-border/40 hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox checked={unit.unitGuestParking} onCheckedChange={(checked) => updateUnit(idx, { unitGuestParking: checked === true })} />
                          <span className="text-sm font-semibold text-foreground">Available</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
                </>
                )}
                {unitTab(idx) === "price" && (
                <>
                <p className={unitSectionTitle}>Pricing</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>Price (₹)</label>
                    <PriceInput value={unit.price} onChange={(v) => updateUnit(idx, { price: v })} placeholder="e.g. 80L or 1.2Cr" />
                  </div>
                </div>
                <p className={unitSectionTitle}>{isPlotProject(projectType) ? "Plot Layout" : "Floor Plan"}</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelClass}>{isPlotProject(projectType) ? "Plot Layout Image" : "Floor Plan Image"}</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      data-floorplan-idx={idx}
                      onChange={(e) => handleFloorPlanFiles(e, idx)}
                    />
                    {unit.floorPlanImageUrl ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2">
                        {(floorPlanPreviews[idx] || unit.floorPlanImageUrl.startsWith("http")) && (
                          <img src={floorPlanPreviews[idx] || unit.floorPlanImageUrl} alt="Floor plan" className="h-16 w-16 rounded-lg object-cover bg-white" />
                        )}
                        <span className="flex-1 truncate text-xs text-muted-foreground">{unit.floorPlanImageUrl}</span>
                        <button
                          type="button"
                          onClick={() => {
                            updateUnit(idx, { floorPlanImageUrl: "", floorPlanImageKey: "" });
                            setFloorPlanPreviews((prev) => {
                              const next = { ...prev };
                              delete next[idx];
                              return next;
                            });
                          }}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          aria-label="Remove floor plan"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingFloorPlanIdx === idx}
                        onClick={(e) => {
                          const input = (e.currentTarget.parentElement?.querySelector("input[type=file]") as HTMLInputElement) ?? null;
                          input?.click();
                        }}
                        className="w-full h-14 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-[#0052FF]/50 hover:text-[#0052FF] transition-colors disabled:opacity-60"
                      >
                        {uploadingFloorPlanIdx === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {uploadingFloorPlanIdx === idx ? "Uploading..." : isPlotProject(projectType) ? "Upload plot layout" : "Upload floor plan"}
                      </button>
                    )}
                  </div>
                </div>
                </>
                )}
                {unitTab(idx) === "areas" && !isPlotProject(projectType) && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Room Dimensions</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateUnit(idx, { roomDimensions: [...unit.roomDimensions, emptyRoomDimension()] })}
                      className="h-8 rounded-full px-3 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Room
                    </Button>
                  </div>
                  {unit.roomDimensions.map((r, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                      <div className="space-y-2">
                        <label className={labelClass}>Room</label>
                        <FormSelect
                          name={`roomName-${idx}-${rIdx}`}
                          options={withLegacyOption(
                            formData.roomNames.map((rn) => ({ value: rn.value, label: rn.label })),
                            r.name
                          )}
                          value={r.name || null}
                          onValueChange={(v) => updateUnitRoom(idx, rIdx, { name: v || "" })}
                          placeholder="Select room"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Dimensions</label>
                        <FormSelect
                          name={`roomDims-${idx}-${rIdx}`}
                          options={withLegacyOption(
                            formData.roomDimensions.map((rd) => {
                              const dims = formatRoomDimension(rd.lengthFt, rd.widthFt) ?? rd.value;
                              return {
                                value: dims,
                                label: rd.label !== dims ? `${rd.label} (${dims})` : dims,
                              };
                            }),
                            r.dimensions
                          )}
                          value={r.dimensions || null}
                          onValueChange={(v) => updateUnitRoom(idx, rIdx, { dimensions: v || "" })}
                          placeholder="Select dimensions"
                        />
                      </div>
                      <div className="space-y-2">
                        <span className={labelClass + " invisible select-none"} aria-hidden="true">Remove</span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => updateUnit(idx, { roomDimensions: unit.roomDimensions.filter((_, j) => j !== rIdx) })}
                          className="h-12 w-12 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          aria-label="Remove room"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
                </div>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnits((prev) => [...prev, emptyUnit()]);
                setOpenUnits((prev) => ({ ...prev, [units.length]: true }));
              }}
              className="w-full border-dashed border-2 h-12"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Unit
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => router.push("/projects")}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="h-11 rounded-full bg-[#0052FF] px-6 text-white hover:bg-[#0052FF]/90">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Create Project" : "Save Changes"}
          </Button>
        </div>
      </form>
    </>
  );
}
