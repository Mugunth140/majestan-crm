"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeader } from "@/components/layout/mobile-header";
import { propertiesApi } from "@/lib/properties-api";
import { canViewPropertyContacts } from "@/lib/permissions";
import { LockedField } from "@/components/shared/locked-field";
import {
  ArrowLeft,
  Edit,
  Home,
  MapPin,
  Map,
  Ruler,
  User,
  Image as ImageIcon,
  FileText,
  Hash,
  RefreshCw,
  IndianRupee,
  Building2,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
  Sparkles,
  Layers,
} from "lucide-react";

function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function SectionField({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">{label}</span>
      <span className="font-medium text-[14px] text-foreground">{String(value)}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{children}</div>
    </div>
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

const STATUS_BADGE: Record<string, string> = {
  available: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  unavailable: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  sold: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  rented: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function PropertyViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [property, setProperty] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) return <PageSkeleton />;
  if (!property) return null;

  const statusKey = (property.status || "").toLowerCase();
  const det = property.propertyDetails ?? {};
  const images: any[] = property.propertyImages ?? property.images ?? [];
  const documents: any[] = property.documents ?? [];
  const faqs: any[] = property.faqs ?? [];
  const amenitiesList: any[] = property.amenitiesList ?? [];
  const units: any[] = property.propertyUnits ?? [];
  const roomDimensions: any[] = det.roomDimensions ?? [];
  const loc = (property.propertyLocations ?? [])[0] ?? {};
  const localityData = loc.localityData ?? {};
  const connectivity: any[] = localityData.connectivity ?? [];
  const mapsUrl = loc.latitude && loc.longitude
    ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
    : null;

  const bool = (v: any) => (v === true || v === 1 || v === "1" ? "Yes" : v === false || v === 0 || v === "0" ? "No" : v);
  const type = property.propertyType;
  const isApartmentLike = ["apartment", "villa", "individual_portion"].includes(type);
  const isPlotLike = ["plot", "farmland"].includes(type);

  return (
    <div className="flex flex-col md:h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <MobileHeader title={property.title || `Property #${property.id}`} showBack />

      {/* ── Header (desktop only) ── */}
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => router.push("/properties")}>
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {property.title || `Property #${property.id}`}
            </h1>
            <Badge className={`capitalize ${STATUS_BADGE[statusKey] ?? STATUS_BADGE["unavailable"]}`}>
              {property.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={fetchProperty} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push(`/properties/new?edit=${property.id}`)} className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md">
            <Edit className="h-4 w-4 mr-2" />
            Edit Property
          </Button>
        </div>
      </div>

      {/* ── Mobile Summary Strip ── */}
      <div className="md:hidden flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`capitalize ${STATUS_BADGE[statusKey] ?? STATUS_BADGE["unavailable"]}`}>{property.status}</Badge>
          <span className="text-sm font-semibold text-muted-foreground">{formatPrice(Number(property.price))}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => router.push(`/properties/new?edit=${property.id}`)} className="h-11 rounded-xl text-foreground font-semibold border-border/60">
            <Edit className="w-4 h-4 mr-2 text-muted-foreground" /> Edit
          </Button>
          <Button variant="outline" onClick={fetchProperty} className="h-11 rounded-xl border-border/60 font-semibold text-foreground">
            <RefreshCw className="w-4 h-4 mr-2 text-muted-foreground" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-4 lg:px-0 lg:pr-2">

        {/* Core Details + Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Core Details" icon={<Home className="h-4 w-4 text-[#0052FF]" />}>
            <SectionField label="Property Code" value={property.propertyCode} />
            <SectionField label="Property Type" value={formatPropertyType(property.propertyType)} />
            <SectionField label="Listing Type" value={property.listingType === "Sell" ? "Buy" : property.listingType} />
            <SectionField label="Status" value={property.status} />
            <SectionField label="Price" value={formatPrice(Number(property.price))} />
            <SectionField label="Negotiable" value={bool(property.negotiable)} />
            <SectionField label="Property Condition" value={property.propertyCondition} />
            <SectionField label="Ownership Type" value={property.ownershipType} />
            <SectionField label="RERA Number" value={property.reraNumber} />
            <SectionField label="Project Name" value={property.projectName} />
            <SectionField label="Builder Name" value={property.builderName} />
            <SectionField label="Transaction Type" value={property.transactionType} />
            <SectionField label="Handover Date" value={property.handoverDate} />
            <SectionField label="Sale Type" value={property.saleType} />
            <SectionField label="Available From" value={formatDate(property.availableFrom)} />
            <SectionField label="Available Until" value={formatDate(property.availableUntil)} />
          </Section>

          <Section title="Location" icon={<MapPin className="h-4 w-4 text-orange-500" />}>
            <SectionField label="City" value={property.city} />
            <SectionField label="State" value={property.state} />
            <SectionField label="Locality" value={property.locality} />
            <div className="sm:col-span-2">
              <SectionField label="Address" value={loc.address} />
            </div>
            <SectionField label="Pincode" value={loc.pincode} />
            <SectionField label="Latitude" value={loc.latitude} />
            <SectionField label="Longitude" value={loc.longitude} />
            <SectionField label="Road Access" value={property.roadAccess} />
            <SectionField label="Road Name" value={property.roadName} />
            {mapsUrl && (
              <div className="flex flex-col gap-1 py-2 border-b border-border/30 last:border-0 sm:col-span-2">
                <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Map</span>
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-medium text-[14px] text-[#0052FF] hover:underline flex items-center gap-1">
                  <Map className="h-3 w-3" /> View on Map
                </a>
              </div>
            )}
          </Section>
        </div>

        {/* Pricing + Owner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Pricing & Commercials" icon={<IndianRupee className="h-4 w-4 text-emerald-600" />}>
            <SectionField label="Expected Sale Price" value={property.expectedSalePrice ? formatPrice(Number(property.expectedSalePrice)) : undefined} />
            <SectionField label="Monthly Rent" value={property.monthlyRent ? formatPrice(Number(property.monthlyRent)) : undefined} />
            <SectionField label="Maintenance Charges" value={property.maintenanceCharges} />
            <SectionField label="Security Deposit" value={property.securityDeposit} />
            <SectionField label="Booking Amount" value={property.bookingAmount} />
            <SectionField label="Brokerage Type" value={property.brokerageType} />
            <SectionField label="Brokerage Value" value={property.brokerageValue} />
            <SectionField label="Lock-in Period" value={property.lockInPeriod} />
            <SectionField label="Taxes" value={property.taxes} />
            <SectionField label="Registration Charge" value={property.registrationCharge} />
            <SectionField label="Mode of Payment" value={property.modeOfPayment} />
            <SectionField label="Time for Registration" value={property.timeForRegistration} />
          </Section>

          <Section title="Owner & Agent" icon={<User className="h-4 w-4 text-teal-500" />}>
            {!canViewPropertyContacts() ? (
              <LockedField wide label="Contact details" />
            ) : (
              <>
                <SectionField label="Owner Name" value={property.ownerName} />
                <SectionField label="Owner Phone" value={property.ownerPhone} />
                <SectionField label="Owner Email" value={property.ownerEmail} />
                <SectionField label="Tenant Occupied" value={property.tenantOccupied} />
                <SectionField label="Agent Name" value={property.agentName} />
                <SectionField label="Agency" value={property.agencyName} />
                <SectionField label="Commission Terms" value={property.commissionTerms} />
                <SectionField label="Alternate Name" value={property.alternateName} />
                <SectionField label="Alternate Phone" value={property.alternatePhone} />
                <SectionField label="Alternate Email" value={property.alternateEmail} />
              </>
            )}
          </Section>
        </div>

        {/* Common Specs + Type Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Specifications" icon={<Ruler className="h-4 w-4 text-purple-500" />}>
            <SectionField label="Bedrooms" value={det.bedrooms} />
            <SectionField label="Bathrooms" value={det.bathrooms} />
            <SectionField label="Area" value={det.areaSqft ? `${det.areaSqft} ${det.areaUnit || "Sq Ft"}` : undefined} />
            <SectionField label="Furnished" value={bool(det.furnished)} />
            <SectionField label="Furnishing Status" value={det.furnishingStatus} />
            <SectionField label="Facing" value={det.propertyFacing} />
            <SectionField label="Property Age" value={det.propertyAge} />
            <SectionField label="Possession Status" value={det.possessionStatus} />
            <SectionField label="Open Sides" value={det.openSides} />
            <SectionField label="Suitable For" value={det.suitableFor} />
            <SectionField label="Floor No" value={det.floorNumber} />
            <SectionField label="Total Floors" value={det.totalFloors} />
            <SectionField label="Built-up Area" value={det.builtUpArea} />
            <SectionField label="Carpet Area" value={det.carpetArea} />
            <SectionField label="Super Built-up" value={det.superBuiltUpArea} />
            <SectionField label="Plot Area" value={det.plotArea} />
            <SectionField label="UDS Area" value={det.udsArea} />
            <SectionField label="Balconies" value={det.balconies} />
            <SectionField label="Parking" value={det.parking} />
            <SectionField label="Car Parking" value={det.carParking} />
            <SectionField label="Bike Parking" value={det.bikeParking} />
            <SectionField label="Guest Parking" value={bool(det.guestParking)} />
            <SectionField label="Power Backup" value={bool(det.powerBackup)} />
            <SectionField label="Water Supply" value={det.waterSupply} />
            <SectionField label="Road Width" value={det.roadWidth} />
          </Section>

          {(isApartmentLike || isPlotLike || type === "commercial" || type === "coworking" || type === "industrial") && (
            <Section title={`${formatPropertyType(type)} Details`} icon={<Building2 className="h-4 w-4 text-indigo-500" />}>
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
                <SectionField label="Utilities Provided" value={det.utilitiesProvided} />
                <SectionField label="Neighborhood" value={det.neighborhoodHighlights} />
                <SectionField label="Community Facilities" value={det.communityFacilities} />
                <SectionField label="Amenity Notes" value={det.amenities} />
              </>)}
              {isPlotLike && (<>
                <SectionField label="Plot Size (Cents)" value={det.plotSizeCents} />
                <SectionField label="Plot Nos" value={det.plotNos} />
                <SectionField label="Zoning" value={det.zoning} />
                <SectionField label="Plot Type" value={det.plotType} />
                <SectionField label="SF Number" value={det.sfNumber} />
                <SectionField label="Land Type" value={det.landType} />
                <SectionField label="Topography" value={det.topography} />
                <SectionField label="Soil Type" value={det.soilType} />
                <SectionField label="Irrigation" value={det.irrigation} />
                <SectionField label="Fencing" value={det.fencing} />
                <SectionField label="Boundary Wall" value={bool(det.boundaryWall)} />
                <SectionField label="Plot Length" value={det.plotLength} />
                <SectionField label="Plot Width" value={det.plotWidth} />
                <SectionField label="Water Sources" value={det.waterSources} />
                <SectionField label="Crop Suitability" value={det.cropSuitability} />
                <SectionField label="Existing Plantation" value={det.existingPlantation} />
                <SectionField label="Bore Well" value={bool(det.boreWell)} />
                <SectionField label="Storage Tank" value={bool(det.storageTank)} />
              </>)}
              {type === "commercial" && (<>
                <SectionField label="Property Use" value={det.propertyUse} />
                <SectionField label="No. of Lifts" value={det.noOfLifts} />
                <SectionField label="Dimension" value={det.dimension} />
                <SectionField label="Frontage" value={det.frontage} />
                <SectionField label="Floors Occupied" value={Array.isArray(det.floorsOccupied) ? det.floorsOccupied.join(", ") : det.floorsOccupied} />
                <SectionField label="Visitors Parking" value={det.visitorsParking} />
                <SectionField label="Outside Parking" value={bool(det.outsideParking)} />
                <SectionField label="Fire Safety" value={bool(det.fireSafety)} />
                <SectionField label="Ceiling Height" value={det.ceilingHeightFt} />
                <SectionField label="Electricity" value={det.electricityConnection} />
                <SectionField label="Central AC" value={bool(det.hasCentralAc)} />
                <SectionField label="Pantry" value={bool(det.hasPantry)} />
                <SectionField label="Conference Rooms" value={det.conferenceRoom} />
                <SectionField label="Seater" value={det.seater} />
                <SectionField label="Tenant Mix" value={det.tenantMix} />
              </>)}
              {type === "coworking" && (<>
                <SectionField label="Workstations" value={det.availableWorkstations} />
                <SectionField label="Private Cabins" value={det.privateCabins} />
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
                <SectionField label="Building Type" value={det.buildingType} />
                <SectionField label="Property Use" value={det.propertyUse} />
                <SectionField label="Covered Area" value={det.coveredArea} />
                <SectionField label="Open Area" value={det.openArea} />
                <SectionField label="Ceiling Height" value={det.ceilingHeightFt} />
                <SectionField label="Floor Type" value={det.floorType} />
                <SectionField label="No. of Bays" value={det.numberOfBays} />
                <SectionField label="No. of Cabins" value={det.numberOfCabins} />
                <SectionField label="Power Supply (HP)" value={det.powerSupplyHp} />
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
              </>)}
            </Section>
          )}
        </div>

        {/* Amenities + Connectivity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Amenities" icon={<Sparkles className="h-4 w-4 text-yellow-500" />}>
            {amenitiesList.length === 0 ? (
              <p className="text-sm text-muted-foreground italic sm:col-span-2">No amenities tagged.</p>
            ) : (
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                {amenitiesList.map((a: any, i: number) => (
                  <Badge key={a.id ?? i} variant="outline" className="font-medium">
                    {a.name || `Amenity #${a.id}`}
                  </Badge>
                ))}
              </div>
            )}
          </Section>

          <Section title="Connectivity" icon={<Map className="h-4 w-4 text-sky-500" />}>
            {connectivity.length === 0 ? (
              <p className="text-sm text-muted-foreground italic sm:col-span-2">No connectivity highlights.</p>
            ) : (
              connectivity.map((c: any, i: number) => (
                <SectionField key={i} label={c.label || c.icon || `Point ${i + 1}`} value={c.detail} />
              ))
            )}
          </Section>
        </div>

        {/* Room Dimensions + Units */}
        {(roomDimensions.length > 0 || units.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roomDimensions.length > 0 && (
              <Section title="Room Dimensions" icon={<Layers className="h-4 w-4 text-cyan-500" />}>
                {roomDimensions.map((r: any, i: number) => (
                  <SectionField key={i} label={r.name || `Room ${i + 1}`} value={r.dimensions} />
                ))}
              </Section>
            )}
            {units.length > 0 && (
              <Section title="Units" icon={<Building2 className="h-4 w-4 text-indigo-500" />}>
                {units.map((u: any, i: number) => (
                  <SectionField
                    key={u.id ?? i}
                    label={u.title || u.unitType || `Unit ${i + 1}`}
                    value={[u.unitType, u.price ? formatPrice(Number(u.price)) : null, u.status].filter(Boolean).join(" · ")}
                  />
                ))}
              </Section>
            )}
          </div>
        )}

        {/* Verification + Market */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Documents & Verification" icon={<ShieldCheck className="h-4 w-4 text-green-600" />}>
            <SectionField label="Ownership Title" value={property.ownershipTitleVerified} />
            <SectionField label="Encumbrance Cert." value={property.encumbranceCertificate} />
            <SectionField label="Rental Agreement" value={property.rentalAgreementDraft} />
            <SectionField label="TSLR / FMB" value={property.tslrFmb} />
            <SectionField label="Tax Receipt" value={property.taxReceipt} />
            <SectionField label="EB Receipt" value={property.ebReceipt} />
            <SectionField label="Patta / Chitta" value={property.pattaChitta} />
            <SectionField label="Approvals" value={property.approvals} />
            <SectionField label="Finance Facing" value={property.financeFacing} />
            <SectionField label="Hypothecation" value={property.hypothecation} />
            <SectionField label="Deviation" value={property.deviation} />
          </Section>

          <Section title="Market Analysis" icon={<TrendingUp className="h-4 w-4 text-rose-500" />}>
            <SectionField label="Comparative Price" value={property.comparativePrice} />
            <SectionField label="Rental Yield" value={property.rentalYield} />
            <SectionField label="Market Price" value={property.marketPrice} />
            <SectionField label="Demand Area" value={property.demandArea} />
            <div className="sm:col-span-2">
              <SectionField label="Remark" value={property.remark} />
            </div>
          </Section>
        </div>

        {/* Description */}
        {property.description && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" /> Description
            </h3>
            <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
              {property.description}
            </p>
          </div>
        )}

        {/* FAQs */}
        {faqs.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-violet-500" /> FAQs
            </h3>
            <div className="space-y-3">
              {faqs.map((f: any, i: number) => (
                <div key={i} className="border border-border/40 rounded-xl p-4">
                  <p className="font-semibold text-[14px]">Q: {f.question}</p>
                  <p className="text-[14px] text-muted-foreground mt-1">A: {f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-pink-500" /> Images
          </h3>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No images uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img: any, idx: number) => (
                <a
                  key={img.id ?? idx}
                  href={img.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative aspect-video border rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img src={img.imageUrl} alt={`Property image ${idx + 1}`} className="w-full h-full object-cover" />
                  {img.isPrimary && (
                    <span className="absolute top-1.5 left-1.5 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        {documents.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" /> Documents
            </h3>
            <div className="space-y-2">
              {documents.map((doc: any, idx: number) => (
                <a
                  key={doc.id ?? idx}
                  href={doc.fileUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 p-3 border rounded-xl bg-muted/10 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.fileName || doc.title || "Document"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{(doc.documentType || "other").replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-[#0052FF] shrink-0">View</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" /> Meta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <SectionField label="ID" value={property.id} />
            <SectionField label="Slug" value={property.slug} />
            <SectionField label="Verification" value={property.verificationStatus} />
            <SectionField label="Approval" value={property.approvalStatus} />
            <SectionField label="Created At" value={formatDate(property.createdAt)} />
            <SectionField label="Updated At" value={formatDate(property.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}
