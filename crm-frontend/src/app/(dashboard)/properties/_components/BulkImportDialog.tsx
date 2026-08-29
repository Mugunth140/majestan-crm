"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UploadCloud, Download, Loader2 } from "lucide-react";
import { propertiesApi } from "@/lib/properties-api";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedRow = Record<string, any>;

const REQUIRED_HEADERS = ["Title", "Listing Type", "Property Type", "Price", "City"];
const OPTIONAL_HEADERS = [
  "Locality",
  "Bedrooms",
  "Bathrooms",
  "Area Sqft",
  "Owner Name",
  "Owner Phone",
  "Description",
];

const SAMPLE_ROW = {
  Title: "3 BHK Apartment in Saravanampatti",
  "Listing Type": "Sell",
  "Property Type": "apartment",
  Price: 4500000,
  City: "Coimbatore",
  Locality: "Saravanampatti",
  Bedrooms: 3,
  Bathrooms: 2,
  "Area Sqft": 1200,
  "Owner Name": "John Doe",
  "Owner Phone": "9876543210",
  Description: "Spacious apartment with modern amenities",
};

function normalizeListingType(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (lower === "buy" || lower === "sell") return "Sell";
  if (lower === "rent") return "Rent";
  return raw.trim();
}

function normalizePropertyType(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    apartment: "apartment",
    villa: "villa",
    plot: "plot",
    commercial: "commercial",
    "commercial space": "commercial",
    coworking: "coworking",
    "co-working": "coworking",
    farmland: "farmland",
    industrial: "industrial",
    "industrial space": "industrial",
    "independent house": "individual_portion",
    "individual portion": "individual_portion",
    individual_portion: "individual_portion",
  };
  return map[lower] ?? lower;
}

// ---------------------------------------------------------------------------
// Row accessor helpers (all key lookups are case-insensitive + trimmed)
// ---------------------------------------------------------------------------

function buildLookup(row: Record<string, unknown>): (key: string) => string | undefined {
  // Build a map from lowercased-trimmed key → original value once per row
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    normalized[k.trim().toLowerCase()] = row[k];
  }
  return (key: string) => {
    const v = normalized[key.trim().toLowerCase()];
    if (v == null) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  };
}

function makeHelpers(row: Record<string, unknown>) {
  const get = buildLookup(row);

  /** Return string value or undefined */
  const str = (key: string): string | undefined => get(key);

  /** Multi-key: return first match */
  const strAny = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  /** Parse boolean from "Yes"/"No"/"1"/"0" */
  const bool = (...keys: string[]): boolean | undefined => {
    const v = strAny(...keys)?.toLowerCase();
    if (v === "yes" || v === "1" || v === "true") return true;
    if (v === "no" || v === "0" || v === "false") return false;
    return undefined;
  };

  /** Parse numeric value, stripping non-numeric chars (e.g. "150 HP" → 150) */
  const num = (...keys: string[]): number | undefined => {
    const v = strAny(...keys);
    if (v === undefined) return undefined;
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? undefined : n;
  };

  return { str, strAny, bool, num };
}

// ---------------------------------------------------------------------------
// Main row → payload mapper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToPayload(row: Record<string, unknown>): Record<string, any> {
  const { str, strAny, bool, num } = makeHelpers(row);

  // ------------------------------------------------------------------
  // Core / required
  // ------------------------------------------------------------------
  const title = strAny("title", "property name") ?? "";
  const rawListingType = strAny("listing type", "post type") ?? "";
  const rawPropertyType = strAny("property type") ?? "";
  const rawPrice = strAny("price") ?? "";
  const city = strAny("city") ?? "";
  const price = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;

  // ------------------------------------------------------------------
  // Lat/Lng from "Latitude / Longitude" combined field
  // ------------------------------------------------------------------
  const latLngRaw = strAny("latitude / longitude", "latitude/longitude", "lat/lng");
  let latitude: number | undefined;
  let longitude: number | undefined;
  if (latLngRaw) {
    // Supports "11.0286362, 76.9068336" or "11.0286362 / 76.9068336"
    const parts = latLngRaw.split(/[\/,]/).map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      latitude = parts[0];
      longitude = parts[1];
    }
  }
  // Also support separate lat/lng columns
  if (latitude === undefined) latitude = num("latitude");
  if (longitude === undefined) longitude = num("longitude");

  // ------------------------------------------------------------------
  // Universal fields (all property types)
  // ------------------------------------------------------------------
  const payload: Record<string, unknown> = {
    title: normalizeListingType(rawListingType) === "Sell" ? title : title,
    listingType: normalizeListingType(rawListingType),
    propertyType: normalizePropertyType(rawPropertyType),
    price,
    city,
    locality: strAny("locality", "sublocation"),
    bedrooms: num("bedrooms", "bedroom", "no. of bedrooms", "number of bedrooms"),
    bathrooms: num("bathrooms", "bathroom", "no. of bathrooms", "number of bathrooms"),
    areaSqft: num("area sqft", "area (sqft)", "area"),
    ownerName: strAny("owner name"),
    ownerPhone: strAny("owner phone", "owner mobile", "owner mobile no", "owner mobileno"),
    ownerEmail: strAny("owner email"),
    description: strAny("description"),
    latitude,
    longitude,

    // Contact alternates
    alternateName: strAny("alternate name"),
    alternatePhone: strAny("alternate mobile number", "alternate mobileno"),
    alternateEmail: str("alternate email"),

    // Location / road
    roadAccess: str("road access"),
    roadName: str("road name"),

    // Transaction details
    transactionType: str("transaction type"),
    handoverDate: str("handover date"),
    tenantOccupied: bool("tenant occupied"),
    saleType: strAny("sale", "sales"),

    // Agent / agency
    agentName: str("agent name"),
    agencyName: str("agency name"),
    commissionTerms: strAny("commission terms", "commmission terms"),

    // Financials
    expectedSalePrice: num("expected sale price"),
    monthlyRent: num("monthly rent"),
    lockInPeriod: str("lock in period"),
    taxes: str("taxes"),
    registrationCharge: strAny("registration charge", "registration charges"),
    modeOfPayment: strAny("mode of payment", "payment mode"),
    timeForRegistration: strAny("time for registration", "registration time"),

    // Notes
    remark: strAny("remark", "remarks"),

    // Valuation
    demandArea: str("demand area"),
    rentalYield: str("rental yield"),
    comparativePrice: strAny("compartive price", "comparative price"),
    marketPrice: str("market price"),
    negotiable: bool("negotiable"),

    // Legal / verification
    ownershipTitleVerified: strAny("ownership title verified", "ownership title"),
    encumbranceCertificate: str("encumbrance certificate"),
    rentalAgreementDraft: strAny(
      "rental agreement draft",
      "rental agreement",
      "rental agreement (for rentals)",
      "rental agreement drafted(for rentals)"
    ),
    tslrFmb: strAny("tslr / fmb", "tslr"),
    taxReceipt: str("tax receipt"),
    ebReceipt: strAny("eb receipt"),
    pattaChitta: strAny("patta chitta verified", "patta / chitta certificate"),
    approvals: strAny("approvals", "approval"),
    financeFacing: str("finance facing"),
    hypothecation: strAny("hyphotication", "hypothecation"),
    deviation: str("deviation"),

    // Photos (image URLs)
    photos: [
      strAny("photo1", "photo 1"),
      strAny("photo2", "photo 2"),
      strAny("photo3", "photo 3"),
      strAny("photo4", "photo 4"),
      strAny("photo5", "photo 5"),
      strAny("photo6", "photo 6"),
      strAny("photo7", "photo 7"),
      strAny("photo8", "photo 8"),
      strAny("photo9", "photo 9"),
      strAny("photo10", "photo 10"),
    ].filter(Boolean),

    // Document attachments
    attachment1: strAny("attachment1", "attachment 1"),
    attachment2: strAny("attachment2", "attachment 2"),
    attachment3: strAny("attachment3", "attachment 3"),
    attachment4: strAny("attachment4", "attachment 4"),
    attachment5: strAny("attachment5", "attachment 5"),
    attachment6: strAny("attachment6", "attachment 6"),
  };

  // ------------------------------------------------------------------
  // Apartment / Villa / Individual House specific
  // ------------------------------------------------------------------
  const pt = normalizePropertyType(rawPropertyType);
  if (["apartment", "villa", "individual_portion"].includes(pt)) {
    Object.assign(payload, {
      unitType: str("unit type"),
      unitNumber: str("unit number"),
      numberOfFlats: num("number of flats"),
      towerNos: num("tower nos"),
      superBuiltUpArea: num("super built up area", "super built-up area"),
      udsArea: num("uds area"),
      builtUpArea: num("built up area", "built-up area"),
      carpetArea: num("carpet area"),
      plotArea: num("plot area"),
      balconies: num("balcony nos", "balconies nos"),
      poojaRoom: bool("pooja"),
      studyRoom: bool("study / store"),
      architecturalStyle: str("architectural style"),
      availablePortion: str("available portion"),
      amenities: strAny("amenities", "amentities"),
      outdoorSpaces: str("outdoor spaces"),
      utilitiesProvided: str("utilities provided"),
      neighborhoodHighlights: str("neighborhood highlights"),
      communityFacilities: str("community facilities"),
    });
  }

  // ------------------------------------------------------------------
  // Plot / Farmland specific
  // ------------------------------------------------------------------
  if (["plot", "farmland"].includes(pt)) {
    Object.assign(payload, {
      areaSqft: num("total area of land / plot", "total area") ?? payload.areaSqft,
      plotNos: num("plot nos"),
      zoning: strAny("zoning / usage", "zoning"),
      plotType: str("plot type"),
      sfNumber: str("sf no"),
      landType: str("land type"),
      topography: str("topography"),
      soilType: str("soil type"),
      irrigation: str("irrigation facilities"),
      fencing: strAny("fenching resource", "fencing"),
      cropSuitability: str("crop suitability"),
      existingPlantation: str("existing plantation"),
      boreWell: bool("bore well"),
      storageTank: bool("storage tank"),
      waterSources: strAny("water sources", "water resource"),
      neighborhoodHighlights: strAny("surrounding infrastructure", "neighborhood highlights"),
    });
  }

  // ------------------------------------------------------------------
  // Commercial specific
  // ------------------------------------------------------------------
  if (pt === "commercial") {
    Object.assign(payload, {
      propertyUse: strAny("property use", "propertyuse"),
      noOfLifts: num("no of lifts"),
      dimension: str("dimension"),
      frontage: str("frontage"),
      carParking: num("no of car parking"),
      bikeParking: num("no of bike parking"),
      outsideParking: bool("outside parking"),
      visitorsParking: str("visitors parking"),
      fireSafety: strAny("fire safety compliance"),
      ceilingHeightFt: num("ceiling height"),
      electricityConnection: strAny("electricity", "electricity connection"),
      powerBackup: strAny("power backup"),
      airConditioning: str("air conditioning"),
      conferenceRoom: num("conference room"),
      seater: num("seater"),
      tenantMix: str("tenant mix"),
    });
  }

  // ------------------------------------------------------------------
  // Coworking specific
  // ------------------------------------------------------------------
  if (pt === "coworking") {
    Object.assign(payload, {
      builtUpArea: num("total built up area") ?? payload.builtUpArea,
      availableWorkstations: num("available workstation"),
      privateCabins: num("private cabins"),
      meetingRooms: num("available meeting rooms"),
      rentPerSeat: num("expected rent / seat"),
      advanceRent: num("advance rent"),
      leaseTerm: str("lease term"),
      incrementalRent: str("incremental rent clause"),
      electricityCharges: str("electricity charges"),
      highSpeedWifi: bool("high speed of wifi"),
      airConditioning: str("air conditioning"),
      cctvSurveillance: str("cctv surveillance"),
      securityStaff: str("security staff"),
      elevatorAccess: str("elevator access"),
      furnitureProvided: str("provided furniture"),
      accessibility: str("accessibility"),
      furnishingStatus: str("condition of space"),
    });
  }

  // ------------------------------------------------------------------
  // Industrial specific
  // ------------------------------------------------------------------
  if (pt === "industrial") {
    Object.assign(payload, {
      buildingType: str("building type"),
      propertyUse: strAny("property use", "propertyuse"),
      builtUpArea: num("built up area", "built-up area") ?? payload.builtUpArea,
      coveredArea: num("covered area"),
      openArea: num("open area"),
      ceilingHeightFt: num("ceiling height"),
      floorType: str("floor type"),
      numberOfBays: num("number of bays"),
      numberOfCabins: num("number of cabins"),
      powerSupplyHp: num("power supply1"),
      waterSupply: str("water supply"),
      truckParking: num("truck parking nos"),
      carParking: num("car parking nos"),
      bikeParking: num("bike parking nos"),
      fireSafety: strAny("fire safety compilance", "fire safety compliance"),
      loadingBays: num("loading / unloading bays"),
      warehouseRacks: num("warehouse racks / storage"),
      truckTrailerAccess: str("truck / trailer access"),
      craneAvailable: str("crane or lift available"),
      workerFacilities: str("facilties for workers"),
      nearestHighway: str("proximity to highway / transport hub"),
      nearestRailway: str("nearest railway station"),
      nearestPort: str("nearest port"),
      nearestAirport: str("nearest airport"),
      labourAvailability: str("labour force availability"),
      powerBackup: str("power backup"),
    });
  }

  // Remove undefined values to keep payload clean
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined || (Array.isArray(payload[key]) && (payload[key] as unknown[]).length === 0)) {
      delete payload[key];
    }
  }

  return payload;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: BulkImportDialogProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setParsedRows([]);
    setParseError(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet([SAMPLE_ROW]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Property_Import_Template.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setParseError(null);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const XLSX = await import("xlsx");
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

        if (data.length === 0) {
          setParseError("The uploaded file appears to be empty.");
          setIsProcessing(false);
          return;
        }

        // Validate required headers (case-insensitive)
        const headers = Object.keys(data[0] || {}).map((h) => h.trim().toLowerCase());
        const missingHeaders = REQUIRED_HEADERS.filter(
          (h) => !headers.includes(h.toLowerCase())
        );
        if (missingHeaders.length > 0) {
          setParseError(
            `Missing required columns: ${missingHeaders.join(", ")}. Please use the template.`
          );
          setIsProcessing(false);
          return;
        }

        // Parse rows
        const rows: ParsedRow[] = [];
        for (let i = 0; i < data.length; i++) {
          const raw = data[i];
          const rowNum = i + 2; // row 1 = header

          const { strAny } = makeHelpers(raw);
          const title = strAny("title", "property name") ?? "";
          const rawListingType = strAny("listing type", "post type") ?? "";
          const rawPropertyType = strAny("property type") ?? "";
          const rawPrice = strAny("price") ?? "";
          const city = strAny("city") ?? "";

          if (!title) {
            setParseError(`Row ${rowNum}: Title is required.`);
            setIsProcessing(false);
            return;
          }
          if (!rawListingType) {
            setParseError(`Row ${rowNum}: Listing Type is required.`);
            setIsProcessing(false);
            return;
          }
          if (!rawPropertyType) {
            setParseError(`Row ${rowNum}: Property Type is required.`);
            setIsProcessing(false);
            return;
          }
          if (!rawPrice && rawPrice !== "0") {
            setParseError(`Row ${rowNum}: Price is required.`);
            setIsProcessing(false);
            return;
          }
          if (!city) {
            setParseError(`Row ${rowNum}: City is required.`);
            setIsProcessing(false);
            return;
          }

          const price = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
          if (isNaN(price)) {
            setParseError(`Row ${rowNum}: Price must be a number.`);
            setIsProcessing(false);
            return;
          }

          rows.push(mapRowToPayload(raw));
        }

        setParsedRows(rows);
      } catch {
        setParseError("Failed to parse the file. Please ensure it is a valid Excel file.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      const result = await propertiesApi.bulk(parsedRows);
      const imported = result.created ?? result.count ?? parsedRows.length;
      const skipped = result.skipped ?? result.existing ?? 0;
      toast.success(
        `Imported ${imported} properties.${skipped > 0 ? ` Skipped ${skipped}.` : ""}`
      );
      onSuccess();
      handleClose();
    } catch {
      toast.error("Failed to import properties. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Bulk Import Properties</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download Template
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Upload Area */}
          {parsedRows.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/20 border-border/60">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Processing file...</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    .xlsx or .xls files
                  </p>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="max-w-[250px] cursor-pointer"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </div>
          )}

          {/* Error */}
          {parseError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {parseError}
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Preview — {parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} parsed
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setParsedRows([]);
                    setParseError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          #
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          Title
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          Listing
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          Type
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          Price
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          City
                        </TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 sticky top-0">
                          Owner
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground text-xs">
                            {i + 1}
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[150px]">
                            <span title={row.title}>
                              {String(row.title ?? "").length > 30
                                ? String(row.title).slice(0, 30) + "…"
                                : String(row.title ?? "")}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{row.listingType}</TableCell>
                          <TableCell className="text-sm">{row.propertyType}</TableCell>
                          <TableCell className="text-sm">
                            ₹{Number(row.price ?? 0).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-sm">{row.city}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.ownerName || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Required columns info */}
          {parsedRows.length === 0 && !parseError && (
            <div className="text-xs text-muted-foreground space-y-1 px-1">
              <p>
                <span className="font-semibold text-foreground">Required columns:</span>{" "}
                {REQUIRED_HEADERS.join(", ")}
              </p>
              <p>
                <span className="font-semibold text-foreground">Optional columns:</span>{" "}
                {OPTIONAL_HEADERS.join(", ")}
              </p>
              <p className="text-muted-foreground/70">
                Listing Type values: Sell, Buy (mapped to Sell), Rent
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 border-t pt-4 gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || isImporting}
            className="bg-[#0052FF] text-white hover:bg-[#0052FF]/90 shadow-md px-6"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              `Confirm & Import ${parsedRows.length > 0 ? `(${parsedRows.length})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
