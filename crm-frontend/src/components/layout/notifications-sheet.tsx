"use client";

import { Bell, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useNotifications, type Notification } from "@/context/notification-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { timeAgo } from "@/lib/time-ago";

// Notifications drawer, opened from the sidebar.
export function NotificationsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    deleteNotification,
  } = useNotifications();

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    const targetId = n.entity_id || n.lead_id;
    if (targetId) {
      const type = n.entity_type || "leads";
      const route = type === "lead" ? "leads" : type;
      onOpenChange(false);
      router.push(`/${route}/${targetId}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full bg-popover border-l">
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">
              Notifications
              {notifications.length > 0 && (
                <span className="ml-2 text-sm text-muted-foreground font-normal">
                  ({notifications.length})
                </span>
              )}
            </SheetTitle>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[#0052FF]"
                  onClick={markAllRead}
                >
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-red-500"
                  onClick={clearAll}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell size={40} className="text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                No new notifications
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={[
                  "flex items-start gap-3 px-6 py-4 hover:bg-muted/30 transition-colors group cursor-pointer",
                  !n.is_read ? "bg-blue-50/40 dark:bg-blue-950/20" : "",
                ].join(" ")}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex-1 min-w-0">
                  {n.title && (
                    <p
                      className={[
                        "text-sm font-semibold leading-tight",
                        !n.is_read
                          ? "text-foreground"
                          : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {!n.is_read && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0052FF] mr-2 mb-0.5" />
                      )}
                      {n.title}
                    </p>
                  )}
                  {n.message && (
                    <p className="text-[13px] text-muted-foreground mt-1 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  {n.created_at && (
                    <p className="text-xs text-muted-foreground/60 mt-1.5">
                      {timeAgo(n.created_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(n.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-muted-foreground shrink-0"
                  title="Dismiss"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
