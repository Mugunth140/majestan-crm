/**
 * Colours for target progress. A bar is judged against where the person
 * should be by now, not against the whole target, so nobody is red at
 * 10 AM for not having made the day's 120 calls yet:
 *
 *   under 40% of pace  red     "Well behind"
 *   40–60%             orange  "Behind"
 *   60–80%             yellow  "Slightly behind"
 *   80% or more        green   "On track"
 *
 * The working day is 9:00–18:30 IST, Monday–Saturday. Once it ends, pace is
 * the whole goal, so the colour becomes the day's plain result.
 */
export type PaceBand = "red" | "orange" | "yellow" | "green";

export const PACE_BANDS: Record<PaceBand, { color: string; label: string }> = {
  red: { color: "var(--pace-red)", label: "Well behind" },
  orange: { color: "var(--pace-orange)", label: "Behind" },
  yellow: { color: "var(--pace-yellow)", label: "Slightly behind" },
  green: { color: "var(--pace-green)", label: "On track" },
};

const IST_OFFSET_MS = 330 * 60_000;
const WORK_START_MIN = 9 * 60;
const WORK_END_MIN = 18 * 60 + 30;

/** The band for a share of pace, in percent. */
export function paceBand(pctOfPace: number): PaceBand {
  if (pctOfPace >= 80) return "green";
  if (pctOfPace >= 60) return "yellow";
  if (pctOfPace >= 40) return "orange";
  return "red";
}

/** India date parts for a moment. */
function ist(now: Date) {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate(), dow: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** How much of today's working day has passed, 0–1. Sunday is not a working day (0). */
export function dayElapsed(now: Date): number {
  const t = ist(now);
  if (t.dow === 0) return 0;
  return Math.min(1, Math.max(0, (t.minute - WORK_START_MIN) / (WORK_END_MIN - WORK_START_MIN)));
}

/** How much of the current task week (days 1–7, 8–14, 15–21, 22–end) has passed, in working days, 0–1. */
export function weekElapsed(now: Date): number {
  const t = ist(now);
  const week = t.day <= 7 ? 1 : t.day <= 14 ? 2 : t.day <= 21 ? 3 : 4;
  const last = new Date(Date.UTC(t.y, t.m + 1, 0)).getUTCDate();
  const from = (week - 1) * 7 + 1, to = week === 4 ? last : week * 7;
  let total = 0, done = 0;
  for (let d = from; d <= to; d++) {
    if (new Date(Date.UTC(t.y, t.m, d)).getUTCDay() === 0) continue;
    total += 1;
    if (d < t.day) done += 1;
    else if (d === t.day) done += dayElapsed(now);
  }
  return total ? done / total : 0;
}

/**
 * Where `achieved` stands against `expected` by now. Null before anything is
 * expected (before 9:00, or a target that hasn't started) and nothing is done,
 * so the bar stays neutral rather than red.
 */
export function paceOf(achieved: number, expected: number): { band: PaceBand; pct: number } | null {
  if (!(expected > 0)) return achieved > 0 ? { band: "green", pct: 100 } : null;
  const pct = (achieved / expected) * 100;
  return { band: paceBand(pct), pct };
}

/** Today's goal against the share of the working day gone. */
export const dayPace = (achieved: number, goal: number, now = new Date()) => (goal > 0 ? paceOf(achieved, goal * dayElapsed(now)) : null);

/** The current task week's target against the share of its working days gone. */
export const weekPace = (achieved: number, target: number, now = new Date()) => (target > 0 ? paceOf(achieved, target * weekElapsed(now)) : null);

/** The neutral fill for a bar with no pace yet. */
export const NO_PACE_COLOR = "var(--series-1, #2a78d6)";
