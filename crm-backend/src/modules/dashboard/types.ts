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
  | (Base & { kind: 'bars'; fmt: Fmt; bars: Bar[]; secondaryLabel?: string; valueLabel?: string })
  | (Base & { kind: 'stacked'; fmt: Fmt; keys: { key: string; label: string }[]; rows: { label: string; personId?: number; values: Record<string, number> }[] })
  | (Base & { kind: 'donut'; slices: { label: string; value: number; href?: string }[]; centerLabel: string; /** A big ring with no legend; slices name themselves on hover. */ ring?: boolean })
  | (Base & { kind: 'funnel'; stages: { label: string; value: number; href?: string }[] })
  | (Base & { kind: 'heatmap'; fmt: Fmt; rows: { label: string; personId?: number }[]; cols: string[]; cells: number[][] })
  | (Base & { kind: 'scatter'; x: { label: string; fmt: Fmt }; y: { label: string; fmt: Fmt }; points: { label: string; x: number; y: number; personId?: number }[] })
  | (Base & { kind: 'radar'; axes: { label: string; value: number }[] })
  | (Base & { kind: 'leaderboard'; columns: { key: string; label: string; fmt: Fmt; better: Better }[]; rows: LeaderRow[] })
  | (Base & { kind: 'insights'; items: Insight[] })
  | (Base & { kind: 'queue'; items: { id: number; name: string; status: string; ownerId: number; owner?: string; due: string | null; reason: string; idleDays: number }[] })
  | (Base & { kind: 'targets'; rows: TargetRow[]; personal: boolean })
  | (Base & { kind: 'table'; metrics: MetricOut[] })
  | (Base & { kind: 'progress'; hero: ProgressHero });

export type Achievement = { key: string; period: string; title: string; detail: string; unlocked: boolean; celebrate: boolean };

export type ProgressHero = {
  score: number | null;
  scoreBasis: 'targets' | 'peers' | null;
  rank: number | null;
  rankOf: number;
  streak: { days: number; metric: string };
  best: { value: number; date: string | null; metric: string; today: number };
  achievements: Achievement[];
  strengths: MetricOut[];
  weaknesses: MetricOut[];
  change: number | null;
};

export type Section = { id: string; title: string; description?: string; hideHeader?: boolean; blocks: Block[] };
export type Tab = { id: string; label: string };
