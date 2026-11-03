"use client";

import { useRouter } from "next/navigation";
import { NewLeadModal } from "@/components/leads/new-lead-modal";

/** A direct link to the new-lead form: the same full-screen form the leads list opens. */
export default function NewLeadPage() {
  const router = useRouter();
  return (
    <NewLeadModal
      open
      onOpenChange={(open) => { if (!open) router.push("/leads"); }}
      onCreated={(id, toQueue) => router.push(toQueue ? "/lead-routing" : id ? `/leads/${id}` : "/leads")}
    />
  );
}
