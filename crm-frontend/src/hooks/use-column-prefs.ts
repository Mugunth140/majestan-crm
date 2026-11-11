"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Shown (true) or hidden (false), only for columns the user changed. */
export type ColumnOverrides = Record<string, boolean>;

/** "/leads/123" + "main" → "columns.leads.id.main": one setting per list, not per record. */
export function columnPrefKey(pathname: string, name: string) {
  const path = pathname.split("/").filter(Boolean).map((s) => (/^\d+$/.test(s) ? "id" : s)).join(".");
  return `columns.${path || "home"}.${name}`.replace(/[^\w:.\-]/g, "_").slice(0, 191);
}

function userId() {
  try {
    return String(JSON.parse(localStorage.getItem("crm_user") || "{}")?.id ?? "anon");
  } catch {
    return "anon";
  }
}

const cacheKey = (key: string) => `crm_cols:${userId()}:${key}`;

function readCache(key: string): ColumnOverrides {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(key)) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function writeCache(key: string, value: ColumnOverrides) {
  try {
    if (Object.keys(value).length) localStorage.setItem(cacheKey(key), JSON.stringify(value));
    else localStorage.removeItem(cacheKey(key));
  } catch {
    /* storage full or blocked: the server copy still holds it */
  }
}

/**
 * The columns a user chose for one table. Saved on the server for that user
 * only (so it follows them to other devices), with a local copy so the table
 * opens with their columns straight away.
 */
export function useColumnPrefs(key: string | null) {
  // Keyed by table, so moving to another list starts from that list's columns.
  const [state, setState] = useState(() => ({ key, value: key ? readCache(key) : {} }));
  if (state.key !== key) setState({ key, value: key ? readCache(key) : {} });
  const overrides = state.key === key ? state.value : {};
  const setOverrides = useCallback((value: ColumnOverrides) => setState({ key, value }), [key]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    let live = true;
    apiFetch(`${API_URL}/me/preferences?prefix=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.success) return;
        const saved = d.data?.[key];
        const next = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as ColumnOverrides) : {};
        setOverrides(next);
        writeCache(key, next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, setOverrides]);

  const save = useCallback(
    (next: ColumnOverrides) => {
      if (!key) return;
      setOverrides(next);
      writeCache(key, next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const url = `${API_URL}/me/preferences/${encodeURIComponent(key)}`;
        // An empty value clears the saved choice on the server.
        void apiFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: next }) }).catch(() => {});
      }, 400);
    },
    [key, setOverrides],
  );

  return { overrides, save, reset: useCallback(() => save({}), [save]) };
}
