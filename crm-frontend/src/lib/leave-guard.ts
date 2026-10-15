// leave-guard.ts
// One page at a time can hold unsaved work (e.g. a property being edited).
// It registers a guard here; navigation that isn't a plain link click — the
// mobile header's back button, for one — goes through guardNavigation() so
// the page can ask before leaving. Link clicks are caught by useLeaveGuard.

type Guard = (proceed: () => void) => boolean; // true = intercepted

let active: Guard | null = null;

export function setLeaveGuard(guard: Guard): () => void {
  active = guard;
  return () => {
    if (active === guard) active = null;
  };
}

/** Run `proceed` now, or hand it to the page's guard to run after the user decides. */
export function guardNavigation(proceed: () => void): void {
  if (active && active(proceed)) return;
  proceed();
}
