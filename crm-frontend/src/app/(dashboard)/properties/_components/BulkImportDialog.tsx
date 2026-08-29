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

interface ParsedRow {
  title: string;
  listingType: string;
  propertyType: string;
  price: number;
  city: string;
  locality?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqft?: number;
  ownerName?: string;
  ownerPhone?: string;
  description?: string;
}

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
    reader.onload = async evt => {
      const XLSX = await import("xlsx");
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setParseError("The uploaded file appears to be empty.");
          setIsProcessing(false);
          return;
        }

        // Validate headers
        const headers = Object.keys(data[0] || {});
        const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          setParseError(
            `Missing required columns: ${missingHeaders.join(", ")}. Please use the template.`
          );
          setIsProcessing(false);
          return;
        }

        // Validate and parse rows
        const rows: ParsedRow[] = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2; // row 1 = header

          const title = String(row["Title"] ?? "").trim();
          const rawListingType = String(row["Listing Type"] ?? "").trim();
          const rawPropertyType = String(row["Property Type"] ?? "").trim();
          const rawPrice = row["Price"];
          const city = String(row["City"] ?? "").trim();

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
          if (!rawPrice && rawPrice !== 0) {
            setParseError(`Row ${rowNum}: Price is required.`);
            setIsProcessing(false);
            return;
          }
          if (!city) {
            setParseError(`Row ${rowNum}: City is required.`);
            setIsProcessing(false);
            return;
          }

          const price = Number(rawPrice);
          if (isNaN(price)) {
            setParseError(`Row ${rowNum}: Price must be a number.`);
            setIsProcessing(false);
            return;
          }

          rows.push({
            title,
            listingType: normalizeListingType(rawListingType),
            propertyType: normalizePropertyType(rawPropertyType),
            price,
            city,
            locality: row["Locality"] ? String(row["Locality"]).trim() : undefined,
            bedrooms: row["Bedrooms"] != null ? Number(row["Bedrooms"]) : undefined,
            bathrooms: row["Bathrooms"] != null ? Number(row["Bathrooms"]) : undefined,
            areaSqft: row["Area Sqft"] != null ? Number(row["Area Sqft"]) : undefined,
            ownerName: row["Owner Name"] ? String(row["Owner Name"]).trim() : undefined,
            ownerPhone: row["Owner Phone"] ? String(row["Owner Phone"]).trim() : undefined,
            description: row["Description"] ? String(row["Description"]).trim() : undefined,
          });
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
                              {row.title.length > 30
                                ? row.title.slice(0, 30) + "…"
                                : row.title}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{row.listingType}</TableCell>
                          <TableCell className="text-sm">{row.propertyType}</TableCell>
                          <TableCell className="text-sm">
                            ₹{row.price.toLocaleString("en-IN")}
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
