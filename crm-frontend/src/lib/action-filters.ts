// action-filters.ts
export const ACTION_FILTERS = [
  'Overdue',
  'Yesterday',
  'Today',
  'Tomorrow',
  'All Scheduled',
] as const;

export type ActionFilter = (typeof ACTION_FILTERS)[number];

const ACTION_FILTER_LABELS: Record<ActionFilter, string> = {
  Overdue: 'Overdue',
  Yesterday: 'Yesterday',
  Today: 'Today',
  Tomorrow: 'Tomorrow',
  'All Scheduled': 'Later',
};

export function getActionFilterLabel(filter: string): string {
  return (ACTION_FILTER_LABELS as Record<string, string>)[filter] ?? filter;
}
