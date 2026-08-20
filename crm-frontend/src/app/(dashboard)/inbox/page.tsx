"use client";

import { useNotifications } from "@/context/notification-context";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ArrowBigDownDash, Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Device } from "@/components/shared/device";
import { MobileHeader } from "@/components/layout/mobile-header";
import { useState } from "react";

function destination(notification: any): string | null {
  if (!notification.entity_id) return null;
  if (notification.entity_type === "lead") return `/leads/${notification.entity_id}`;
  if (notification.entity_type === "inbound") return `/inbound/${notification.entity_id}`;
  if (notification.entity_type === "agent") return `/agent-network/${notification.entity_id}`;
  return null;
}

export default function InboxPage() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } = useNotifications();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarkAllRead = async () => {
    setIsUpdating(true);
    await markAllRead();
    setIsUpdating(false);
  };

  const dismiss = async (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    await deleteNotification(id);
  };

  const openItem = async (item: any) => {
    if (!item.is_read) await markRead(item.id);
    const href = destination(item);
    if (href) router.push(href);
  };

  return (
    <>
      <MobileHeader title="Inbox" />
      <div className="flex w-full flex-col gap-5 pt-4 lg:p-0 md:h-full">
        <Device 
          desktop={
            <div className="flex h-[48px] items-center justify-between px-4 md:px-0">
              <div>
                <h1 className="text-[28px] font-bold tracking-tight">Inbox</h1>
                <p className="text-sm text-muted-foreground">Assignments, follow-ups, and updates that need your attention.</p>
              </div>
              <InboxActions unreadCount={unreadCount} isUpdating={isUpdating} onMarkAllRead={handleMarkAllRead} />
            </div>
          } 
          mobile={null} 
        />

        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm md:flex-1 md:overflow-y-auto">
          <div className="flex items-center justify-between border-b px-5 py-4 md:hidden">
            <div className="flex items-center gap-2">
              <ArrowBigDownDash className="h-5 w-5 text-[#0052FF]" />
              <span className="font-semibold">Inbox</span>
              {unreadCount > 0 && <span className="rounded-full bg-[#0052FF] px-2 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
            </div>
            <InboxActions unreadCount={unreadCount} isUpdating={isUpdating} onMarkAllRead={handleMarkAllRead} />
          </div>

          {notifications.length === 0 ? (
            <div className="px-6 py-24 text-center">
              <Bell className="mx-auto h-10 w-10 text-muted-foreground/35" />
              <h2 className="mt-4 font-semibold">Your inbox is clear</h2>
              <p className="mt-1 text-sm text-muted-foreground">New assignments and reminders will land here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {notifications.map((item) => (
                <button key={item.id} onClick={() => openItem(item)} className={`group flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/35 ${!item.is_read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
                  <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${!item.is_read ? "bg-[#0052FF] text-white" : "bg-muted text-muted-foreground"}`}>
                    <ArrowBigDownDash className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm leading-tight ${!item.is_read ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>{item.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : ""}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.message}</p>
                  </div>
                  <span role="button" aria-label="Dismiss notification" onClick={(event) => dismiss(event, item.id)} className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function InboxActions({ unreadCount, isUpdating, onMarkAllRead }: { unreadCount: number; isUpdating: boolean; onMarkAllRead: () => void }) {
  if (!unreadCount) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={isUpdating} className="h-8 text-xs text-[#0052FF] hover:text-[#0052FF]">
      <CheckCheck className={`mr-1.5 h-3.5 w-3.5 ${isUpdating ? "animate-pulse" : ""}`} />Mark all read
    </Button>
  );
}