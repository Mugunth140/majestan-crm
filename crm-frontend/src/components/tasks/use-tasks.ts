"use client";
import { useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api-fetch";

export const TASKS_API = `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/tasks`;

/** Progress is counted live from calls and CRM activity, so pages poll for it. */
const REFRESH_MS = 60_000;

type Envelope<T> = { success: boolean; data: T; message?: string; error?: string };

export type Live<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  updatedAt: number | null;
  reload: () => void;
};

/**
 * Fetch a Tasks endpoint and keep it fresh: every minute while the tab is
 * visible, and as soon as the tab comes back into view. A failed refresh keeps
 * the last good data on screen.
 */
export function useLive<T>(url: string | null, { poll = true }: { poll?: boolean } = {}): Live<T> {
  const [state, setState] = useState<Omit<Live<T>, "reload"> & { url: string | null }>({
    data: null, error: null, loading: true, refreshing: false, updatedAt: null, url: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      setState((s) => (s.url === url ? { ...s, refreshing: true } : { ...s, loading: true, refreshing: false, error: null }));
    });
    apiJson<Envelope<T>>(url, { signal: ctrl.signal })
      .then((r) => {
        if (ctrl.signal.aborted) return;
        setState((s) => r.success
          ? { data: r.data, error: null, loading: false, refreshing: false, updatedAt: Date.now(), url }
          : { ...s, error: r.message ?? r.error ?? "Could not load targets", loading: false, refreshing: false });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setState((s) => ({ ...s, error: e.message, loading: false, refreshing: false }));
      });
    return () => ctrl.abort();
  }, [url, nonce]);

  useEffect(() => {
    if (!poll || !url) return;
    const tick = () => { if (document.visibilityState === "visible") reload(); };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll, url, reload]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    refreshing: state.refreshing,
    updatedAt: state.updatedAt,
    reload,
  };
}

/** POST/PATCH/DELETE to a Tasks endpoint; throws with the server's message. */
export async function send<T = unknown>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const r = await apiJson<Envelope<T>>(`${TASKS_API}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r?.success) throw new Error(r?.message ?? r?.error ?? "Something went wrong");
  return r.data;
}

/** "just now", "3 min ago". */
export function useAgo(at: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  if (!at) return null;
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 45 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}
