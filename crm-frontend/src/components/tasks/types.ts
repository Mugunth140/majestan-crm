// Mirrors crm-backend/src/modules/tasks (task-pace.ts and tasks.service.ts).

export type PaceStatus = "done" | "ahead" | "on_pace" | "behind" | "missed" | "upcoming";

export type MetricPace = {
  key: string;
  label: string;
  unit: "count" | "amount";
  tracking: "auto" | "manual";
  /** What gets counted, in the words staff see. */
  source: string;
  monthly: number;
  achieved: number;
  remaining: number;
  expected: number;
  forecast: number;
  pct: number;
  status: PaceStatus;
  week: { number: number; target: number; base: number; carried: number; achieved: number; remaining: number; from: string; to: string };
  today: { goal: number; achieved: number; remaining: number };
  byWeek: number[];
  weekTargets: number[];
  daily: { date: string; value: number }[];
};

export type TaskPerson = { id: number; name: string; avatar: string | null; role: string; department_id: number | null; department: string | null };

export type TaskRow = {
  id: number;
  title: string;
  month: string;
  status: string;
  person: TaskPerson;
  department_id: number;
  metrics: MetricPace[];
  overall: { pct: number; status: PaceStatus; today: { met: number; total: number }; behind: number };
};

export type Board = {
  month: string;
  today: string;
  current: string;
  months: string[];
  departments: { id: number; name: string; hasMetrics: boolean }[];
  rows: TaskRow[];
  without: TaskPerson[];
  can: { create: boolean; copy: boolean; delete: boolean };
};

export type TaskDetail = TaskRow & {
  department: string | null;
  created_by: { id: number; name: string } | null;
  created_at: string;
  receipts: { id: number; file_name: string; file_url: string; upload_date: string; uploaded_by: number }[];
  can: { edit: boolean; log: boolean; delete: boolean };
};

export type ActivityItem = {
  at: string;
  kind: "call" | "message" | "follow_up" | "status" | "listing" | "candidate" | "receipt" | "manual";
  metrics: string[];
  title: string;
  detail: string | null;
  source: "logger" | "crm" | "manual";
  href: string | null;
};

export type MetricDef = { key: string; label: string; value_type: "count" | "amount"; tracking_type: "auto" | "manual"; source: string };

export type Setup = {
  month: string;
  months: string[];
  departments: { id: number; name: string; metrics: MetricDef[]; people: { id: number; name: string; avatar: string | null; role: string; taken: boolean }[] }[];
};
