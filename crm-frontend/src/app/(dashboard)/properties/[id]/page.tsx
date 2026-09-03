"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeader } from "@/components/layout/mobile-header";
import { propertiesApi } from "@/lib/properties-api";
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
  const images: any[] = property.propertyImages ?? [];
  const loc = (property.propertyLocations ?? [])[0] ?? {};
  const mapsUrl = loc.latitude && loc.longitude
    ? `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
    : null;

  const bool = (v: any) => (v === true || v === 1 || v === "1" ? "Yes" : v === false || v === 0 || v === "0" ? "No" : v);

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

        {/* Core Details & Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <Home className="h-4 w-4 text-[#0052FF]" /> Core Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Property Code" value={property.propertyCode} />
              <SectionField label="Property Type" value={formatPropertyType(property.propertyType)} />
              <SectionField label="Listing Type" value={property.listingType === "Sell" ? "Buy" : property.listingType} />
              <SectionField label="Status" value={property.status} />
              <SectionField label="Price" value={formatPrice(Number(property.price))} />
              <SectionField label="Negotiable" value={bool(property.negotiable)} />
              <SectionField label="Transaction Type" value={property.transactionType} />
              <SectionField label="Sale Type" value={property.saleType} />
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" /> Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="City" value={property.city} />
              <SectionField label="State" value={property.state} />
              <div className="sm:col-span-2">
                <SectionField label="Address" value={loc.address} />
              </div>
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
            </div>
          </div>
        </div>

        {/* Specs & Owner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-purple-500" /> Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Bedrooms" value={det.bedrooms} />
              <SectionField label="Bathrooms" value={det.bathrooms} />
              <SectionField label="Area (sq ft)" value={det.areaSqft} />
              <SectionField label="Furnished" value={bool(det.furnished)} />
              <SectionField label="Furnishing Status" value={det.furnishingStatus} />
              <SectionField label="Facing" value={det.propertyFacing} />
              <SectionField label="Property Age" value={det.propertyAge} />
              <SectionField label="Floor No" value={det.floorNumber} />
              <SectionField label="Total Floors" value={det.totalFloors} />
              <SectionField label="Built-up Area" value={det.builtUpArea} />
              <SectionField label="Carpet Area" value={det.carpetArea} />
              <SectionField label="Plot Area" value={det.plotArea} />
              <SectionField label="Balconies" value={det.balconies} />
              <SectionField label="Car Parking" value={det.carParking} />
              <SectionField label="Bike Parking" value={det.bikeParking} />
              <SectionField label="Power Backup" value={bool(det.powerBackup)} />
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-teal-500" /> Owner & Agent
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <SectionField label="Owner Name" value={property.ownerName} />
              <SectionField label="Owner Phone" value={property.ownerPhone} />
              <SectionField label="Owner Email" value={property.ownerEmail} />
              <SectionField label="Agent Name" value={property.agentName} />
              <SectionField label="Agency" value={property.agencyName} />
              <SectionField label="Alternate Contact" value={property.alternateName || property.alternatePhone} />
            </div>
          </div>
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

        {/* Meta */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" /> Meta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <SectionField label="ID" value={property.id} />
            <SectionField label="Slug" value={property.slug} />
            <SectionField
              label="Created At"
              value={property.createdAt ? new Date(property.createdAt).toLocaleDateString("en-GB") : undefined}
            />
            <SectionField
              label="Updated At"
              value={property.updatedAt ? new Date(property.updatedAt).toLocaleDateString("en-GB") : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
