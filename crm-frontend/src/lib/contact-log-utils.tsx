import { Mail, MessageSquare, Phone, PhoneIncoming } from "lucide-react";

// Shared contact-log presentation helpers, extracted from the leads detail
// page (the reference implementation). Import here to keep every module's
// contact activity UI identical.
export const CONTACT_TYPE_STYLES: Record<string, string> = {
  email:    "bg-muted/30 text-muted-foreground border-border/60",
  sms:      "bg-muted/30 text-muted-foreground border-border/60",
  whatsapp: "bg-muted/30 text-emerald-600 dark:text-emerald-400 border-border/60",
  call:     "bg-muted/30 text-blue-600 dark:text-blue-400 border-border/60",
};

export const CONTACT_TYPE_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail className="h-3.5 w-3.5" />,
  sms:      <MessageSquare className="h-3.5 w-3.5" />,
  whatsapp: <Phone className="h-3.5 w-3.5" />,
  call:     <PhoneIncoming className="h-3.5 w-3.5" />,
};

export function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDuration(totalSeconds: any): string {
  const s = Number(totalSeconds) || 0;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
}

// Newest-first sort (created_at, id tiebreak) — backend orders the same way,
// but bulk device syncs share second precision.
export function sortContactLogs<T extends { created_at: any; id?: any }>(logs: T[]): T[] {
  return [...logs].sort((a: any, b: any) =>
    (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || ((b.id ?? 0) - (a.id ?? 0)),
  );
}

export function countByType(logs: Array<{ contact_type: string }>): Record<string, number> {
  return logs.reduce((acc: Record<string, number>, log) => {
    acc[log.contact_type] = (acc[log.contact_type] || 0) + 1;
    return acc;
  }, {});
}

export function countCallDirections(
  logs: Array<{ contact_type: string; call_direction?: string | null }>,
): Record<string, number> {
  return logs.reduce((counts: Record<string, number>, log) => {
    if (log.contact_type === "call") {
      const direction = (log.call_direction || "Unknown").toLowerCase();
      counts[direction] = (counts[direction] || 0) + 1;
    }
    return counts;
  }, {});
}
