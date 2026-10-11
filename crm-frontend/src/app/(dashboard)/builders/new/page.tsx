"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildersApi } from "@/lib/builders-api";
import { BuilderForm } from "../_components/BuilderForm";

function BuilderFormLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
        <p className="text-muted-foreground font-medium">Loading builder details...</p>
      </div>
    </div>
  );
}

function BuilderFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");

  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    setIsLoading(true);
    buildersApi
      .getOne(Number(editId))
      .then((result) => {
        if (result && result.success !== false) {
          setInitialData(result.data ?? result);
        } else {
          toast.error("Builder not found.");
          router.push("/builders");
        }
      })
      .catch(() => {
        toast.error("Failed to load builder.");
        router.push("/builders");
      })
      .finally(() => setIsLoading(false));
  }, [editId, router]);

  if (isLoading) return <BuilderFormLoader />;
  if (editId && !initialData) return null;

  return <BuilderForm mode={editId ? "edit" : "create"} initial={initialData ?? undefined} />;
}

export default function NewBuilderPage() {
  return (
    <Suspense fallback={<BuilderFormLoader />}>
      <BuilderFormPage />
    </Suspense>
  );
}
