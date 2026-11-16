"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const EVERY_MS = 2 * 60_000;

export type WaitingLeads = { count: number; overdue: number };

/**
 * Leads the viewer can see that wait for their owner's first contact, for the
 * Leads badge: staff count their own, team leads their pipeline, managers
 * and admins everyone's. Refreshes every two minutes and when the tab returns.
 */
export function useWaitingLeads(enabled = true): WaitingLeads | null {
  const [state, setState] = useState<WaitingLeads | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await apiFetch(`${API_URL}/leads/waiting-count`);
        const body = await res.json();
        if (live && body?.success) setState({ count: Number(body.data?.count) || 0, overdue: Number(body.data?.overdue) || 0 });
      } catch {
        // A badge that misses one refresh is fine.
      }
    };
    void load();
    const timer = setInterval(load, EVERY_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  return state;
}

/** "12" or "99+". */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n));
