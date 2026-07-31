"use client";

import { useSyncExternalStore } from "react";

export type DeviceType = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsDesktop(): boolean {
  return !useIsMobile();
}

export function useDevice() {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isMobile,
    isDesktop: !isMobile,
    type: (isMobile ? "mobile" : "desktop") as DeviceType,
  };
}
