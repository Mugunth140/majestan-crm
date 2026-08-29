"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { propertiesApi } from "@/lib/properties-api";
import { PropertyForm } from "../../_components/PropertyForm";

export default function EditPropertyPage() {
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
      router.push("/properties");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading property data...</p>
        </div>
      </div>
    );
  }

  if (!property) return null;

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Edit Property</h1>
        <p className="text-muted-foreground">Update the details for this property listing</p>
      </div>
      <PropertyForm mode="edit" initialData={property} />
    </div>
  );
}
