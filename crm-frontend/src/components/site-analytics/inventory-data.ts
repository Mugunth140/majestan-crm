export type InventorySection =
  | "overview"
  | "properties"
  | "projects"
  | "pricing"
  | "demand"
  | "quality";
export type InventoryFilters = Record<string, string>;
export type InventoryMatch = Partial<InventoryFilters>;
export type InventoryDatum = {
  label: string;
  value?: number | null;
  numerator?: number | null;
  denominator?: number;
  series?: string;
  x?: number;
  y?: number;
  low?: number;
  q1?: number;
  median?: number;
  q3?: number;
  high?: number;
  match?: InventoryMatch;
};
export type InventoryChart = {
  key: string;
  title: string;
  type:
    | "bar"
    | "stack"
    | "line"
    | "area"
    | "histogram"
    | "box"
    | "scatter"
    | "range"
    | "heatmap";
  rows: InventoryDatum[];
  unit?: string;
  note?: string;
};
export type InventoryMetric = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  match?: InventoryMatch;
};
export type InventoryRecord = {
  key: string;
  kind: "property" | "project";
  id: number;
  title: string;
  code: string | null;
  type: string;
  mode: string | null;
  city: string | null;
  localities: string[];
  status: string;
  approval: string | null;
  verification: string | null;
  visible: boolean;
  price: string | null;
  rent: string | null;
  seatRent: string | null;
  area: string | null;
  areaBasis: string | null;
  areaUnit: string | null;
  furnishing: string | null;
  floor: string | null;
  seats: number | null;
  documents: number;
  legalFlags: Record<string, string | null>;
  indexing: string | null;
  bedrooms: number | null;
  declaredUnits: number | null;
  possession: string | null;
  possessionDate: string | null;
  uploaderId: number | null;
  legacy: boolean;
  created: string | null;
  updated: string | null;
  issues: string[];
  href: string;
  configurations: {
    id: number;
    code: string;
    type: string;
    mode: string;
    status: string;
    price: string | null;
    rent: string | null;
    bedrooms: number | null;
  }[];
  traffic: {
    views: number | null;
    visitors: number | null;
    sessions: number | null;
    engagement: number | null;
    scroll: number;
    phone: number;
    whatsapp: number;
    email: number;
    enquiries: number | null;
    visits: number | null;
    wishlistAdds: number;
    wishlistRemoves: number;
  } | null;
};
export type InventoryReport = {
  version: number;
  filters: InventoryFilters;
  timezone: string;
  snapshotAt: string;
  sources: Record<string, string>;
  coverage: {
    trafficFrom: string | null;
    unmatchedViews: number;
    historyMessage: string | null;
    historyFrom: string | null;
    acceptedSubmissions: number | null;
    linkedSubmissions: number | null;
  };
  metrics: InventoryMetric[];
  charts: InventoryChart[];
  issues: {
    key: string;
    label: string;
    value: number;
    match: InventoryMatch;
  }[];
  selectionRequired: string | null;
  records: { total: number; items: InventoryRecord[] };
  uploaderNames?: Record<string, string>;
  freshnessMessage?: string | null;
  intake?: {
    available: boolean;
    rows?: { key: string; status: string; count: number }[];
  };
};
export type InventoryOptions = {
  city: string[];
  locality: string[];
  type: string[];
  status: string[];
  approval: string[];
  builder: string[];
  project: { label: string; value: string }[];
  uploader: string[];
  areaBasis: string[];
  uploaderNames?: Record<string, string>;
};
export type ListingDetail = {
  record: InventoryRecord;
  daily: { day: string; views: number }[];
  enquiries: { day: string; enquiries: number; visits: number }[];
  history: {
    coverageFrom: string | null;
    events: {
      id: string;
      subject: string;
      action: string;
      at: string;
      before_json: unknown;
      after_json: unknown;
    }[];
    snapshots: { day: string; capturedAt: string; record: InventoryRecord }[];
  };
};
export const SECTIONS: { value: InventorySection; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "properties", label: "Properties" },
  { value: "projects", label: "Projects" },
  { value: "pricing", label: "Pricing" },
  { value: "demand", label: "Demand" },
  { value: "quality", label: "Quality" },
];
export const inventoryQuery = (filters: InventoryFilters) =>
  new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== ""),
  ).toString();
export const inventoryMoney = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      });
export const inventoryCount = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
