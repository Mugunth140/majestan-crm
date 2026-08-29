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
  BedDouble,
  Bath,
  Ruler,
  User,
  Phone,
  Mail,
  Image as ImageIcon,
  FileText,
  Calendar,
  Hash,
} from "lucide-react";

function PageSkeleton() {
  return (
    <div className="animate-in fade-in duration-500 flex flex-col space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}

function SectionField({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground text-xs font-bold uppercase tracking-wide flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-medium text-[14px] text-foreground">
        {String(value)}
      </span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
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
  const statusBadgeClass = STATUS_BADGE[statusKey] ?? STATUS_BADGE["unavailable"];

  return (
    <div className="flex flex-col md:h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <MobileHeader title={property.title || `Property #${property.id}`} showBack />

      {/* ── Desktop Header ── */}
      <div className="hidden md:flex items-center justify-between pr-[150px] min-h-[48px] mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full shrink-0"
            onClick={() => router.push("/properties")}
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {property.title || `Property #${property.id}`}
            </h1>
            <Badge
              variant="outline"
              className={`font-semibold border capitalize ${statusBadgeClass}`}
            >
              {property.status}
            </Badge>
          </div>
        </div>
        <Button
          onClick={() => router.push(`/properties/${property.id}/edit`)}
          className="rounded-full px-8 py-5 bg-[#0052FF] text-white hover:bg-[#0040CC] shadow-md"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Property
        </Button>
      </div>

      {/* ── Mobile action bar ── */}
      <div className="md:hidden flex gap-3 px-4 pb-4">
        <Button
          onClick={() => router.push(`/properties/${property.id}/edit`)}
          className="flex-1 h-11 rounded-xl bg-[#0052FF] text-white"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-4 lg:px-0 lg:pr-2">

        {/* ── Basic + Pricing ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Basic Info" icon={<Home className="h-4 w-4 text-[#0052FF]" />}>
            <SectionField label="Title" value={property.title} />
            <SectionField
              label="Property Type"
              value={formatPropertyType(property.propertyType)}
            />
            <SectionField
              label="Listing Type"
              value={property.listingType === "Sell" ? "Buy" : property.listingType}
            />
            <SectionField label="Status" value={property.status} />
            <SectionField label="Price" value={formatPrice(property.price)} />
            {property.negotiable && (
              <SectionField label="Negotiable" value="Yes" />
            )}
          </Section>

          <Section title="Location" icon={<MapPin className="h-4 w-4 text-orange-500" />}>
            <SectionField label="City" value={property.city} />
            <SectionField label="Locality" value={property.locality} />
          </Section>
        </div>

        {/* ── Details + Owner ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Details" icon={<Ruler className="h-4 w-4 text-purple-500" />}>
            <SectionField
              label="Bedrooms"
              value={property.bedrooms}
              icon={<BedDouble className="h-3 w-3" />}
            />
            <SectionField
              label="Bathrooms"
              value={property.bathrooms}
              icon={<Bath className="h-3 w-3" />}
            />
            <SectionField
              label="Area (sq ft)"
              value={property.areaSqft}
              icon={<Ruler className="h-3 w-3" />}
            />
          </Section>

          <Section title="Owner" icon={<User className="h-4 w-4 text-teal-500" />}>
            <SectionField
              label="Name"
              value={property.ownerName}
              icon={<User className="h-3 w-3" />}
            />
            <SectionField
              label="Phone"
              value={property.ownerPhone}
              icon={<Phone className="h-3 w-3" />}
            />
            <SectionField
              label="Email"
              value={property.ownerEmail}
              icon={<Mail className="h-3 w-3" />}
            />
          </Section>
        </div>

        {/* ── Description ── */}
        {property.description && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Description
            </h3>
            <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
              {property.description}
            </p>
          </div>
        )}

        {/* ── Images ── */}
        {property.images && property.images.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-pink-500" />
              Images
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {property.images.map((img: any, idx: number) => (
                <a
                  key={img.id ?? idx}
                  href={img.imageUrl ?? img.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block relative aspect-video border rounded-xl overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img
                    src={img.imageUrl ?? img.file_url}
                    alt={`Property image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {img.isPrimary && (
                    <span className="absolute top-1.5 left-1.5 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Meta ── */}
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-foreground border-b pb-3 mb-4 flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Meta
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <SectionField label="ID" value={property.id} icon={<Hash className="h-3 w-3" />} />
            <SectionField
              label="Created At"
              value={
                property.createdAt
                  ? new Date(property.createdAt).toLocaleString()
                  : undefined
              }
              icon={<Calendar className="h-3 w-3" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
