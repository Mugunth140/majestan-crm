"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";
import { ArrowCircleUpIcon, XIcon } from "@phosphor-icons/react";
import { PrismarkAssembly } from "@/components/brand/prismark-loader";
import { APP_VERSION, BUILD_ID, releasesSince, type ChangeKind, type Release } from "@/lib/release";
import { cn } from "@/lib/utils";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const MIN_UPDATING_MS = 4600; // the loader plays about two full cycles before the reload

export interface DeployedBuild {
  buildId: string;
  version: string;
  releases: Release[];
}

// Polls the deployed build (on an interval and whenever the tab regains focus) and
// reports it once it differs from the build this tab was loaded from.
export function useAppUpdate() {
  const [deployed, setDeployed] = useState<DeployedBuild | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/app-version?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok || !res.headers.get("content-type")?.includes("json")) return;
      const data = (await res.json()) as DeployedBuild;
      if (data.buildId && data.buildId !== BUILD_ID) setDeployed(data);
    } catch {
      // Offline or mid-deploy; try again next time.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 3000);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  return deployed;
}

// Swap in the new build: refresh the service worker, drop its caches, then reload.
async function applyUpdate() {
  const minDelay = new Promise((r) => setTimeout(r, MIN_UPDATING_MS));
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // A plain reload still picks up the new build.
  }
  await minDelay;
  window.location.reload();
}

const KIND_LABEL: Record<ChangeKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };
const KIND_STYLE: Record<ChangeKind, string> = {
  new: "bg-[#017D58]/10 text-[#017D58] dark:bg-[#2FB585]/15 dark:text-[#2FB585]",
  improved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

// Sidebar entry point. Expanded, it floats over the bottom of the nav on a fade from the
// sidebar colour; collapsed, it is an icon button. The sidebar owns the polling.
export function UpdateButton({ deployed, collapsed, className }: { deployed: DeployedBuild | null; collapsed: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!deployed) return null;

  return (
    <div className={className}>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Update to version ${deployed.version}`}
          title={`Update to v${deployed.version}`}
          className="relative mx-auto flex size-8 items-center justify-center rounded-md text-[#017D58] hover:bg-black/5 dark:text-[#2FB585] dark:hover:bg-white/5"
        >
          <ArrowCircleUpIcon size={18} weight="fill" />
        </button>
      ) : (
        <div className="update-card-enter px-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              <PrismarkAssembly className="size-4 text-[#017D58] dark:text-[#2FB585]" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight text-foreground">Update available</p>
              <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">Version {deployed.version} is ready</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 flex h-8 w-full items-center justify-center rounded-lg bg-[#017D58] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(1,125,88,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[background-color,transform] duration-150 hover:bg-[#016347] active:scale-[0.98] dark:bg-[#0B8F66] dark:hover:bg-[#017D58]"
          >
            Update now
          </button>
        </div>
      )}
      <UpdateDialog deployed={deployed} open={open} onOpenChange={setOpen} />
    </div>
  );
}

const UPDATE_STEPS = ["Downloading the new version", "Clearing the old files", "Restarting the CRM"];

/** Shown while the update installs: the looping mark, a running bar and the current step. */
function UpdatingView({ version }: { version: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, UPDATE_STEPS.length - 1)), MIN_UPDATING_MS / UPDATE_STEPS.length);
    return () => clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center px-8 pb-10 pt-12 text-center">
      <PrismarkAssembly loop className="size-14 text-[#017D58] dark:text-[#2FB585]" />
      <Dialog.Title className="mt-7 text-base font-semibold">Updating to v{version}</Dialog.Title>
      <p key={step} className="update-step mt-1 text-sm text-kumo-subtle">{UPDATE_STEPS[step]}…</p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-[#017D58]/12 dark:bg-[#2FB585]/15">
        <div className="update-bar h-full w-1/3 rounded-full bg-[#017D58] dark:bg-[#2FB585]" />
      </div>
      <p className="mt-5 text-xs text-kumo-subtle">The page reloads by itself when it&apos;s done.</p>
    </div>
  );
}

function UpdateDialog({
  deployed,
  open,
  onOpenChange,
}: {
  deployed: DeployedBuild;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const newer = releasesSince(APP_VERSION, deployed.releases);
  // Redeploy without a version bump: still show the current notes.
  const notes = newer.length ? newer : deployed.releases.slice(0, 1);

  const start = () => {
    setUpdating(true);
    void applyUpdate();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !updating && onOpenChange(o)}>
      <Dialog size="lg" className="top-1/2 overflow-hidden p-0 sm:top-1/2 -translate-y-1/2">
        {updating ? (
          <UpdatingView version={deployed.version} />
        ) : (
          <>
            <div className="flex items-start gap-4 border-b border-kumo-line px-6 pb-5 pt-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#017D58] text-white dark:bg-[#0B8F66]">
                <PrismarkAssembly className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base font-semibold">A new version is available</Dialog.Title>
                <p className="mt-1 flex items-center gap-2 text-sm text-kumo-subtle">
                  <span className="font-mono text-xs">v{APP_VERSION}</span>
                  <span aria-hidden>→</span>
                  <span className="rounded-md bg-[#017D58]/10 px-1.5 py-0.5 font-mono text-xs font-medium text-[#017D58] dark:bg-[#2FB585]/15 dark:text-[#2FB585]">
                    v{deployed.version}
                  </span>
                </p>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 -mt-1 flex size-8 items-center justify-center rounded-md text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"
              >
                <XIcon size={16} />
              </Dialog.Close>
            </div>

            <div className="max-h-[50vh] overflow-y-auto px-6 py-5">
              {notes.map((release) => (
                <section key={release.version} className="not-first:mt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      {release.title}
                      <span className="ml-2 font-mono text-xs font-normal text-kumo-subtle">v{release.version}</span>
                    </h3>
                    <time dateTime={release.date} className="shrink-0 text-xs text-kumo-subtle">
                      {new Date(release.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {release.changes.map((change) => (
                      <li key={change.text} className="flex items-start gap-3 text-sm leading-snug">
                        <span
                          className={cn(
                            "mt-px w-[68px] shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium",
                            KIND_STYLE[change.kind],
                          )}
                        >
                          {KIND_LABEL[change.kind]}
                        </span>
                        <span className="text-kumo-default">{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-kumo-line bg-kumo-recessed px-6 py-4">
              <p className="text-xs text-kumo-subtle">Unsaved changes on this page will be lost.</p>
              <div className="flex gap-2">
                <Dialog.Close render={(p) => <Button variant="secondary" {...p}>Later</Button>} />
                <Button variant="primary" onClick={start}>
                  Update now
                </Button>
              </div>
            </div>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
