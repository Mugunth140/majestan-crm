"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetForm } from "../_components/AssetForm";

/** /asset-inventory/new opens the new-asset form; old ?edit= links go to the asset's page, where it's edited. */
function NewAsset() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  useEffect(() => { if (editId) router.replace(`/asset-inventory/${editId}`); }, [editId, router]);
  if (editId) return null;
  return <AssetForm onClose={() => router.push("/asset-inventory")} onCreated={(id) => router.push(`/asset-inventory/${id}`)} />;
}

export default function NewAssetPage() {
  return <Suspense fallback={null}><NewAsset /></Suspense>;
}
