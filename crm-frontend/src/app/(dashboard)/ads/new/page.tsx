"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adsApi } from "@/lib/ads-api";
import { AdForm } from "../_components/AdForm";

function AdFormLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
        <p className="text-muted-foreground font-medium">Loading ad data...</p>
      </div>
    </div>
  );
}

function AdFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");

  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    setIsLoading(true);
    adsApi
      .getOne(Number(editId))
      .then((result) => {
        if (result && result.success !== false) {
          setInitialData(result.data ?? result);
        } else {
          toast.error("Ad not found.");
          router.push("/ads");
        }
      })
      .catch(() => {
        toast.error("Failed to load ad.");
        router.push("/ads");
      })
      .finally(() => setIsLoading(false));
  }, [editId, router]);

  if (isLoading) return <AdFormLoader />;
  if (editId && !initialData) return null;

  return <AdForm mode={editId ? "edit" : "create"} initial={initialData ?? undefined} />;
}

export default function NewAdPage() {
  return (
    <Suspense fallback={<AdFormLoader />}>
      <AdFormPage />
    </Suspense>
  );
}
