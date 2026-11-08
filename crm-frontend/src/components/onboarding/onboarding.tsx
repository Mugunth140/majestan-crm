"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { meApi } from "@/lib/me-api";
import { APP_VERSION, RELEASES, compareVersions, releasesSince } from "@/lib/release";
import { readUser } from "@/components/layout/nav-items";
import { TourPlayer, type Step } from "./player";
import { useWelcomeSteps, whatsNewSteps } from "./steps";

/** Fired by Settings, Tour and help to replay the tour without a reload. */
export const OPEN_TOUR_EVENT = "crm:open-tour";
const WELCOME_TOUR = "welcome";

type Mode = { kind: "welcome" } | { kind: "whats-new"; steps: Step[] } | null;

/**
 * Decides on each visit whether to show the welcome tour (first sign-in, or after a reset)
 * or What's new (first visit after an update with new features), and records the outcome.
 */
export function Onboarding() {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    let live = true;
    meApi.onboarding().then((state) => {
      if (!live) return;
      if (!state.welcomed_at) return setMode({ kind: "welcome" });
      const seen = state.last_seen_version;
      if (!seen) return void meApi.updateOnboarding({ last_seen_version: APP_VERSION }).catch(() => {});
      if (compareVersions(seen, APP_VERSION) >= 0) return;
      const steps = whatsNewSteps(releasesSince(seen, RELEASES), readUser()?.role ?? "");
      if (steps.length) setMode({ kind: "whats-new", steps });
      else void meApi.updateOnboarding({ last_seen_version: APP_VERSION }).catch(() => {});
    }).catch(() => { /* offline or signed out: try on the next visit */ });
    const open = () => setMode({ kind: "welcome" });
    window.addEventListener(OPEN_TOUR_EVENT, open);
    return () => { live = false; window.removeEventListener(OPEN_TOUR_EVENT, open); };
  }, []);

  const close = useCallback((how: "done" | "skipped") => {
    const now = new Date().toISOString();
    if (mode?.kind === "welcome") {
      void meApi.updateOnboarding({
        welcomed_at: now,
        last_seen_version: APP_VERSION,
        tours: { [WELCOME_TOUR]: how === "done" ? { done_at: now } : { skipped_at: now } },
      }).catch(() => {});
      if (how === "skipped") toast("You can take the tour any time from Settings, Tour and help.");
    } else {
      void meApi.updateOnboarding({ last_seen_version: APP_VERSION }).catch(() => {});
    }
    setMode(null);
  }, [mode]);

  return (
    <AnimatePresence>
      {mode?.kind === "welcome" && <WelcomeTour key="welcome" onClose={close} />}
      {mode?.kind === "whats-new" && <TourPlayer key="new" label="What's new" steps={mode.steps} onClose={close} />}
    </AnimatePresence>
  );
}

function WelcomeTour({ onClose }: { onClose: (how: "done" | "skipped") => void }) {
  const [viewer] = useState(() => readUser());
  const steps = useWelcomeSteps(viewer?.name ?? "", viewer?.role ?? "");
  return <TourPlayer label="Welcome tour" steps={steps} onClose={onClose} />;
}
