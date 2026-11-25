import type { Better, DeptKey, Fmt } from './metrics';

export type Viewer = { id: number; role: string; department_id?: number | null };

export type Person = {
  id: number;
  name: string;
  role: string;
  departmentId: number | null;
  department: string | null;
  dept: DeptKey;
  avatar: string | null;
};

export type Subject =
  | { kind: 'all'; key: 'all'; label: string }
  | { kind: 'dept'; key: string; label: string; dept: DeptKey; departmentId: number }
  | { kind: 'person'; key: string; label: string; person: Person };

export type Scope = 'organization' | 'department' | 'self';

export type MetricOut = {
  key: string;
  label: string;
  fmt: Fmt;
  better: Better;
  value: number | null;
  prev: number | null;
  median?: number | null;
  percentile?: number | null;
  series?: string;
  alert?: boolean;
  hint?: string;
  snapshot?: boolean;
};

export type Span = 'full' | 'half' | 'third' | 'twoThirds';
type Base = { id: string; title: string; subtitle?: string; span?: Span };
export type Bar = { label: string; value: number; secondary?: number; href?: string; personId?: number; tone?: 'good' | 'bad' | 'warn' };

export type Insight = {
  tone: 'good' | 'bad' | 'warn';
  title: string;
  detail: string;
  href?: string;
  personId?: number;
  metric?: string;
};

export type TargetRow = {
  personId: number;
  name: string;
  metric: string;
  label: string;
  unit: 'count' | 'amount';
  monthly: number;
  achieved: number;
  expected: number;
  week: { target: number; achieved: number; number: number };
  today: { goal: number; achieved: number };
  forecast: number;
};

export type LeaderRow = {
  personId: number;
  name: string;
  avatar: string | null;
  role: string;
  score: number | null;
  scoreBasis: 'targets' | 'peers' | null;
  change: number | null;
  values: Record<string, number | null>;
  flags: string[];
};

export type Block =
  | (Base & { kind: 'kpis'; metrics: MetricOut[] })
  | (Base & { kind: 'trend'; fmt: Fmt; series: { key: string; label: string }[]; points: { t: string; v: Record<string, number> }[]; bucket: 'hour' | 'day' | 'week' })
  | (Base & { kind: 'bars'; fmt: Fmt; bars: Bar[]; secondaryLabel?: string; valueLabel?: string; /** Show every bar instead of the first few. */ showAll?: boolean; /** Legend words for bar tones, in place of On track / Watch / Behind. */ toneLabels?: Partial<Record<'good' | 'warn' | 'bad', string>> })
  | (Base & { kind: 'stacked'; fmt: Fmt; keys: { key: string; label: string }[]; rows: { label: string; personId?: number; values: Record<string, number> }[] })
  | (Base & { kind: 'donut'; slices: { label: string; value: number; href?: string }[]; centerLabel: string; /** A big ring with no legend; slices name themselves on hover. */ ring?: boolean })
  | (Base & { kind: 'funnel'; stages: { label: string; value: number; href?: string }[] })
  | (Base & { kind: 'heatmap'; fmt: Fmt; rows: { label: string; personId?: number }[]; cols: string[]; cells: number[][] })
  | (Base & { kind: 'scatter'; x: { label: string; fmt: Fmt }; y: { label: string; fmt: Fmt }; points: { label: string; x: number; y: number; personId?: number }[] })
  | (Base & { kind: 'radar'; axes: { label: string; value: number }[] })
  | (Base & { kind: 'leaderboard'; columns: { key: string; label: string; fmt: Fmt; better: Better }[]; rows: LeaderRow[] })
  /** People with something worth a look: leading, slowing, overloaded and the like. */
  | (Base & { kind: 'signals'; people: { personId: number; name: string; avatar: string | null; role: string; flags: string[] }[] })
  | (Base & { kind: 'insights'; items: Insight[] })
  | (Base & { kind: 'queue'; items: { id: number; name: string; status: string; ownerId: number; owner?: string; due: string | null; reason: string; idleDays: number }[] })
  | (Base & { kind: 'targets'; rows: TargetRow[]; personal: boolean })
  | (Base & { kind: 'table'; metrics: MetricOut[] })
  | (Base & { kind: 'progress'; hero: ProgressHero })
  | (Base & { kind: 'compare'; groups: { label: string; value: number; prev: number; bad: boolean }[] })
  /** Leads by source with repeat enquiries; picking a source shows its own funnel through the statuses. */
  | (Base & { kind: 'sources'; steps: string[]; rows: { label: string; leads: number; repeats: number; booked: number; funnel: number[]; href?: string }[] })
  /** Leads lost between funnel steps, split by where they went: lost, parked, or still open at the step. */
  | (Base & { kind: 'leakage'; rows: { from: string; to: string; base: number; lost: number; parked: number; open: number; href?: string }[] })
  | (Base & { kind: 'journey'; noun: string; person: string; self: boolean; period: { from: string; to: string; prevFrom: string; prevTo: string }; stages: JourneyStage[]; exits: JourneyStage[]; extras?: JourneyStage[]; parked?: JourneyStage[] });

export type JourneyStage = { key: string; label: string; detail: string; say: [string, string]; value: number; prev: number; optional?: boolean };

export type Achievement = { key: string; period: string; title: string; detail: string; unlocked: boolean; celebrate: boolean };

export type ProgressHero = {
  score: number | null;
  scoreBasis: 'targets' | 'peers' | null;
  rank: number | null;
  rankOf: number;
  streak: { days: number; metric: string };
  best: { value: number; date: string | null; metric: string; today: number };
  achievements: Achievement[];
  /** The person's targets, shown beside the achievements. */
  targets: TargetRow[];
  strengths: MetricOut[];
  weaknesses: MetricOut[];
  change: number | null;
};

export type Section = { id: string; title: string; description?: string; hideHeader?: boolean; blocks: Block[] };
export type Tab = { id: string; label: string };
