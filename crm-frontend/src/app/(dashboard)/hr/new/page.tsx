"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CandidateForm } from "../_components/CandidateForm";

/** /hr/new opens the new-candidate form; old ?edit= links go to the candidate's page, where it's edited. */
function NewCandidate() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  useEffect(() => { if (editId) router.replace(`/hr/${editId}`); }, [editId, router]);
  if (editId) return null;
  return <CandidateForm onClose={() => router.push("/hr")} onCreated={(id) => router.push(id ? `/hr/${id}` : "/hr")} />;
}

export default function NewCandidatePage() {
  return <Suspense fallback={null}><NewCandidate /></Suspense>;
}
