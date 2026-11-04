import { formatIndianCurrencyShort, parseIndianCurrency } from "./indian-currency";

/** The choices the asset form offers; the values are stored as shown. */
const list = (...values: string[]) => values.map((v) => ({ label: v, value: v }));

export const ASSET_SOURCES = list("Mediator", "MD", "Referral", "CP Reference");
export const ASSET_ZONES = list("Coimbatore East", "Coimbatore West", "Coimbatore South", "Coimbatore North", "Coimbatore Center");
export const YES_NO_NA = list("Yes", "No", "N/A");
export const YES_NO = list("Yes", "No");
export const CLASSIFICATION_TYPES = list("Non-Classified Area", "Classified Area", "N/A");
export const SALEABLE_AREAS = list("Full", "Partial", "Full/Partial");
export const WATER_SOURCES = list("High", "Medium", "Low", "N/A");
export const WATER_DEPTHS = list("0-100Ft", "100-300Ft", "Above 300Ft");
/** How far the site is from a railway, water body, burial ground or canal. */
export const DISTANCE_BANDS = list("0-100Meter", "100-300Meter", "Above 300Meter", "N/A");
export const BUSINESS_MODES = list("Outright", "JV", "Different Payment");
export const REGISTRATION_TIMES = list("Immediately", "1-3 Month", "3-6 Month", "Upto 1 Year");
export const SOIL_TYPES = [
  { label: "Red Soil", value: "redsoil" },
  { label: "Black Soil", value: "blacksoil" },
  { label: "Clay Soil", value: "claysoil" },
  { label: "Loamy Soil", value: "loamysoil" },
  { label: "Red Rock Soil", value: "redrocksoil" },
  { label: "Red Rock Mixed", value: "redrockmixed" },
  { label: "Rock Soil", value: "rocksoil" },
];

export const assetCode = (id: number) => `AST${String(id).padStart(5, "0")}`;

/** "District, Taluk, Village" for lists and headers. */
export const assetPlace = (location?: { district?: string | null; taluk?: string | null; village?: string | null } | null) =>
  [location?.district, location?.taluk, location?.village].filter(Boolean).join(", ");

/** Decimals come back as "12.00": show 12. Older rows hold text like "2 Acres", kept as is. */
export const plainNumber = (v: unknown) =>
  v === null || v === undefined || v === "" ? "" : isNaN(Number(v)) ? String(v) : String(Number(v));

/** Land, DTCP and expected prices are stored in lakhs. */
export const lakhs = (v: unknown) => (v === null || v === undefined || v === "" ? null : `${plainNumber(v)} Lakhs`);

/** The LO price is stored in rupees and typed as "80L" or "1.2Cr". */
export const loPriceText = (v: unknown) => formatIndianCurrencyShort(Number(v) || 0).replace("₹", "");
export const toLoPrice = (text: string) => (text.trim() ? parseIndianCurrency(text) : null);

/** A number field's text as the API takes it: a number, or null when empty. */
export const toNumber = (text: string) => (text.trim() === "" || isNaN(Number(text)) ? null : Number(text));

export type AssetLayout = { layout_no: string; name: string; price: string; duration: string; no_of_plots: string };
export const EMPTY_LAYOUT: AssetLayout = { layout_no: "", name: "", price: "", duration: "", no_of_plots: "" };

/** Layout rows as the API takes them: blank rows dropped, numbers as numbers. */
export const toLayoutsPayload = (rows: AssetLayout[]) =>
  rows
    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()))
    .map((r) => ({ ...r, price: toNumber(String(r.price ?? "")), no_of_plots: toNumber(String(r.no_of_plots ?? "")) }));

/** A saved layout row as the editor holds it. */
export const fromLayout = (r: Partial<Record<keyof AssetLayout, unknown>>): AssetLayout => ({
  layout_no: String(r.layout_no ?? ""), name: String(r.name ?? ""), price: plainNumber(r.price),
  duration: String(r.duration ?? ""), no_of_plots: plainNumber(r.no_of_plots),
});

/** What the asset media endpoint accepts for each upload slot. */
export const ASSET_MEDIA = {
  document: { label: "Document", accept: "application/pdf,image/jpeg,image/png", hint: "PDF, JPEG or PNG, up to 20 MB" },
  fmb: { label: "FMB sketch", accept: "image/jpeg,image/png,image/webp", hint: "Image, up to 10 MB" },
  barcode: { label: "QR / barcode", accept: "image/jpeg,image/png,image/webp", hint: "Image, up to 10 MB" },
  images: { label: "Site photos", accept: "image/jpeg,image/png,image/webp", hint: "Up to 4 images, 10 MB each" },
} as const;
export type AssetMediaSlot = keyof typeof ASSET_MEDIA;
