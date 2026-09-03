"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { propertiesApi } from "@/lib/properties-api";
import { PropertyForm } from "../_components/PropertyForm";

function PropertyFormLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
        <p className="text-muted-foreground font-medium">Loading property data...</p>
      </div>
    </div>
  );
}

function PropertyFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");

  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    setIsLoading(true);
    propertiesApi
      .getOne(Number(editId))
      .then((result) => {
        if (result && result.success !== false) {
          setInitialData(result.data ?? result);
        } else {
          toast.error("Property not found.");
          router.push("/properties");
        }
      })
      .catch(() => {
        toast.error("Failed to load property.");
        router.push("/properties");
      })
      .finally(() => setIsLoading(false));
  }, [editId, router]);

  if (isLoading) return <PropertyFormLoader />;
  if (editId && !initialData) return null;

  return <PropertyForm mode={editId ? "edit" : "create"} initialData={initialData ?? undefined} />;
}

export default function NewPropertyPage() {
  return (
    <Suspense fallback={<PropertyFormLoader />}>
      <PropertyFormPage />
    </Suspense>
  );
}
