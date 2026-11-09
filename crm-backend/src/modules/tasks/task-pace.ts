import { addDays, isWorkingDay, taskWeek, taskWeekBounds, workingDaysBetween } from '../dashboard/range';

/**
 * Where one monthly target stands on a given day. The month is spread over its
 * working days (Monday–Saturday); a week's target carries the shortfall of the
 * weeks before it, and today's goal is what is left of this week split over the
 * working days still to come. The Tasks page and the Dashboard both read this.
 */

export type PaceStatus = 'done' | 'ahead' | 'on_pace' | 'behind' | 'missed' | 'upcoming';

export type Pace = {
  monthly: number;
  achieved: number;
  remaining: number;
  /** Where a steady pace would be by the end of today. */
  expected: number;
  /** The month's total if the pace so far holds. */
  forecast: number;
  pct: number;
  status: PaceStatus;
  week: { number: number; target: number; base: number; carried: number; achieved: number; remaining: number; from: string; to: string };
  today: { goal: number; achieved: number; remaining: number };
  /** Achieved per task week, index 1–4 (0 unused). */
  byWeek: number[];
  weekTargets: number[];
  /** Achieved per day of the month, up to today. */
  daily: { date: string; value: number }[];
};

export type TargetInput = { monthly: number; weeks: number[] };

const lastDay = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

export function computePace(target: TargetInput, days: Map<string, number> | undefined, month: string, today: string): Pace {
  const first = `${month}-01`;
  const last = lastDay(month);
  const thisMonth = today.startsWith(month);
  const past = !thisMonth && month < today.slice(0, 7);
  // A finished month is judged on its last day; a planned one has not started.
  const asOf = thisMonth ? today : past ? last : first;

  const byWeek = [0, 0, 0, 0, 0];
  let achieved = 0, todayAchieved = 0;
  for (const [d, v] of days ?? []) {
    if (!d.startsWith(month)) continue;
    achieved += v;
    byWeek[taskWeek(d)] += v;
    if (d === asOf) todayAchieved += v;
  }
  const weekTargets = [0, ...[1, 2, 3, 4].map(w => Number(target.weeks[w - 1]) || 0)];
  const monthly = Number(target.monthly) || 0;

  const week = taskWeek(asOf);
  const bounds = taskWeekBounds(asOf);
  let carried = 0;
  for (let w = 1; w < week; w++) carried += Math.max(0, weekTargets[w] - byWeek[w]);
  const weekTarget = weekTargets[week] + carried;
  const weekAchieved = byWeek[week];
  const beforeToday = weekAchieved - todayAchieved;
  const daysLeft = Math.max(1, workingDaysBetween(asOf, bounds.to));
  const goal = thisMonth && isWorkingDay(today) ? Math.max(0, Math.ceil((weekTarget - beforeToday) / daysLeft)) : 0;

  const totalWorking = workingDaysBetween(first, last) || 1;
  const throughToday = thisMonth ? workingDaysBetween(first, today) : past ? totalWorking : 0;
  // Judge pace on finished days so the morning does not read as behind.
  const throughYesterday = thisMonth ? workingDaysBetween(first, addDays(today, -1)) : throughToday;
  const expected = (monthly * throughToday) / totalWorking;
  const expectedBefore = (monthly * throughYesterday) / totalWorking;
  const forecast = throughToday > 0 ? Math.round((achieved / throughToday) * totalWorking) : 0;

  let status: PaceStatus;
  if (monthly > 0 && achieved >= monthly) status = 'done';
  else if (past) status = 'missed';
  else if (!thisMonth) status = 'upcoming';
  else if (expectedBefore <= 0) status = achieved > 0 ? 'ahead' : 'on_pace';
  else if (achieved >= expectedBefore * 1.1) status = 'ahead';
  else if (achieved >= expectedBefore * 0.9) status = 'on_pace';
  else status = 'behind';

  const daily: Pace['daily'] = [];
  if (thisMonth || past) for (let d = first; d <= asOf; d = addDays(d, 1)) daily.push({ date: d, value: days?.get(d) ?? 0 });

  return {
    monthly, achieved, remaining: Math.max(0, monthly - achieved), expected, forecast,
    pct: monthly > 0 ? Math.round((achieved / monthly) * 100) : 0,
    status,
    week: {
      number: week, target: weekTarget, base: weekTargets[week], carried, achieved: weekAchieved,
      remaining: Math.max(0, weekTarget - weekAchieved), from: bounds.from, to: bounds.to,
    },
    today: { goal, achieved: thisMonth ? todayAchieved : 0, remaining: Math.max(0, goal - (thisMonth ? todayAchieved : 0)) },
    byWeek, weekTargets, daily,
  };
}

/** The weekly targets stored on a TaskMetricTarget row, weeks 1–4. */
export const storedWeeks = (row: unknown) =>
  [1, 2, 3, 4].map(w => Number((row as Record<string, unknown>)[`week${w}_target`]) || 0);
