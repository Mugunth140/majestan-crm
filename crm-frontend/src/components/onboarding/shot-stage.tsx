"use client";

import { AnimatePresence, motion } from "motion/react";
import { SHOT_H, SHOT_W, shotUrl, type Rect } from "./tour-data";
import { cn } from "@/lib/utils";

const PAD = 10; // breathing room around the spotlight, in screenshot pixels
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far to zoom and pan so `focus` fills most of the stage. */
export function framing(focus?: Rect) {
  if (!focus) return { scale: 1, x: 0, y: 0 };
  const [fx, fy, fw, fh] = focus;
  const scale = clamp(Math.min(SHOT_W / ((fw + PAD * 2) * 1.6), SHOT_H / ((fh + PAD * 2) * 1.6)), 1, 2.2);
  const cx = (fx + fw / 2) / SHOT_W;
  const cy = (fy + fh / 2) / SHOT_H;
  // With the origin at the top left, a point p lands at translate + scale·p.
  return { scale, x: clamp(0.5 - scale * cx, 1 - scale, 0) * 100, y: clamp(0.5 - scale * cy, 1 - scale, 0) * 100 };
}

const spring = { type: "spring", stiffness: 60, damping: 18, mass: 1 } as const;

/**
 * A screenshot of the CRM that glides and zooms to the part being explained, and
 * dims everything around it.
 */
export function ShotStage({ shot, focus, alt, className }: { shot: string; focus?: Rect; alt: string; className?: string }) {
  const f = framing(focus);
  const ring = focus ? [focus[0] - PAD, focus[1] - PAD, focus[2] + PAD * 2, focus[3] + PAD * 2] : null;

  return (
    <div className={cn("relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-20px_rgba(0,0,0,0.6)]", className)}>
      <motion.div
        className="absolute inset-0 origin-top-left will-change-transform"
        initial={false}
        animate={{ x: `${f.x}%`, y: `${f.y}%`, scale: f.scale }}
        transition={spring}
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={shot}
            src={shotUrl(shot)}
            alt={alt}
            draggable={false}
            className="absolute inset-0 size-full select-none object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        </AnimatePresence>
        {/* Spotlight: a ring round the part being explained, everything else dimmed */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-[6px]"
          initial={false}
          animate={{
            left: `${((ring?.[0] ?? 0) / SHOT_W) * 100}%`, top: `${((ring?.[1] ?? 0) / SHOT_H) * 100}%`,
            width: `${((ring?.[2] ?? SHOT_W) / SHOT_W) * 100}%`, height: `${((ring?.[3] ?? SHOT_H) / SHOT_H) * 100}%`,
            opacity: ring ? 1 : 0,
          }}
          transition={spring}
          style={{ boxShadow: `0 0 0 ${2 / f.scale}px #2FB585, 0 0 ${18 / f.scale}px ${2 / f.scale}px rgba(47,181,133,0.35), 0 0 0 9999px rgba(0,0,0,0.5)` }}
        />
      </motion.div>
    </div>
  );
}

/** Starts downloading screenshots before they are needed. */
export function preloadShots(names: string[]) {
  for (const n of new Set(names)) {
    const img = new Image();
    img.src = shotUrl(n);
  }
}
