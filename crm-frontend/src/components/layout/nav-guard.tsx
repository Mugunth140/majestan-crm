"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiJson } from "@/lib/api-fetch";
import { useNavViewer } from "@/hooks/use-nav-viewer";
import { EmptyState } from "@/components/shared/empty-state";
import { FOCUS_BUTTON } from "@/components/shared/focus-modal";
import { canOpen } from "./nav-items";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
// What an admin can change on someone after they signed in.
const LIVE_FIELDS = ["name", "role", "department", "department_id", "permissions", "nav_access"] as const;

/** Re-reads the signed-in user, so access an admin changed applies without signing in again. */
async function refreshUser() {
  const me = await apiJson<{ success?: boolean; data?: Record<string, unknown> }>(`${API_URL}/auth/me`).catch(() => null);
  if (!me?.success || !me.data) return;
  const stored = JSON.parse(localStorage.getItem("crm_user") || "{}");
  const next = { ...stored };
  for (const k of LIVE_FIELDS) if (k in me.data) next[k] = me.data[k];
  if (JSON.stringify(next) === JSON.stringify(stored)) return;
  localStorage.setItem("crm_user", JSON.stringify(next));
  window.dispatchEvent(new Event("crm-user-updated"));
}

/** Pages of modules hidden from this user show a notice instead, even when opened by link. */
export function NavGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const viewer = useNavViewer();
  useEffect(() => { void refreshUser(); }, []);

  if (viewer && !canOpen(pathname, viewer)) {
    return (
      <EmptyState
        kind="error"
        className="py-24"
        title="No access"
        description="This module isn't turned on for you. Ask an admin if you need it."
        action={<Link href="/" className={FOCUS_BUTTON.secondary}>Go to dashboard</Link>}
      />
    );
  }
  return children;
}
