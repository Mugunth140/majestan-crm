"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-device";
import { NewInboundModal, showQueueNext } from "@/components/inbound/new-inbound-modal";

function NewInbound() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const editId = useSearchParams().get("edit");

  // Editing happens on the inbound's own page now; old links land there.
  useEffect(() => {
    if (editId) router.replace(`/inbound/${editId}`);
  }, [editId, router]);
  if (editId) return null;

  return (
    <NewInboundModal
      open
      quick={isMobile}
      onOpenChange={(open) => { if (!open) router.push("/inbound"); }}
      onCreated={(id) => {
        if (isMobile) {
          showQueueNext();
          router.push("/inbound");
        } else router.push(id ? `/inbound/${id}` : "/inbound");
      }}
    />
  );
}

export default function NewInboundPage() {
  return (
    <Suspense fallback={null}>
      <NewInbound />
    </Suspense>
  );
}
