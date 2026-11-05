"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BuilderForm } from "../_components/BuilderForm";

function BuilderFormLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
    </div>
  );
}

function BuilderFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Old "?edit=" links: builders are edited on their own page now.
  const editId = searchParams.get("edit");

  useEffect(() => {
    if (editId) router.replace(`/builders/${editId}`);
  }, [editId, router]);

  if (editId) return <BuilderFormLoader />;
  return <BuilderForm />;
}

export default function NewBuilderPage() {
  return (
    <Suspense fallback={<BuilderFormLoader />}>
      <BuilderFormPage />
    </Suspense>
  );
}
