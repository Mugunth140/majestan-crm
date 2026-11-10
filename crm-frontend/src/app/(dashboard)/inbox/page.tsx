"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, type PanInfo } from "motion/react";
import { ArrowRightLeft, Bell, CalendarClock, CalendarPlus, CheckCheck, Hand, MessageCircle, Trash2, UserPlus, type LucideIcon } from "lucide-react";
import { useNotifications, type Notification } from "@/context/notification-context";
import { MobileHeader } from "@/components/layout/mobile-header";
import { PageActions } from "@/components/layout/page-actions";
import { SegmentTabs, headerButtonClass } from "@/components/layout/list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { notificationHref, reminderParts } from "@/lib/notification-text";
import { cn } from "@/lib/utils";

type Kind = { icon: LucideIcon; tint: string };

const KINDS: Record<string, Kind> = {
  followup_reminder: { icon: CalendarClock, tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  followup_due: { icon: CalendarPlus, tint: "bg-sky-500/12 text-sky-600 dark:text-sky-400" },
  lead_assigned: { icon: UserPlus, tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  lead_claimed: { icon: Hand, tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  lead_transferred: { icon: ArrowRightLeft, tint: "bg-blue-500/12 text-blue-600 dark:text-blue-400" },
  whatsapp_message: { icon: MessageCircle, tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
};
const FALLBACK: Kind = { icon: Bell, tint: "bg-muted text-muted-foreground" };

const DAY = 86_400_000;
const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const time = (d: Date) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
const weekday = (d: Date) => new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(d);
const shortDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);

/** Today, Yesterday, This week or Earlier, in India time. */
function groupOf(at: Date, now: Date) {
  const today = istDay(now);
  const day = istDay(at);
  if (day === today) return "Today";
  if (day === istDay(new Date(now.getTime() - DAY))) return "Yesterday";
  return now.getTime() - at.getTime() < 7 * DAY ? "This week" : "Earlier";
}

function when(at: Date, group: string) {
  if (group === "Today") return time(at);
  if (group === "Yesterday") return "Yesterday";
  if (group === "This week") return weekday(at);
  return shortDate(at);
}

/** What a notification says, as a headline and a detail line. */
function read(n: Notification) {
  const r = reminderParts(n);
  if (r) return { title: <>Follow-up with <span className="font-semibold">{r.name}</span></>, detail: `${r.module} · due ${r.time}` };
  return { title: n.title || "Notification", detail: n.message ?? "" };
}

export default function InboxPage() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, clearAll, deleteNotification } = useNotifications();
  const [view, setView] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => new Date());

  const shown = view === "unread" ? notifications.filter((n) => !n.is_read) : notifications;
  const groups = useMemo(() => {
    const out: { label: string; items: { n: Notification; at: Date }[] }[] = [];
    for (const n of shown) {
      const at = n.created_at ? new Date(n.created_at) : now;
      const label = groupOf(at, now);
      if (out.at(-1)?.label !== label) out.push({ label, items: [] });
      out.at(-1)!.items.push({ n, at });
    }
    return out;
  }, [shown, now]);

  const open = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    const href = notificationHref(n);
    if (href) router.push(href);
  };
  const readAll = async () => {
    setBusy(true);
    await markAllRead();
    setBusy(false);
  };
  const clear = async () => {
    if (window.confirm("Delete every notification? This can't be undone.")) await clearAll();
  };

  const actions = (
    <>
      {unreadCount > 0 && (
        <button type="button" onClick={readAll} disabled={busy} className={headerButtonClass}>
          <CheckCheck className="size-4" /> Mark all read
        </button>
      )}
      {notifications.length > 0 && (
        <button type="button" onClick={clear} className={cn(headerButtonClass, "text-muted-foreground")} aria-label="Clear all notifications">
          <Trash2 className="size-4" /><span className="max-md:hidden">Clear all</span>
        </button>
      )}
    </>
  );

  return (
    <>
      <MobileHeader title="Inbox" />
      <PageActions>{actions}</PageActions>
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-2 md:px-0 md:pt-0">
        <div className="mb-4 flex items-center gap-2">
          <SegmentTabs label="Show" value={view} onChange={setView}
            tabs={[{ value: "all", label: "All" }, { value: "unread", label: <>Unread{unreadCount > 0 && <span className="ml-1 tabular-nums text-muted-foreground">{unreadCount}</span>}</> }]} />
          <div className="ml-auto flex items-center gap-2 md:hidden">{actions}</div>
        </div>

        {groups.length === 0 ? (
          <EmptyState kind="inbox" className="py-16"
            title={view === "unread" && notifications.length ? "You're all caught up" : "Your inbox is clear"}
            description={view === "unread" && notifications.length ? "Nothing new since you last looked." : "New assignments and follow-up reminders will land here."} />
        ) : (
          <MotionConfig reducedMotion="user">
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.label} aria-labelledby={`inbox-${g.label}`}>
                  <h2 id={`inbox-${g.label}`} className="mb-1.5 px-1 text-[12.5px] font-medium text-muted-foreground">{g.label}</h2>
                  <ul className="overflow-hidden rounded-2xl border bg-card">
                    <AnimatePresence initial={false}>
                      {g.items.map(({ n, at }) => (
                        <Row key={n.id} n={n} when={when(at, g.label)} onOpen={() => open(n)} onDelete={() => deleteNotification(n.id)} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              ))}
              <p className="px-1 text-center text-[12px] text-muted-foreground md:hidden">Swipe left on a notification to delete it.</p>
            </div>
          </MotionConfig>
        )}
      </div>
    </>
  );
}

/** One notification. Tap to open; swipe left (or the bin on desktop) to delete. */
function Row({ n, when, onOpen, onDelete }: { n: Notification; when: string; onOpen: () => void; onDelete: () => void }) {
  const kind = KINDS[n.type ?? ""] ?? FALLBACK;
  const Icon = kind.icon;
  const { title, detail } = read(n);
  const unread = !n.is_read;
  const dragged = useRef(false);
  // The red bin layer exists only mid-swipe, so it never tints the card's rounded edges.
  const [swiping, setSwiping] = useState(false);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -96 || info.velocity.x < -600) onDelete();
    // Let the click that ends a drag pass without opening the record.
    window.setTimeout(() => { dragged.current = false; }, 0);
    setSwiping(false);
  };

  return (
    <motion.li
      layout
      initial={false}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="relative border-b last:border-b-0"
    >
      {swiping && (
        <div aria-hidden className="absolute inset-0 flex items-center justify-end bg-red-500 pr-5 text-white md:hidden">
          <Trash2 className="size-5" />
        </div>
      )}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0 }}
        onDragStart={() => { dragged.current = true; setSwiping(true); }}
        onDragEnd={onDragEnd}
        className="group relative flex touch-pan-y items-start gap-3 bg-card px-4 py-3.5 md:touch-auto"
      >
        <button
          type="button"
          onClick={() => { if (!dragged.current) onOpen(); }}
          className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        >
          <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", kind.tint)}>
            <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className={cn("truncate text-[14.5px] leading-snug", unread ? "font-medium text-foreground" : "text-foreground/75")}>{title}</span>
              <span className={cn("shrink-0 text-[12px] tabular-nums", unread ? "font-medium text-[#017D58] dark:text-[#2FB585]" : "text-muted-foreground")}>{when}</span>
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-3">
              <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{detail}</span>
              {unread && <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-[#017D58] dark:bg-[#2FB585]" />}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete notification"
          className="hidden size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 md:flex"
        >
          <Trash2 className="size-4" />
        </button>
      </motion.div>
    </motion.li>
  );
}
