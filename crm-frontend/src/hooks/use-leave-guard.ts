"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setLeaveGuard } from "@/lib/leave-guard";

/** The in-app destination of a click, or null when it isn't one to guard. */
function guardedHref(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search + url.hash;
}

/**
 * Ask before leaving a page with unsaved work. While `isDirty()` is true:
 * in-app link clicks (sidebar, breadcrumbs…) and guardNavigation() calls are
 * held as `pendingLeave` for the page to confirm in its own dialog, and
 * closing / reloading the tab shows the browser's native prompt.
 * The browser back/forward buttons are not intercepted.
 */
export function useLeaveGuard(isDirty: () => boolean) {
  const router = useRouter();
  const dirtyRef = useRef(isDirty);
  useEffect(() => {
    dirtyRef.current = isDirty;
  });
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    const unregister = setLeaveGuard((proceed) => {
      if (!dirtyRef.current()) return false;
      setPendingLeave(() => proceed);
      return true;
    });
    // Capture phase on document runs before React's (and Next Link's) handlers.
    const onClick = (e: MouseEvent) => {
      const href = guardedHref(e);
      if (!href || !dirtyRef.current()) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingLeave(() => () => router.push(href));
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unregister();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [router]);

  const cancelLeave = useCallback(() => setPendingLeave(null), []);
  /** Run the held navigation (after saving or discarding). */
  const confirmLeave = useCallback(() => {
    setPendingLeave((proceed) => {
      if (proceed) setTimeout(proceed, 0);
      return null;
    });
  }, []);

  return { pendingLeave, cancelLeave, confirmLeave };
}
