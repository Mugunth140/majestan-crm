"use client";
import { pgReadFields, isPgFurnished } from "../_components/pg-accommodation";

import { restoreRoomDimensions } from "../_components/PropertyRoomDimensions";
import { curationReadFields, restoreContactDetails } from "../_components/property-curation-two";
import { PropertyPlotBoundaries, restorePlotBoundaries } from "../_components/PropertyPlotBoundaries";
import { parseMultiValue } from "../_components/PropertyMultiSelect";
import { convertRate, rateLabel, initialArea, areaInSqft, restorePlotArea } from "../_components/property-measurements";
import { calculateRentPerSqft } from "@/lib/rental-pricing";
import { isPropertyFieldVisible } from "../_components/property-form-fields";
import { PropertyForm } from "../_components/PropertyForm";

import { propertyStatusLabel } from "@/lib/property-status";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { lightboxStep } from "@/lib/image-lightbox";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { Section } from "@/components/record/inline-field";
import { TabHeader } from "@/components/record/feed";
import { AttachmentsArt, EmptyState } from "@/components/record/empty-state";
import { HEADER_BUTTON, HEADER_PRIMARY, StatusMenu } from "@/components/record/header-actions";
import { statusDot, statusPillClass, type StatusTone } from "@/components/tables/cells";
import { propertiesApi } from "@/lib/properties-api";
import { canViewPropertyContacts } from "@/lib/permissions";
import { LockedField } from "@/components/shared/locked-field";
import { cn } from "@/lib/utils";
import {
  Building2,
  Edit,
  Eye,
  EyeOff,
  FileQuestion,
  FileText,
  Home,
  Image as ImageIcon,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

type Tab = "overview" | "location" | "media" | "faqs";

function PageSkeleton() {
  return (
    <div className="flex flex-col md:h-full md:flex-row lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-11 items-center gap-5 border-b px-5 md:flex">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
        </div>
        <div className="space-y-5 p-4 md:p-10">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      </div>
      <div className="hidden w-[340px] shrink-0 border-l md:block xl:w-[360px]">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="h-12 w-16 rounded-lg" />
          <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
        </div>
        <div className="space-y-3 p-4">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
      </div>
    </div>
  );
}

/** A read-only row; like before, a field with no value is left out. */
function SectionField({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex min-h-9 items-start gap-3 py-1.5">
      <span className="w-[140px] shrink-0 pt-px text-[13px] text-muted-foreground" title={label}>{label}</span>
      <span className="min-w-0 flex-1 break-words text-[14px] text-foreground">{String(value)}</span>
    </div>
  );
}

/** One group of facts on a tab, two columns wide on desktop. */
function DataCard({ title, children, columns = true }: { title: string; children: ReactNode; columns?: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">{title}</h3>
      <div className={cn("px-3 py-2 md:px-4", columns && "grid gap-x-8 md:grid-cols-2")}>{children}</div>
    </section>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: typeof Home; label: string; count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors md:h-11 md:rounded-none md:px-0.5",
        active
          ? "bg-[#017D58] text-white dark:bg-[#2FB585] dark:text-black md:bg-transparent md:text-foreground md:dark:bg-transparent md:dark:text-foreground"
          : "bg-foreground/[0.06] text-foreground/80 md:bg-transparent md:text-muted-foreground md:hover:text-foreground",
      )}
    >
      <Icon className="hidden h-4 w-4 md:block" />
      {label}
      {count ? (
        <span className={cn("rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums", active ? "bg-white/20 md:bg-foreground/[0.08]" : "bg-foreground/[0.08]")}>{count}</span>
      ) : null}
      {active && <span aria-hidden className="absolute inset-x-0 -bottom-px hidden h-0.5 rounded-full bg-foreground md:block" />}
    </button>
  );
}

function formatPrice(price: number): string {
  if (!price) return "-";
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

function formatPropertyType(type: string): string {
  if (!type) return "-";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(v: any): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
}

/** Colour for the status pill; the shared table colours, plus the property-only words. */
function statusToneOf(label: string): StatusTone | undefined {
  const key = label.toLowerCase();
  return key === "rented" ? "violet" : key === "pending review" ? "amber" : undefined;
}

export default function PropertyViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [property, setProperty] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  // Gallery lightbox: index into images, null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (lightboxIndex === null || !property) return;
    const total = (property.propertyImages ?? property.images ?? []).length;
    if (total === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      else if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? i : lightboxStep(i, total, 1)));
      else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? i : lightboxStep(i, total, -1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, property]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
        setRole(user?.role?.name || user?.role || "");
      } catch {
        // ignore
      }
    }
  }, []);

  const canApprove = role === "Admin" || role === "Super Admin" || role === "Manager";

  const handleVisibility = useCallback(async () => {
    if (!id) return;
    setIsTogglingVisibility(true);
    try {
      const result = await propertiesApi.toggleVisibility(Number(id));
      if (result && result.success !== false) {
        const nextStatus = result.data?.status ?? result.status;
        setProperty((prev: any) => prev ? { ...prev, status: nextStatus, approvalStatus: result.data?.approvalStatus ?? result.approvalStatus ?? prev.approvalStatus } : prev);
        toast.success(nextStatus === "available" ? "Property is now live on the site." : "Property hidden from the site.");
      } else {
        toast.error("Failed to update visibility.");
      }
    } catch {
      toast.error("Failed to update visibility.");
    } finally {
      setIsTogglingVisibility(false);
    }
  }, [id]);

  const fetchProperty = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const result = await propertiesApi.getOne(Number(id));
      if (result && result.success !== false) {
        setProperty(result.data ?? result);
      } else {
        toast.error("Property not found.");
        router.push("/properties");
      }
    } catch {
      toast.error("Failed to load property.");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  if (isLoading) return <><MobileHeader title="Property" showBack /><PageSkeleton /></>;
  if (!property) return null;

  const statusKey = (property.status || "").toLowerCase();
  const isLive = statusKey === "available" && property.approvalStatus === "Approved";
  const isOwnerReview = property.source === "owner-post" && property.approvalStatus !== "Approved";
  const isTerminalStatus = statusKey === "sold" || statusKey === "rented";
  const det = property.propertyDetails ?? {};
  const images: any[] = property.propertyImages ?? property.images ?? [];
  const documents: any[] = property.documents ?? [];
  const faqs: any[] = property.faqs ?? [];
  const amenitiesList: any[] = property.amenitiesList ?? [];
  const units: any[] = property.propertyUnits ?? [];
  const roomDimensions = restoreRoomDimensions(det.roomDimensions);
  const loc = (property.propertyLocations ?? [])[0] ?? {};
  const localityData = loc.localityData ?? {};
  const connectivity: any[] = localityData.connectivity ?? [];
  const mapsUrl = loc.latitude && loc.longitude
    ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
    : null;

  const bool = (v: any) => (v === true || v === 1 || v === "1" ? "Yes" : v === false || v === 0 || v === "0" ? "No" : v);
  const type = property.propertyType;
  const isFieldVisible = (field: string) => isPropertyFieldVisible(field, type, property.listingType === "Rent" ? "Rent" : "Buy", property.tenantOccupied, det.furnishingStatus);
  const rentArea = isFieldVisible("areaSqft") ? areaInSqft(det.areaSqft ?? "", det.areaUnit || "Sq Ft") : Number(det.builtUpArea || areaInSqft(det.areaSqft ?? "", det.areaUnit || "Sq Ft") || 0);
  const rentPerSqft = calculateRentPerSqft(Number(property.price), rentArea ?? 0);
  const salePricePerSqft = type === "villa" ? calculateRentPerSqft(Number(property.price), Number(det.builtUpArea || 0)) : property.pricePerSqft;
  const displayedPriceUnit = ["plot", "farmland"].includes(type) ? det.measurementUnits?.pricePerSqft || "Sq Ft" : "Sq Ft";
  const displayedPriceRate = convertRate(salePricePerSqft ?? "", "Sq Ft", displayedPriceUnit);
  const curationRows = [...curationReadFields(det.curationDetails, field => isFieldVisible(field) && (field !== "restroomCount" || det.hasRestroom === true)), ...(type === "pg_service_apartment" ? pgReadFields(det.curationDetails?.pgDetails).filter(row => !["In room furnishings", "Common area furnishings"].includes(row.label) || isPgFurnished(det.furnishingStatus)) : [])];
  const contacts = restoreContactDetails(property.contactDetails);
  const boundarySides = restorePlotBoundaries(det.plotBoundaries, det.plotLength, det.plotWidth);
  const hypothecated = !["", "no", "nil", "n/a", "na", "none", "-"].includes(String(property.hypothecation ?? "").trim().toLowerCase());
  const measurement = (field: string, base = "Sq Ft") => {
    if (det[field] == null) return undefined;
    if (field === "plotArea") {
      const restored = restorePlotArea(det.plotArea, det.areaUnit || "Sq Ft", det.measurementUnits ?? {});
      return `${restored.value} ${restored.unit}`;
    }
    return `${initialArea(det[field], field, det.measurementUnits ?? {}, base)} ${det.measurementUnits?.[field] || base}`;
  };
  const isApartmentLike = ["apartment", "villa", "individual_portion", "investment_property", "pg_service_apartment", "farm_house"].includes(type);
  const isPlotLike = ["plot", "farmland"].includes(type);

  const title = property.title || `Property #${property.id}`;
  const statusLabel = propertyStatusLabel(property.status, property.approvalStatus);
  const tone = statusToneOf(statusLabel);
  const place = [property.locality, property.city].filter(Boolean).join(", ");
  const price = formatPrice(Number(type === "coworking" ? det.rentPerSeat ?? property.price : property.price));
  const listing = property.listingType === "Sell" ? "Buy" : property.listingType;
  const cover = images.find((img) => img.isPrimary) ?? images[0];
  const shownDocuments = isFieldVisible("documentUploads") ? documents : [];

  // Status changes go through the edit form as before; the pill shows where it stands.
  const statusMenu = (size: "h-7" | "h-8", align: "start" | "end" = "end") => (
    <StatusMenu status={statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)} options={[]} pillClass={statusPillClass(statusLabel, tone)} size={size} align={align} />
  );
  const visibilityButton = (className: string) => (canApprove && !isTerminalStatus ? (
    <button type="button" onClick={handleVisibility} disabled={isTogglingVisibility} className={className}
      title={isLive ? "Hide this property from the public site" : "Show this property on the public site"}>
      {isLive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      {isTogglingVisibility ? "Updating…" : isLive ? "Unpublish" : isOwnerReview ? "Approve & Publish" : "Publish"}
    </button>
  ) : null);

  const tabs: { key: Tab; label: string; icon: typeof Home; count?: number }[] = [
    { key: "overview", label: "Overview", icon: Home },
    { key: "location", label: "Location", icon: MapPin },
    { key: "media", label: "Media", icon: ImageIcon, count: images.length + shownDocuments.length },
    { key: "faqs", label: "FAQs", icon: FileQuestion, count: faqs.length },
  ];

  const overview = (
    <div className="pb-6">
      <TabHeader title="Overview" />
      <div className="space-y-5 px-3 sm:px-10">
          <DataCard title="Core Details">
            <SectionField label="Property Code" value={property.propertyCode} />
            <SectionField label="Legacy Source Id" value={property.legacySourceId} />
            <SectionField label="Property Type" value={formatPropertyType(property.propertyType)} />
            <SectionField label="Listing Type" value={property.listingType === "Sell" ? "Buy" : property.listingType} />
            <SectionField label="Status" value={propertyStatusLabel(property.status, property.approvalStatus)} />
            <SectionField label={type === "coworking" ? "Rent per Seat" : "Price"} value={formatPrice(Number(type === "coworking" ? det.rentPerSeat ?? property.price : property.price))} />
            <SectionField label="Negotiable" value={bool(property.negotiable)} />
            {!isPlotLike && (<>
            <SectionField label="Property Condition" value={property.propertyCondition} />
            </>)}
            <SectionField label="Ownership Type" value={property.ownershipType} />
            {isFieldVisible("reraNumber") && <SectionField label="RERA Number" value={property.reraNumber} />}
            {!isPlotLike && (<>
            {isFieldVisible("projectName") && <SectionField label="Project Name" value={property.projectName} />}
            {isFieldVisible("builderName") && <SectionField label="Builder Name" value={property.builderName} />}
            <SectionField label="Transaction Type" value={property.transactionType} />
            {isFieldVisible("handoverDate") && (<SectionField label="Handover Date" value={property.handoverDate} />)}
            </>)}
            <SectionField label="Sale Type" value={property.saleType} />
            {isFieldVisible("availableFrom") && (<SectionField label="Available From" value={formatDate(property.availableFrom)} />)}
            <SectionField label="Available Until" value={formatDate(property.availableUntil)} />
          </DataCard>
          <DataCard title="Pricing & Commercials">
            {isFieldVisible("rentPerSqft") && (
              <SectionField label="Rent per sqft" value={rentPerSqft === null ? undefined : `₹${rentPerSqft.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / sqft / month`} />
            )}
            {isFieldVisible("pricePerSqft") && (
              <SectionField label={["plot", "farmland"].includes(type) ? `Price per ${rateLabel(displayedPriceUnit)}` : "Sqft Price"} value={displayedPriceRate != null ? `${formatPrice(displayedPriceRate)} / ${rateLabel(displayedPriceUnit)}` : undefined} />
            )}
            {isFieldVisible("expectedSalePrice") && (<SectionField label="Expected Sale Price" value={property.expectedSalePrice ? formatPrice(Number(property.expectedSalePrice)) : undefined} />)}
            {!isPlotLike && (<>
            {isFieldVisible("monthlyRent") && (<SectionField label={type === "commercial" && property.listingType !== "Rent" ? "Expected Monthly Rent" : "Monthly Rent"} value={property.monthlyRent ? formatPrice(Number(property.monthlyRent)) : undefined} />)}
            <SectionField label="Maintenance Charges" value={property.maintenanceCharges} />
            {isFieldVisible("securityDeposit") && (<SectionField label="Security Deposit" value={property.securityDeposit} />)}
            </>)}
            {isFieldVisible("bookingAmount") && (<SectionField label="Booking Amount" value={property.bookingAmount} />)}
            <SectionField label="Brokerage Type" value={property.brokerageType} />
            <SectionField label="Brokerage Value" value={property.brokerageValue} />
            {isFieldVisible("lockInPeriod") && (
            <SectionField label="Lock-in Period" value={property.lockInPeriod} />
            )}
            <SectionField label="Taxes" value={property.taxes} />
            <SectionField label="Registration Charge" value={property.registrationCharge} />
            <SectionField label="Mode of Payment" value={property.modeOfPayment} />
            <SectionField label="Time for Registration" value={property.timeForRegistration} />
          </DataCard>
          <DataCard title="Specifications">
            {curationRows.map(row => <SectionField key={row.label} label={row.label} value={row.value} />)}
            {isFieldVisible("landArea") && <SectionField label={type === "plot" && property.listingType !== "Rent" ? "Total Project Area" : "Land Area"} value={det.areaSqft ? `${initialArea(areaInSqft(det.areaSqft, det.areaUnit || "Sq Ft"), "landArea", det.measurementUnits ?? {})} ${det.measurementUnits?.landArea || "Sq Ft"}` : undefined} />}
            {isFieldVisible("plotBoundaries") && boundarySides.some(side => side.length) && <div className="md:col-span-2"><PropertyPlotBoundaries value={boundarySides} facing={det.plotFacing || (type === "commercial" ? det.propertyFacing : "")} readOnly /></div>}
            {!isPlotLike && (<>
            {isFieldVisible("bedrooms") && (<SectionField label="Bedrooms" value={det.bedrooms} />)}
            {isFieldVisible("bathrooms") && (<SectionField label="Bathrooms" value={det.bathrooms} />)}
            </>)}
            {isFieldVisible("areaSqft") && (<SectionField label={type === "plot" ? "Total Project Area" : "Area"} value={det.areaSqft ? `${det.areaSqft} ${det.areaUnit || "Sq Ft"}` : undefined} />)}
            {!isFieldVisible("landArea") && Number(det.areaSqft) > 0 && <SectionField label="Previously recorded area" value={`${det.areaSqft} ${det.areaUnit || "Sq Ft"}`} />}
            {!isPlotLike && (<>
            {isFieldVisible("furnished") && (<SectionField label="Furnished" value={bool(det.furnished)} />)}
            {isFieldVisible("furnishingStatus") && (<SectionField label="Furnishing Status" value={det.furnishingStatus} />)}
            </>)}
            <SectionField label="Facing" value={det.propertyFacing} />
            {!isPlotLike && (<>
            <SectionField label="Property Age" value={det.propertyAge} />
            {isFieldVisible("possessionStatus") && (<SectionField label="Possession Status" value={det.possessionStatus} />)}
            </>)}
            {isFieldVisible("openSides") && (<SectionField label="Open Sides" value={det.openSides} />)}
            {!isPlotLike && (<>
            <SectionField label="Suitable For" value={det.suitableFor} />
            <SectionField label={type === "commercial" ? "Available Floor Number" : "Floor No"} value={det.floorNumber} />
            {["villa", "individual_portion", "investment_property", "farm_house"].includes(type) && <SectionField label="Plot Area" value={measurement("plotArea")} />}
            <SectionField label="Total Floors" value={det.totalFloors} />
            {isFieldVisible("hasGroundFloor") && <SectionField label="Includes Ground Floor" value={bool(det.hasGroundFloor)} />}
            {isFieldVisible("plotFacing") && <SectionField label="Plot Facing" value={det.plotFacing} />}
            {isFieldVisible("numberOfPortions") && <SectionField label="No of Portions" value={det.numberOfPortions} />}
            {isFieldVisible("parking") && <SectionField label="No of Parking" value={det.parking} />}
            {isFieldVisible("noOfLifts") && type !== "commercial" && <SectionField label="No of Lifts" value={det.noOfLifts} />}
            <SectionField label="Built-up Area" value={measurement("builtUpArea")} />
            <SectionField label="Carpet Area" value={measurement("carpetArea")} />
            {isFieldVisible("superBuiltUpArea") && (<SectionField label="Super Built-up" value={measurement("superBuiltUpArea")} />)}
            <SectionField label="UDS Area" value={measurement("udsArea")} />
            <SectionField label="Balconies" value={det.balconies} />
            <SectionField label="Parking" value={det.parking} />
            <SectionField label="Car Parking" value={det.carParking} />
            <SectionField label="Bike Parking" value={det.bikeParking} />
            <SectionField label="Guest Parking" value={bool(det.guestParking)} />
            <SectionField label="Power Backup" value={bool(det.powerBackup)} />
            <SectionField label="Water Supply" value={det.waterSupply} />
            </>)}
            <SectionField label="Road Width" value={det.roadWidth} />
          </DataCard>
          {(isApartmentLike || isPlotLike || type === "commercial" || type === "coworking" || type === "industrial") && (
            <DataCard title={`${formatPropertyType(type)} Details`}>
              {isApartmentLike && (<>
                <SectionField label="Unit Type" value={det.unitType} />
                <SectionField label="Unit Number" value={det.unitNumber} />
                <SectionField label="No. of Flats" value={det.numberOfFlats} />
                <SectionField label="Tower Nos" value={det.towerNos} />
                <SectionField label="Pooja Room" value={bool(det.poojaRoom)} />
                <SectionField label="Study Room" value={bool(det.studyRoom)} />
                <SectionField label="Architectural Style" value={det.architecturalStyle} />
                <SectionField label="Available Portion" value={det.availablePortion} />
                <SectionField label="Outdoor Spaces" value={det.outdoorSpaces} />
                {!Array.isArray(det.curationDetails?.utilities) && <SectionField label="Utilities Provided" value={det.utilitiesProvided} />}
                <SectionField label="Neighborhood" value={det.neighborhoodHighlights} />
                <SectionField label="Community Facilities" value={det.communityFacilities} />
                <SectionField label="Amenity Notes" value={det.amenities} />
              </>)}
              {(isPlotLike || type === "farm_house") && (<>
                {isFieldVisible("plotSizeCents") && (<SectionField label="Plot Size (Cents)" value={det.plotSizeCents} />)}
                <SectionField label="No of Plots" value={det.plotNos} />
                {isFieldVisible("zoning") && (<SectionField label="Zoning" value={det.zoning} />)}
                <SectionField label="Plot Type" value={det.plotType} />
                <SectionField label="SF Number" value={det.sfNumber} />
                <SectionField label="Land Type" value={det.landType} />
                {isFieldVisible("topography") && (<SectionField label="Topography" value={det.topography} />)}
                <SectionField label="Soil Type" value={det.soilType} />
                <SectionField label="Irrigation" value={det.irrigation} />
                {isFieldVisible("fencing") && (<SectionField label="Fencing" value={det.fencing} />)}
                <SectionField label="Boundary Wall" value={bool(det.boundaryWall)} />
                {isFieldVisible("plotLength") && (<SectionField label="Plot Length" value={det.plotLength} />)}
                {isFieldVisible("plotWidth") && (<SectionField label="Plot Width" value={det.plotWidth} />)}
                <SectionField label="Water Sources" value={det.waterSources} />
                <SectionField label="Crop Suitability" value={det.cropSuitability} />
                <SectionField label="Existing Plantation" value={det.existingPlantation} />
                <SectionField label="Bore Well" value={bool(det.boreWell)} />
                {det.boreWell && <SectionField label="No of Borewells" value={det.boreWellCount} />}
                <SectionField label="Storage Tank" value={bool(det.storageTank)} />
              </>)}

              {type === "commercial" && (<>
                {type === "commercial" && property.listingType === "Rent" && !Array.isArray(det.curationDetails?.specialPurposes) && <SectionField label="Special Purpose" value={det.specialPurpose} />}
                {property.listingType === "Rent" && <SectionField label="Property Accessibility" value={det.accessibility} />}
                <SectionField label="Property Use" value={det.propertyUse ? parseMultiValue(det.propertyUse).join(", ") : undefined} />
                <SectionField label="No. of Lifts" value={det.noOfLifts} />
                <SectionField label="Dimension" value={det.dimension} />
                <SectionField label="Frontage" value={det.frontage} />

                <SectionField label="Visitors Parking" value={det.visitorsParking} />
                <SectionField label="Outside Parking" value={bool(det.outsideParking)} />
                <SectionField label="Fire Safety" value={bool(det.fireSafety)} />
                <SectionField label="Ceiling Height" value={det.ceilingHeightFt} />
                <SectionField label="Electricity" value={det.electricityConnection} />
                <SectionField label="Central AC" value={bool(det.hasCentralAc)} />
                <SectionField label="Pantry" value={bool(det.hasPantry)} />
                {isFieldVisible("conferenceRoom") && (<SectionField label={type === "commercial" && property.listingType === "Rent" ? "No of Conference Hall" : "Conference Rooms"} value={det.conferenceRoom} />)}
                {isFieldVisible("seater") && (<SectionField label={type === "commercial" && property.listingType === "Rent" ? "No of Seaters" : "Seater"} value={det.seater} />)}
                <SectionField label="Tenant Mix" value={det.tenantMix} />
                <SectionField label="No. of Towers" value={det.towerNos} />
                <SectionField label="Plot Area" value={measurement("plotArea")} />
                <SectionField label="Water Supply" value={det.waterSupply} />
                <SectionField label="Lift Facility" value={bool(det.elevatorAccess)} />
                {isFieldVisible("privateCabins") && (<SectionField label={type === "commercial" && property.listingType === "Rent" ? "No of Cabins" : "Private Cabins"} value={det.privateCabins} />)}
                <SectionField label="Fully Furnished" value={bool(det.furnished)} />
                <SectionField label="Shared Washrooms" value={det.sharedWashrooms} />
                <SectionField label="Individual Washrooms" value={det.individualWashrooms} />
                {isFieldVisible("constructionDate") && (<SectionField label="Construction Date" value={det.constructionDate} />)}
                {isFieldVisible("documentRequire") && (<SectionField label="Documents Required" value={det.documentRequire} />)}
              </>)}
              {type === "coworking" && (<>
                <SectionField label="Workstations" value={det.availableWorkstations} />
                {isFieldVisible("privateCabins") && (<SectionField label="Private Cabins" value={det.privateCabins} />)}
                <SectionField label="Meeting Rooms" value={det.meetingRooms} />
                <SectionField label="Min Seats" value={det.minSeats} />
                <SectionField label="Rent / Seat" value={det.rentPerSeat} />
                <SectionField label="Advance Rent" value={det.advanceRent} />
                <SectionField label="Lease Term" value={det.leaseTerm} />
                <SectionField label="Incremental Rent" value={det.incrementalRent} />
                <SectionField label="Electricity Charges" value={det.electricityCharges} />
                <SectionField label="High-Speed WiFi" value={bool(det.highSpeedWifi)} />
                <SectionField label="Air Conditioning" value={bool(det.airConditioning)} />
                <SectionField label="CCTV" value={bool(det.cctvSurveillance)} />
                <SectionField label="Elevator Access" value={bool(det.elevatorAccess)} />
                <SectionField label="Security Staff" value={bool(det.securityStaff)} />
                <SectionField label="Restroom" value={bool(det.hasRestroom)} />
                <SectionField label="Furniture Provided" value={det.furnitureProvided} />
                <SectionField label="Accessibility" value={det.accessibility} />
              </>)}
              {type === "industrial" && (<>
                <SectionField label="Plot Area" value={measurement("plotArea")} />
                <SectionField label="Container Access" value={det.containerAccess} />
                <SectionField label="No of Labor Rooms" value={det.laborRooms} />
                <SectionField label="No of Toilets" value={det.toilets} />
                <SectionField label="Building Type" value={det.buildingType} />
                <SectionField label="Property Use" value={det.propertyUse ? parseMultiValue(det.propertyUse).join(", ") : undefined} />
                <SectionField label="Covered Area" value={measurement("coveredArea")} />
                <SectionField label="Open Area" value={measurement("openArea")} />
                <SectionField label="Ceiling Height" value={det.ceilingHeightFt} />
                <SectionField label="Floor Type" value={det.floorType} />
                <SectionField label="No. of Bays" value={det.numberOfBays} />
                <SectionField label="No. of Cabins" value={det.numberOfCabins} />
                {!Object.hasOwn(det.curationDetails ?? {}, "powerSupplyCapacity") && <SectionField label="Power Supply (HP)" value={det.powerSupplyHp} />}
                <SectionField label="Water Supply" value={det.waterSupply} />
                <SectionField label="Truck Parking" value={det.truckParking} />
                <SectionField label="Loading Bays" value={det.loadingBays} />
                <SectionField label="Warehouse Racks" value={det.warehouseRacks} />
                <SectionField label="Truck/Trailer Access" value={bool(det.truckTrailerAccess)} />
                <SectionField label="Crane Available" value={bool(det.craneAvailable)} />
                <SectionField label="Heavy Vehicle Access" value={bool(det.heavyVehicleAccess)} />
                <SectionField label="Worker Facilities" value={det.workerFacilities} />
                <SectionField label="Nearest Highway" value={det.nearestHighway} />
                <SectionField label="Nearest Railway" value={det.nearestRailway} />
                <SectionField label="Nearest Port" value={det.nearestPort} />
                <SectionField label="Nearest Airport" value={det.nearestAirport} />
                <SectionField label="Labour Availability" value={det.labourAvailability} />
                <SectionField label="Power Supply 2" value={det.powerSupply2} />
                <SectionField label="Power Supply 3" value={det.powerSupply3} />
                <SectionField label="Truck/Trailer Count" value={det.truckTrailerCount} />
                <SectionField label="Public Transport Access" value={det.publicTransportAccess} />
                <SectionField label="Ownership Proof Verified" value={det.ownershipProofVerified} />
                <SectionField label="Building Approval Certification" value={det.buildingApprovalCert ? parseMultiValue(det.buildingApprovalCert).join(", ") : undefined} />
                <SectionField label="Pollution Clearance" value={det.pollutionClearance} />

                <SectionField label="Other Legal Clearance" value={det.otherLegalClearance} />
                <SectionField label="Other Legal Details" value={det.otherLegalDetails} />

              </>)}
            </DataCard>
          )}
          {!isPlotLike && (
          <DataCard title="Amenities" columns={false}>
            {amenitiesList.length === 0 ? (
              <p className="py-2 text-[14px] text-muted-foreground">No amenities tagged.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 py-2">
                {amenitiesList.map((a: any, i: number) => (
                  <span key={a.id ?? i} className="inline-flex h-7 items-center rounded-md bg-foreground/[0.06] px-2.5 text-[13px] font-medium text-foreground">
                    {a.name || `Amenity #${a.id}`}
                  </span>
                ))}
              </div>
            )}
          </DataCard>
          )}
        {!isPlotLike && roomDimensions.length > 0 && (
          <DataCard title="Room Dimensions">
            {roomDimensions.map((r: any, i: number) => (
              <SectionField key={i} label={r.name || `Room ${i + 1}`} value={r.dimensions} />
            ))}
          </DataCard>
        )}
        {!isPlotLike && units.length > 0 && (
          <DataCard title="Units">
            {units.map((u: any, i: number) => (
              <SectionField
                key={u.id ?? i}
                label={u.title || u.unitType || `Unit ${i + 1}`}
                value={[u.unitType, u.price ? formatPrice(Number(u.price)) : null, u.status].filter(Boolean).join(" · ")}
              />
            ))}
          </DataCard>
        )}
          <DataCard title="Owner & Agent">
            {!canViewPropertyContacts() ? (
              <LockedField wide label="Contact details" />
            ) : (
              <>
                <SectionField label="Owner Name" value={property.ownerName} />
                <SectionField label="Owner Phone" value={property.ownerPhone} />
                <SectionField label="Owner Email" value={property.ownerEmail} />
                {isFieldVisible("tenantOccupied") && <SectionField label="Tenant Occupied" value={property.tenantOccupied} />}
                {(property.contactDetails?.ownerAlternatives ?? [{ name: property.alternateName, phone: property.alternatePhone, email: property.alternateEmail }]).map((contact: any, index: number) => <div className="contents" key={index}><SectionField label={`Alternative ${index + 1} Role`} value={contact.role} /><SectionField label={`Alternative ${index + 1} Name`} value={contact.name} /><SectionField label={`Alternative ${index + 1} Phone`} value={contact.phone} /><SectionField label={`Alternative ${index + 1} Email`} value={contact.email} /></div>)}
                <SectionField label="Agent Name" value={property.agentName} />
                <SectionField label="Agent Phone" value={contacts.agentPhone} /><SectionField label="Agent Email" value={contacts.agentEmail} />
                <SectionField label="Alternative Agent Name" value={contacts.agentAlternative.name} /><SectionField label="Alternative Agent Phone" value={contacts.agentAlternative.phone} /><SectionField label="Alternative Agent Email" value={contacts.agentAlternative.email} />
                <SectionField label="Agency" value={property.agencyName} />
                <SectionField label="Commission Terms" value={property.commissionTerms} />

              </>
            )}
          </DataCard>
          {isFieldVisible("documentsVerification") && (<DataCard title="Documents & Verification">
            <SectionField label="Ownership Title" value={property.ownershipTitleVerified} />
            <SectionField label="Encumbrance Cert." value={property.encumbranceCertificate} />
            {!isPlotLike && isFieldVisible("rentalAgreementDraft") && (
              <SectionField label="Rental Agreement" value={property.rentalAgreementDraft} />
            )}
            {isFieldVisible("tslrFmb") && (<SectionField label="TSLR / FMB" value={property.tslrFmb} />)}
            <SectionField label="Tax Receipt" value={property.taxReceipt} />
            {!isPlotLike && (
            <SectionField label="EB Receipt" value={property.ebReceipt} />
            )}
            {isFieldVisible("pattaChitta") && (<SectionField label="Patta / Chitta" value={property.pattaChitta} />)}
            <SectionField label="Approvals" value={property.approvals} />
            {isFieldVisible("financeFacing") && hypothecated && <SectionField label="Finance" value={property.financeFacing} />}
            {isFieldVisible("fundedBy") && hypothecated && <SectionField label="Funded By" value={det.fundedBy} />}
            {isFieldVisible("hypothecation") && (<SectionField label="Hypothecation" value={property.hypothecation} />)}
            {isFieldVisible("deviation") && (<SectionField label="Deviation" value={property.deviation} />)}
          </DataCard>)}
          <DataCard title="Market Analysis">
            <SectionField label="Comparative Price" value={property.comparativePrice} />
            {!isPlotLike && (
            <SectionField label="Rental Yield" value={property.rentalYield} />
            )}
            <SectionField label="Market Price" value={property.marketPrice} />
            <SectionField label="Demand Area" value={property.demandArea} />
            <div className="md:col-span-2">
              <SectionField label="Remark" value={property.remark} />
            </div>
          </DataCard>
        {property.description && (
          <DataCard title="Description" columns={false}>
            <p className="whitespace-pre-wrap break-words px-1 py-2 text-[14px] leading-6 text-foreground">{property.description}</p>
          </DataCard>
        )}
        <DataCard title="Record">
            <SectionField label="ID" value={property.id} />
            <SectionField label="Slug" value={property.slug} />
            {isFieldVisible("verificationStatus") && (<SectionField label="Verification" value={property.verificationStatus} />)}
            <SectionField label="Approval" value={property.approvalStatus} />
            <SectionField label="Created At" value={formatDate(property.createdAt)} />
            <SectionField label="Updated At" value={formatDate(property.updatedAt)} />
        </DataCard>
      </div>
    </div>
  );

  const location = (
    <div className="pb-6">
      <TabHeader title="Location" action={mapsUrl ? (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className={HEADER_BUTTON}>
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Open in Maps
        </a>
      ) : null} />
      <div className="space-y-5 px-3 sm:px-10">
          <DataCard title="Location">
            <SectionField label="City" value={property.city} />
            <SectionField label="State" value={property.state} />
            <SectionField label="Locality" value={property.locality} />
            <SectionField label="Address" value={loc.address} />
            <SectionField label="Pincode" value={loc.pincode} />
            <SectionField label="Latitude" value={loc.latitude} />
            <SectionField label="Longitude" value={loc.longitude} />
            <SectionField label="Road Access" value={property.roadAccess} />
            <SectionField label="Road Name" value={property.roadName} />
          </DataCard>
          <DataCard title="Connectivity">
            {connectivity.length === 0 ? (
              <p className="py-2 text-[14px] text-muted-foreground md:col-span-2">No connectivity highlights.</p>
            ) : (
              connectivity.map((c: any, i: number) => (
                <SectionField key={i} label={c.label || c.icon || `Point ${i + 1}`} value={c.detail} />
              ))
            )}
          </DataCard>
      </div>
    </div>
  );

  const media = (
    <div className="pb-6">
      <TabHeader title="Media" />
      <div className="space-y-5 px-3 sm:px-10">
        {images.length === 0 && shownDocuments.length === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No photos or documents yet" hint="Photos, floor plans and documents are added from Edit → Media & documents." />
        ) : (
          <>
            <DataCard title={`Photos (${images.length})`} columns={false}>
              {images.length === 0 ? (
                <p className="py-2 text-[14px] text-muted-foreground">No images uploaded.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3 md:grid-cols-4">
                  {images.map((img: any, idx: number) => (
                    <button
                      key={img.id ?? idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="relative block aspect-video cursor-pointer overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
                      aria-label={`View image ${idx + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- CDN images */}
                      <img src={img.imageUrl} alt={`Property image ${idx + 1}`} className="h-full w-full object-cover" />
                      {img.isPrimary && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                          Primary
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </DataCard>
            {shownDocuments.length > 0 && (
              <DataCard title={`Documents (${shownDocuments.length})`} columns={false}>
                <div className="divide-y">
                  {shownDocuments.map((doc: any, idx: number) => (
                    <a
                      key={doc.id ?? idx}
                      href={doc.fileUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 px-1 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">{doc.fileName || doc.title || "Document"}</p>
                          <p className="text-[12px] capitalize text-muted-foreground">{(doc.documentType || "other").replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] font-medium text-muted-foreground">View</span>
                    </a>
                  ))}
                </div>
              </DataCard>
            )}
          </>
        )}
      </div>
    </div>
  );

  const faqTab = (
    <div className="pb-6">
      <TabHeader title="FAQs" />
      <div className="px-3 sm:px-10">
        {faqs.length === 0 ? (
          <EmptyState art={<AttachmentsArt />} title="No FAQs yet" hint="Questions buyers ask, answered once. Add them from Edit → FAQs." />
        ) : (
          <section className="divide-y overflow-hidden rounded-xl border bg-card">
            {faqs.map((f: any, i: number) => (
              <div key={f.id ?? i} className="px-4 py-3.5">
                <p className="text-[14px] font-medium text-foreground">{f.question}</p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:h-full lg:-mx-6 lg:-mb-8 lg:-mt-6 lg:h-[calc(100%+3.5rem)]">
      <MobileHeader title={title} showBack />

      <PageActions>
        <div className="flex items-center gap-2">
          {statusMenu("h-8")}
          {visibilityButton(isLive ? HEADER_BUTTON : HEADER_PRIMARY)}
          <button type="button" onClick={() => setEditing(true)} className={HEADER_BUTTON}>
            <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit
          </button>
        </div>
      </PageActions>

      {/* ── Phone summary ── */}
      <div className="space-y-3 px-4 pb-4 pt-1 md:hidden">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
          {statusMenu("h-7", "start")}
          {property.propertyCode && <span>{property.propertyCode}</span>}
          <span>{price}</span>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground/[0.06] px-3 text-[15px] font-medium text-foreground">
          <Edit className="h-4 w-4 text-muted-foreground" /> Edit
        </button>
        {visibilityButton("flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-3 text-[15px] font-medium text-background disabled:opacity-50")}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div role="tablist" aria-label="Property sections"
            className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 flex shrink-0 gap-1.5 overflow-x-auto bg-background px-4 py-2 scrollbar-hide md:static md:gap-5 md:border-b md:px-5 md:py-0">
            {tabs.map((t) => (
              <TabButton key={t.key} active={activeTab === t.key} onClick={() => setActiveTab(t.key)} icon={t.icon} label={t.label} count={t.count} />
            ))}
          </div>
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
            {activeTab === "overview" && overview}
            {activeTab === "location" && location}
            {activeTab === "media" && media}
            {activeTab === "faqs" && faqTab}
          </div>
        </div>

        <aside className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l md:flex xl:w-[360px]">
          <div className="flex items-center gap-3 border-b p-4">
            {cover?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- CDN cover thumbnail
              <img src={cover.imageUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg border object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground"><Building2 className="h-5 w-5" /></span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold leading-6 text-foreground" title={title}>{title}</p>
              <p className="truncate text-[13px] text-muted-foreground">{[property.propertyCode, place].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <Section title="Details">
            <div className="px-1">
              <div className="flex min-h-9 items-center gap-3 py-1.5">
                <span className="w-[140px] shrink-0 text-[13px] text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-2 text-[14px] capitalize text-foreground"><span className={cn("h-2 w-2 rounded-full", statusDot(statusLabel, tone))} />{statusLabel}</span>
              </div>
              <SectionField label="Type" value={formatPropertyType(type)} />
              <SectionField label="Listing" value={listing} />
              <SectionField label={type === "coworking" ? "Rent per seat" : "Price"} value={price} />
              <SectionField label="Locality" value={place} />
              <SectionField label="Approval" value={property.approvalStatus} />
              <SectionField label="Updated" value={formatDate(property.updatedAt)} />
            </div>
          </Section>
        </aside>
      </div>

        {/* Image lightbox */}
        <Dialog open={lightboxIndex !== null} onOpenChange={(o) => !o && setLightboxIndex(null)}>
          <DialogContent
            showCloseButton={false}
            className="w-screen! max-w-none! h-[100dvh]! p-0! gap-0! rounded-none! border-0! bg-black/95!"
          >
            {lightboxIndex !== null && images[lightboxIndex] && (
              <div className="relative w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- CDN images */}
                <img
                  src={images[lightboxIndex].imageUrl}
                  alt={`Property image ${lightboxIndex + 1}`}
                  className="w-full h-[100dvh] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close"
                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                {images.length > 1 && (
                  <>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium tabular-nums">
                      {lightboxIndex + 1} / {images.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex((i) => (i === null ? i : lightboxStep(i, images.length, -1)))}
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex((i) => (i === null ? i : lightboxStep(i, images.length, 1)))}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

      {editing && (
        <PropertyForm
          mode="edit"
          initialData={property}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            void fetchProperty();
          }}
        />
      )}
    </div>
  );
}
