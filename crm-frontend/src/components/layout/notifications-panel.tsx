"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCheck, X } from "lucide-react";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { useNotifications, type Notification } from "@/context/notification-context";
import { notificationHref, reminderParts } from "@/lib/notification-text";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";

// Reminder avatars take the module's sidebar colour.
const MODULE_TILES: Record<string, string> = {
  lead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  inbound: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  agent: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  hr: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const iconButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/** Whether the browser can show desktop alerts and hasn't been asked yet. */
function useDesktopAlertsAsk() {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only API, read after mount
    setAsk(typeof Notification !== "undefined" && Notification.permission === "default");
  }, []);
  const enable = () => Notification.requestPermission().finally(() => setAsk(false));
  return { ask, enable };
}

function Row({ n, onOpen, onDismiss }: { n: Notification; onOpen: (n: Notification) => void; onDismiss: (id: number) => void }) {
  const reminder = reminderParts(n);
  const href = notificationHref(n);
  const body = (
    <>
      <div className="mt-1 flex shrink-0 items-center gap-2.5">
        <span className={cn("size-[5px] rounded-full", n.is_read ? "bg-transparent" : "bg-foreground")} />
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full",
            reminder ? MODULE_TILES[n.entity_type ?? ""] ?? MODULE_TILES.lead : "bg-muted text-muted-foreground",
          )}
        >
          {reminder ? <CalendarClock className="size-3.5" strokeWidth={2} /> : <Bell className="size-3.5" strokeWidth={2} />}
        </span>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-[13px] leading-5 text-muted-foreground">
          {reminder ? (
            <>
              Follow-up with <span className="font-medium text-foreground">{reminder.name}</span> is due at{" "}
              <span className="font-medium text-foreground">{reminder.time}</span>
            </>
          ) : (
            <>
              {n.title && <span className="font-medium text-foreground">{n.title}</span>} {n.message}
            </>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {reminder && <>{reminder.module} · </>}
          {timeAgo(n.created_at)}
        </div>
      </div>
    </>
  );
  const rowClass = "flex w-full items-start gap-2.5 py-2.5 pl-4 pr-10 text-left";
  return (
    <div className="group/n relative transition-colors hover:bg-muted/60">
      {href ? (
        <Link href={href} onClick={() => onOpen(n)} className={rowClass}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={() => onOpen(n)} className={rowClass}>
          {body}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={() => onDismiss(n.id)}
        className={cn(iconButton, "absolute right-2 top-2 size-6 opacity-0 focus-visible:opacity-100 group-hover/n:opacity-100")}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * The notifications list, opened from the sidebar: a column that slides out
 * beside it (as in Frappe CRM) rather than a drawer over the page.
 */
export function NotificationsPanel({ open, onClose, toggleId }: { open: boolean; onClose: () => void; toggleId: string }) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } = useNotifications();
  const panel = useRef<HTMLDivElement>(null);
  const alerts = useDesktopAlertsAsk();

  useEffect(() => {
    if (!open) return;
    // Close on a click anywhere else, except the sidebar button that toggles it.
    const away = (e: PointerEvent) => {
      const target = e.target as Element;
      if (panel.current?.contains(target) || target.closest?.(`#${toggleId}`)) return;
      onClose();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose, toggleId]);

  if (!open) return null;

  const openRow = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (notificationHref(n)) onClose();
  };

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Notifications"
      className="absolute left-full top-0 z-40 flex h-full w-[350px] flex-col border-r bg-background shadow-[8px_0_8px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-left-2 duration-200 dark:shadow-[8px_0_8px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-[15px] font-medium text-foreground">Notifications</h2>
        <div className="flex gap-1">
          {unreadCount > 0 && (
            <Tooltip
              content="Mark all as read"
              render={
                <button type="button" aria-label="Mark all as read" onClick={markAllRead} className={iconButton}>
                  <CheckCheck className="size-4" />
                </button>
              }
            />
          )}
          <Tooltip
            content="Close"
            render={
              <button type="button" aria-label="Close" onClick={onClose} className={iconButton}>
                <X className="size-4" />
              </button>
            }
          />
        </div>
      </div>

      {notifications.length ? (
        <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
          {notifications.map((n) => (
            <Row key={n.id} n={n} onOpen={openRow} onDismiss={deleteNotification} />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-8 text-center">
          <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" />
          </span>
          <p className="text-[14px] font-medium text-foreground">No new notifications</p>
          <p className="text-[13px] text-muted-foreground">You have no new notifications</p>
        </div>
      )}

      {alerts.ask && (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
          <span>Get a desktop alert when a follow-up is due.</span>
          <button type="button" onClick={alerts.enable} className="shrink-0 font-medium text-foreground hover:underline">
            Turn on
          </button>
        </div>
      )}
    </div>
  );
}
