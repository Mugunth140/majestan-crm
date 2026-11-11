import { BadRequestException } from '@nestjs/common';

/** Every dashboard day is an India calendar day; stored timestamps are UTC. */
export const IST_OFFSET_MIN = 330;
const DAY = 86_400_000;

/** Working calendar: Monday–Saturday, 9:00–18:30 IST. */
export const WORK_START_MIN = 9 * 60;
export const WORK_END_MIN = 18 * 60 + 30;
/** First response counts as on time within this many working minutes. */
export const RESPONSE_SLA_MIN = 60;

export const RANGE_KEYS = ['today', '7d', '30d', '6m'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number] | 'custom';
const LENGTH: Record<Exclude<RangeKey, 'custom'>, number> = { today: 1, '7d': 7, '30d': 30, '6m': 182 };
/** A custom period is written `YYYY-MM-DD..YYYY-MM-DD` (both days included). */
const CUSTOM = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;
/** Two years: longer periods make the weekly charts unreadable and the queries slow. */
const MAX_CUSTOM_DAYS = 731;

export type Range = {
  key: RangeKey;
  /** Inclusive IST dates. */
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  days: number;
  bucket: 'hour' | 'day' | 'week';
  workingDays: number;
  prevWorkingDays: number;
  today: string;
};

export const istToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);

/** Sunday is the only day off. */
export const isWorkingDay = (date: string) => new Date(date).getUTCDay() !== 0;

export function workingDaysBetween(from: string, to: string) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d)) n++;
  return n;
}

export function parseRange(raw: string | undefined, now = new Date()): Range {
  const today = istToday(now);
  const custom = raw ? CUSTOM.exec(raw) : null;
  let key: RangeKey;
  let from: string;
  let to: string;
  if (custom) {
    [, from, to] = custom;
    const valid = (d: string) => !Number.isNaN(Date.parse(d)) && new Date(Date.parse(d)).toISOString().slice(0, 10) === d;
    if (!valid(from) || !valid(to)) throw new BadRequestException('Those dates are not real calendar days');
    if (from > to) throw new BadRequestException('The start date is after the end date');
    if (to > today) to = today;
    if (from > today) throw new BadRequestException('The period starts in the future');
    key = 'custom';
  } else {
    key = (raw ?? '30d') as RangeKey;
    if (!(RANGE_KEYS as readonly string[]).includes(key)) throw new BadRequestException('Choose today, 7d, 30d, 6m or a from..to date range');
    from = addDays(today, -(LENGTH[key as Exclude<RangeKey, 'custom'>] - 1));
    to = today;
  }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
  if (days > MAX_CUSTOM_DAYS) throw new BadRequestException('Pick a period of two years or less');
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return {
    key, from, to, prevFrom, prevTo, days, today,
    bucket: days === 1 ? 'hour' : days > 92 ? 'week' : 'day',
    workingDays: workingDaysBetween(from, to),
    prevWorkingDays: workingDaysBetween(prevFrom, prevTo),
  };
}

/** The UTC instant at which an IST date starts, as a DuckDB timestamp literal. */
export const utcStart = (date: string) =>
  `TIMESTAMP '${new Date(Date.parse(date) - IST_OFFSET_MIN * 60_000).toISOString().slice(0, 19).replace('T', ' ')}'`;

/** IST calendar date of a UTC timestamp column. */
export const istDate = (col: string) => `CAST(${col} + INTERVAL ${IST_OFFSET_MIN} MINUTE AS DATE)`;

/** 'cur' or 'prev' for a UTC timestamp column inside the two periods. */
export const periodOf = (col: string, range: Range) => `CASE WHEN ${col} >= ${utcStart(range.from)} THEN 'cur' ELSE 'prev' END`;

/** Bounds covering both periods, for a UTC timestamp column. */
export const inBothPeriods = (col: string, range: Range) =>
  `${col} >= ${utcStart(range.prevFrom)} AND ${col} < ${utcStart(addDays(range.to, 1))}`;

/**
 * Working minutes from a fixed Monday up to a UTC timestamp: 9:00–18:30 IST
 * on every day but Sunday. The difference of two of these is the working time
 * between them, so nights and Sundays never count.
 */
export function workMinutes(col: string) {
  const ist = `(${col} + INTERVAL ${IST_OFFSET_MIN} MINUTE)`;
  const day = `CAST(${ist} AS DATE)`;
  const minute = `(hour(${ist}) * 60 + minute(${ist}))`;
  const days = `date_diff('day', DATE '2024-01-01', ${day})`; // 1 Jan 2024 is a Monday
  const perDay = WORK_END_MIN - WORK_START_MIN;
  return `((${days} - floor(${days} / 7)) * ${perDay} + CASE WHEN dayofweek(${day}) = 0 THEN 0
      ELSE LEAST(GREATEST(${minute} - ${WORK_START_MIN}, 0), ${perDay}) END)`;
}

/** Working minutes between two UTC timestamps (never negative). */
export const workMinutesBetween = (from: string, to: string) =>
  `GREATEST(${workMinutes(to)} - ${workMinutes(from)}, 0)`;

/** Task weeks: days 1–7, 8–14, 15–21, 22–end of month. */
export function taskWeek(date: string) {
  const d = Number(date.slice(8, 10));
  return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4;
}

export function taskWeekBounds(date: string): { from: string; to: string } {
  const week = taskWeek(date);
  const month = date.slice(0, 7);
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const startDay = (week - 1) * 7 + 1;
  const endDay = week === 4 ? last : week * 7;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { from: `${month}-${pad(startDay)}`, to: `${month}-${pad(endDay)}` };
}
