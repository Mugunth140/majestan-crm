"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// What staff type in a composer, kept for this browser tab (sessionStorage), so
// switching composer, lead tab or page and coming back still shows it. A draft
// equal to the empty value is removed; a sent message clears it by resetting.

const PREFIX = "crm-draft:";

function read<T>(key: string): T | undefined {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown, empty: string) {
  try {
    const json = JSON.stringify(value);
    if (json === empty) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, json);
  } catch {
    // Private mode or storage full: the draft just isn't kept.
  }
}

/** Reads a saved draft without keeping one (e.g. to decide what to open). */
export const peekDraft = <T,>(key: string): T | undefined =>
  typeof window === "undefined" ? undefined : read<T>(key);

/** Keeps a draft written outside useDraft (null or undefined removes it). */
export const saveDraft = (key: string, value: unknown) => {
  if (value == null) return clearDraft(key);
  write(key, value, "null");
};

export const clearDraft = (key: string) => {
  try { window.sessionStorage.removeItem(PREFIX + key); } catch { /* nothing kept */ }
};

/**
 * useState that survives the component unmounting. `key` names the draft
 * (include the record, e.g. "followup:leads:42"); null keeps nothing.
 */
export function useDraft<T>(key: string | null, empty: T) {
  const emptyJson = useRef(JSON.stringify(empty));
  const [value, setValue] = useState<T>(() => (key && typeof window !== "undefined" ? read<T>(key) : undefined) ?? empty);
  useEffect(() => {
    if (key) write(key, value, emptyJson.current);
  }, [key, value]);
  const reset = useCallback(() => setValue(JSON.parse(emptyJson.current) as T), []);
  return [value, setValue, reset] as const;
}
