"use client";

import { useSyncExternalStore } from "react";
import { isAdmin } from "@/lib/permissions";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** Whether the signed-in user is an Admin or Super Admin (false while rendering on the server). */
export const useIsAdmin = () => useSyncExternalStore(subscribe, () => isAdmin(), () => false);
