"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShotStage, preloadShots } from "./shot-stage";
import type { Slide } from "./tour-data";
import "./onboarding.css";

const BEAT_MS = 5200;

/** One screen of the flow. A step either plays a tour slide or renders its own content. */
export interface Step {
  id: string;
  eyebrow: string;
  title: string;
  slide?: Slide;
  /** Left side: a picture of what the step is about. */
  visual?: ReactNode;
  /** Right side, under the title. */
  body?: ReactNode;
  /** Primary button label; defaults to Next / Finish. */
  next?: string;
  /** Runs before moving on; return false to stay (for example, a failed save). */
  onNext?: () => Promise<boolean> | boolean;
  /** Shown as a quiet link next to the primary button. */
  skipStep?: string;
  /** While set, the primary button is disabled and this explains what is missing. */
  blocked?: string;
}

/**
 * The full-screen player behind the welcome tour and What's new. Desktop: picture on the
 * left, words on the right. Phone: picture on top, words below, buttons pinned to the bottom.
 */
export function TourPlayer({ steps, label, onClose }: { steps: Step[]; label: string; onClose: (how: "done" | "skipped") => void }) {
  const [at, setAt] = useState(0);
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(1);
  const panel = useRef<HTMLDivElement>(null);

  const step = steps[at];
  const beats = step.slide?.beats ?? [];
  const lastStep = at === steps.length - 1;

  useEffect(() => {
    preloadShots(steps.slice(at, at + 3).flatMap((s) => s.slide?.beats.map((b) => b.shot) ?? []));
  }, [at, steps]);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  const go = useCallback((to: number) => {
    setDir(to > at ? 1 : -1);
    setAt(to);
    setBeat(0);
    setPaused(false);
  }, [at]);

  const next = useCallback(async () => {
    if (busy || (step.blocked && beat >= beats.length - 1)) return;
    if (beat < beats.length - 1) {
      setBeat(beat + 1);
      setPaused(true);
      return;
    }
    if (step.onNext) {
      setBusy(true);
      const ok = await step.onNext();
      setBusy(false);
      if (!ok) return;
    }
    if (lastStep) onClose("done");
    else go(at + 1);
  }, [busy, beat, beats.length, step, lastStep, onClose, go, at]);

  const back = useCallback(() => {
    if (beat > 0) { setBeat(beat - 1); setPaused(true); }
    else if (at > 0) go(at - 1);
  }, [beat, at, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") onClose("skipped");
      else if (typing) return;
      else if (e.key === "ArrowRight") void next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  const current = beats[beat];

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="fixed inset-0 z-[90] flex bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background outline-none md:flex-row"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          {/* Picture */}
          <div className="ob-stage-bg relative flex shrink-0 items-center justify-center px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:min-w-0 md:flex-1 md:p-12 lg:p-16">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={step.id}
                className="w-full md:max-w-[calc((100dvh-8rem)*1.6)]"
                custom={dir}
                initial={{ opacity: 0, x: dir * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -24 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                onPointerEnter={() => setPaused(true)}
              >
                {current ? <ShotStage shot={current.shot} focus={current.focus} alt={`${step.title}: ${current.text}`} /> : step.visual}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Words */}
          <div className="flex min-h-0 flex-1 flex-col border-t md:w-[400px] md:flex-none md:border-l md:border-t-0 xl:w-[440px]">
            <div className="flex items-center gap-3 px-5 pt-4 md:px-8 md:pt-8">
              <div className="flex flex-1 gap-1" aria-hidden>
                {steps.map((s, i) => (
                  <span key={s.id} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < at ? "bg-[#2FB585]/70" : i === at ? "bg-[#2FB585]" : "bg-foreground/10")} />
                ))}
              </div>
              <button type="button" onClick={() => onClose("skipped")}
                className="-mr-1.5 flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
                {lastStep ? <X className="size-4" /> : <>Skip tour<X className="size-3.5" /></>}
                {lastStep && <span className="sr-only">Close</span>}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5 md:px-8 md:pt-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#017D58] dark:text-[#2FB585]">
                    {step.eyebrow}<span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">{at + 1} of {steps.length}</span>
                  </p>
                  <h2 className="mt-2 text-balance text-[22px] font-semibold leading-tight tracking-[-0.015em] text-foreground md:text-[24px]">{step.title}</h2>

                  {step.slide && (
                    <ol className="mt-5 space-y-1">
                      {step.slide.beats.map((b, i) => {
                        const active = i === beat;
                        return (
                          <li key={i}>
                            <button type="button" onClick={() => { setBeat(i); setPaused(true); }} aria-current={active ? "step" : undefined}
                              className={cn("group relative w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                                active ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]", !active && "max-md:hidden")}>
                              <span className="flex gap-3">
                                <span className={cn("mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums transition-colors",
                                  i < beat ? "bg-[#2FB585]/20 text-[#2FB585]" : active ? "bg-[#2FB585] text-black" : "bg-foreground/10 text-muted-foreground")}>
                                  {i < beat ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                                </span>
                                <span className={cn("text-[14px] leading-snug transition-colors", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80")}>{b.text}</span>
                              </span>
                              {active && beats.length > 1 && i < beats.length - 1 && (
                                <span className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-foreground/5">
                                  <span key={`${step.id}-${i}`} className="ob-fill block h-full bg-[#2FB585]/70"
                                    style={{ animationDuration: `${BEAT_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                                    onAnimationEnd={() => setBeat((n) => Math.min(n + 1, beats.length - 1))} />
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {step.slide && beats.length > 1 && (
                    <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
                      {beats.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === beat ? "w-4 bg-[#2FB585]" : "w-1.5 bg-foreground/20")} />)}
                    </div>
                  )}
                  {step.slide?.phone && (
                    <p className="mt-4 rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-[13px] text-muted-foreground md:hidden">{step.slide.phone}</p>
                  )}
                  {step.body}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 border-t px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:px-8 md:py-5">
              {(at > 0 || beat > 0) && (
                <button type="button" onClick={back} aria-label="Back"
                  className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
                  <ArrowLeft className="size-4" />
                </button>
              )}
              {step.blocked && <p className="text-[12.5px] leading-snug text-muted-foreground">{step.blocked}</p>}
              {step.skipStep && (
                <button type="button" onClick={() => go(at + 1)} className="h-10 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
                  {step.skipStep}
                </button>
              )}
              <button type="button" onClick={() => void next()} disabled={busy || !!step.blocked}
                className="ml-auto flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#017D58] px-4 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(1,125,88,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] transition-[background-color,transform] duration-150 hover:bg-[#016347] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#0B8F66] dark:hover:bg-[#017D58]">
                {busy ? "Saving…" : step.next ?? (lastStep ? "Finish" : "Next")}
                {!busy && !lastStep && <ArrowRight className="size-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
