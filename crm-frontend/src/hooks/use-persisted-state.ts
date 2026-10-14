"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

// Remembers list-page UI state (tabs, toggles, filters, search, page) so staff
// who open a record and come back land where they were. sessionStorage: it
// survives reloads and in-app navigation but stays scoped to the browser tab,
// so a fresh tab starts clean. Keys are per user so a different login in the
// same tab never inherits someone else's filters.
//
// Reads happen in the useState initializer, which is only safe because the
// dashboard layout mounts pages client-side (see useIsClient there) — on the
// server there is no stored value and the markup would not match.

const PREFIX = "crm_view";

function currentUserId(): string {
  try {
    const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
    return user?.id != null ? String(user.id) : "anon";
  } catch {
    return "anon";
  }
}

export function persistedStateKey(key: string, userId: string = currentUserId()): string {
  return `${PREFIX}:${userId}:${key}`;
}

export interface PersistedStateOptions<T> {
  /** Restrict a restored value to these (e.g. a tab list), so a renamed tab can't stick. */
  allowed?: readonly T[];
  /** Turn the stored JSON back into T; return undefined to fall back to the initial value. */
  deserialize?: (raw: unknown) => T | undefined;
}

// Default restore rules: a primitive must keep its type; a plain object is
// merged key by key onto the initial value so added/removed fields and stale
// shapes degrade to defaults instead of crashing the page.
export function reviveValue<T>(raw: unknown, initial: T, options: PersistedStateOptions<T> = {}): T {
  if (raw === undefined) return initial;
  if (options.deserialize) return options.deserialize(raw) ?? initial;
  if (options.allowed) return options.allowed.includes(raw as T) ? (raw as T) : initial;
  if (initial === null || initial === undefined) return raw as T;
  if (Array.isArray(initial)) return Array.isArray(raw) ? (raw as T) : initial;
  if (typeof initial === "object") {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return initial;
    const merged: Record<string, unknown> = { ...(initial as Record<string, unknown>) };
    for (const [k, def] of Object.entries(initial as Record<string, unknown>)) {
      const v = (raw as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (Array.isArray(def) ? Array.isArray(v) : typeof v === typeof def) merged[k] = v;
    }
    return merged as T;
  }
  return typeof raw === typeof initial ? (raw as T) : initial;
}

function read(storageKey: string): unknown {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined; // storage blocked or corrupt entry
  }
}

function write(storageKey: string, value: unknown) {
  try {
    if (value === undefined) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Non-fatal: the page just won't remember its place.
  }
}

export function usePersistedState<T>(
  key: string,
  initial: T,
  options?: PersistedStateOptions<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [storageKey] = useState(() => (typeof window === "undefined" ? "" : persistedStateKey(key)));
  const [value, setValue] = useState<T>(() =>
    storageKey ? reviveValue(read(storageKey), initial, options) : initial,
  );
  useEffect(() => {
    if (storageKey) write(storageKey, value);
  }, [storageKey, value]);
  return [value, setValue];
}

/**
 * A restored server-side page can point past the end once records are closed or
 * reassigned elsewhere; once the fetch settles, step back to the last real page.
 */
export function useClampedPage(
  pagination: { pageIndex: number; pageSize: number },
  setPagination: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>,
  totalCount: number,
  isLoading: boolean,
) {
  useEffect(() => {
    if (isLoading) return;
    const lastPage = Math.max(0, Math.ceil(totalCount / pagination.pageSize) - 1);
    if (pagination.pageIndex > lastPage) setPagination((p) => ({ ...p, pageIndex: lastPage }));
  }, [isLoading, totalCount, pagination.pageIndex, pagination.pageSize, setPagination]);
}
