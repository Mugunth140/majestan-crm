"use client";

import { useEffect, useState } from "react";
import { readUser, type StoredUser } from "@/components/layout/nav-items";

/** The signed-in user for navigation, kept current when their record changes. Null until mounted. */
export function useNavViewer() {
  const [user, setUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    // localStorage is client-only; read after mount, and again on "crm-user-updated".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readUser());
    const reread = () => setUser(readUser());
    window.addEventListener("crm-user-updated", reread);
    return () => window.removeEventListener("crm-user-updated", reread);
  }, []);
  return user;
}
