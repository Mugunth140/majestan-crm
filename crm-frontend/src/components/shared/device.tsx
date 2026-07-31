"use client";

import type { ReactNode } from "react";
import { useDevice } from "@/hooks/use-device";

interface DeviceProps {
  mobile: ReactNode;
  desktop: ReactNode;
}

/**
 * Renders only the variant matching the current device.
 * Unlike CSS `hidden md:block` swapping, the unused variant is never
 * mounted, so its effects and data fetching are skipped.
 *
 * SSR note: on the server (and first client render) the desktop variant
 * renders; on mobile it swaps to the mobile variant after hydration.
 */
export function Device({ mobile, desktop }: DeviceProps) {
  const { isMobile } = useDevice();
  return isMobile ? mobile : desktop;
}
