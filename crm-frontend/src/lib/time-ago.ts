// Compact relative time for dense UI (tables, notification lists). Extracted
// from the topbar so every surface words "how long ago" the same way. Capped
// at 90d+ so a lead untouched for a year does not read "400d ago".
export function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const ms = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return "";

  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days >= 90) return "90d+";
  return `${days}d ago`;
}
