"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { adsApi, type Advertisement } from "@/lib/ads-api";
import { AdForm } from "../_components/AdForm";

function AdFormLoader() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4" role="status" aria-label="Loading advertisement">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl border bg-muted/50" />
      <span className="sr-only">Loading advertisement data</span>
    </div>
  );
}

function AdFormPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const placementParam = searchParams.get("placement") ?? undefined;

  return <AdFormContent key={`${editId ?? "new"}:${placementParam ?? "hero"}`} editId={editId} placementParam={placementParam} />;
}

function AdFormContent({ editId, placementParam }: { editId: string | null; placementParam?: string }) {
  const [initialData, setInitialData] = useState<Advertisement | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (editId === null) return;
    let cancelled = false;
    if (!/^\d+$/.test(editId) || !Number.isSafeInteger(Number(editId)) || Number(editId) <= 0) return;
    adsApi.getOne(Number(editId))
      .then((result) => {
        if (cancelled) return;
        const ad = result?.data ?? result;
        if (result?.success === false || Number(ad?.id) !== Number(editId)) throw new Error("Advertisement not found.");
        setInitialData(ad);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load advertisement.");
      })
      .finally(() => { if (!cancelled) setLoadedId(editId); });
    return () => { cancelled = true; };
  }, [editId]);

  const invalidId = editId !== null && (!/^\d+$/.test(editId) || !Number.isSafeInteger(Number(editId)) || Number(editId) <= 0);
  if (invalidId || (editId !== null && loadedId === editId && loadError)) return (
    <div role="alert" className="mx-auto max-w-3xl space-y-4 rounded-xl border p-8">
      <h1 className="text-xl font-semibold">Could not open advertisement</h1>
      <p className="text-sm text-muted-foreground">{invalidId ? "This advertisement link is invalid." : loadError}</p>
      <Link href="/ads" className="inline-block rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">Back to advertisements</Link>
    </div>
  );
  if (editId !== null && loadedId !== editId) return <AdFormLoader />;

  return <AdForm key={editId ?? `new-${placementParam}`} mode={editId !== null ? "edit" : "create"} initial={editId !== null ? initialData ?? undefined : undefined} defaultPlacement={placementParam} />;
}

export default function NewAdPage() {
  return (
    <Suspense fallback={<AdFormLoader />}>
      <AdFormPage />
    </Suspense>
  );
}
