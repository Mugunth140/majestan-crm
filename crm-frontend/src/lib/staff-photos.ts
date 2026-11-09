"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api-fetch";

// Staff photos for anywhere a staff name shows (assignees, activity,
// conversation): fetched once per page load, then shared by every avatar.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Photo = { id: number; name: string; avatar_url: string };
type Directory = { byId: Map<number, string>; byName: Map<string, string> };

const EMPTY: Directory = { byId: new Map(), byName: new Map() };
let directory = EMPTY;
let request: Promise<void> | null = null;
let loadedAt = 0;
// Someone may pick a photo while this tab stays open: look again after this long.
const STALE_MS = 2 * 60_000;
const listeners = new Set<() => void>();

const nameKey = (name: string) => name.trim().toLowerCase();

function load() {
  if (request && loadedAt && Date.now() - loadedAt > STALE_MS) request = null;
  request ??= apiFetch(`${API_URL}/users/photos`)
    .then((r) => r.json())
    .then((d) => {
      const photos: Photo[] = d?.success && Array.isArray(d.data) ? d.data : [];
      directory = {
        byId: new Map(photos.map((p) => [p.id, p.avatar_url])),
        byName: new Map(photos.map((p) => [nameKey(p.name), p.avatar_url])),
      };
      loadedAt = Date.now();
      listeners.forEach((l) => l());
    })
    // Offline or signed out: letters stand in, and the next page load tries again.
    .catch(() => { request = null; });
  return request;
}

/** Fetch again, e.g. after someone changes their photo. */
export function refreshStaffPhotos() {
  request = null;
  void load();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  void load();
  // The signed-in user changed their own photo.
  if (listeners.size === 1) {
    window.addEventListener("crm-user-updated", refreshStaffPhotos);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.removeEventListener("crm-user-updated", refreshStaffPhotos);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** A staff member's photo URL, by user id or else by name; null when they have none. */
export function useStaffPhoto(name?: string | null, userId?: number | null, enabled = true): string | null {
  const dir = useSyncExternalStore(enabled ? subscribe : noop, () => directory, () => EMPTY);
  if (!enabled) return null;
  return (userId != null ? dir.byId.get(userId) : undefined) ?? (name ? dir.byName.get(nameKey(name)) : undefined) ?? null;
}

const noop = () => () => {};

// Back on the tab after a while: pick up photos changed elsewhere.
function onVisible() {
  if (document.visibilityState === "visible") void load();
}
