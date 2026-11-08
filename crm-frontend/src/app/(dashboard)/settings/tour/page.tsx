"use client";

import { useEffect, useState } from "react";
import { Compass, Keyboard, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Section, SettingsPage } from "@/components/settings/settings-ui";
import { meApi, type Onboarding } from "@/lib/me-api";
import { APP_VERSION } from "@/lib/release";

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);

export default function TourSettingsPage() {
  const [state, setState] = useState<Onboarding | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    meApi.onboarding().then(setState).catch(() => setState({}));
  }, []);

  const tours = Object.values(state?.tours ?? {});
  const finished = tours.map((t) => t.done_at).filter(Boolean).sort().at(-1);
  const seen = !!state?.welcomed_at || tours.length > 0;

  const reset = async () => {
    setBusy(true);
    try {
      setState(await meApi.updateOnboarding({ reset: true }));
      toast.success("Done. The welcome and tour will start the next time you open the dashboard.");
    } catch {
      toast.error("Couldn't reset the tour");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Tour and help" description="Take the guided tour again, or see what changed in this version.">
      <Section
        title="Product tour"
        description="A short walk through the pages you use, made for your role."
        footer={
          <Button onClick={reset} disabled={busy || !state}>
            <RotateCcw className="size-4" /> {busy ? "Resetting…" : "Reset the tour"}
          </Button>
        }
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <Compass className="size-5" strokeWidth={1.75} />
          </span>
          <p className="text-[13.5px] text-muted-foreground">
            {!state ? "Checking…" : finished ? `You finished the tour on ${date(finished)}.` : seen ? "You've started the tour but haven't finished it." : "You haven't taken the tour yet."}
            {" "}Resetting shows the welcome and the tour again from the start.
          </p>
        </div>
      </Section>

      <Section title="Good to know">
        <ul className="divide-y text-[13.5px]">
          <li className="flex items-center gap-3 pb-3">
            <Keyboard className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Search anything: leads, pages and registries</span>
            <kbd className="rounded border bg-muted/60 px-1.5 py-0.5 font-sans text-[12px] text-muted-foreground">⌘ K</kbd>
          </li>
          <li className="flex items-center gap-3 pt-3">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">You&apos;re on version {APP_VERSION}. New versions show up at the bottom of the sidebar.</span>
          </li>
        </ul>
      </Section>
    </SettingsPage>
  );
}
