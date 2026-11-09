"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserForm } from "../_components/UserForm";

/** /users/new opens the new-user form; old ?edit= links go to the user's page, where they're edited. */
function NewUser() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  useEffect(() => { if (editId) router.replace(`/users/${editId}`); }, [editId, router]);
  if (editId) return null;
  return <UserForm onClose={() => router.push("/users")} onCreated={(id) => router.push(`/users/${id}`)} />;
}

export default function NewUserPage() {
  return <Suspense fallback={null}><NewUser /></Suspense>;
}
