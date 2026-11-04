"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewAgentModal } from "@/components/agents/new-agent-modal";

function NewAgent() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");

  // Editing happens on the agent's own page now; old links land there.
  useEffect(() => {
    if (editId) router.replace(`/agent-network/${editId}`);
  }, [editId, router]);
  if (editId) return null;

  return (
    <NewAgentModal
      open
      onOpenChange={(open) => { if (!open) router.push("/agent-network"); }}
      onCreated={(id) => router.push(id ? `/agent-network/${id}` : "/agent-network")}
    />
  );
}

export default function NewAgentPage() {
  return (
    <Suspense fallback={null}>
      <NewAgent />
    </Suspense>
  );
}
