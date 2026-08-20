"use client";

import { Bell, Moon, Sun, UserCircle, LogOut, X, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotifications } from "@/context/notification-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Topbar() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    deleteNotification,
  } = useNotifications();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isDropdownOpen) {
      timeoutId = setTimeout(() => setIsDropdownOpen(false), 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [isDropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markRead(n.id);
    const targetId = n.entity_id || n.lead_id;
    if (targetId) {
      const type = n.entity_type || "leads";
      const route = type === "lead" ? "leads" : type;
      router.push(`/${route}/${targetId}`);
    }
  };

  return (
    <header className="hidden md:flex absolute right-8 top-8 z-50 items-center justify-end bg-transparent pointer-events-none">
      <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1.5 shadow-sm pointer-events-auto">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <span className="sr-only">Toggle theme</span>
            {theme === "dark" ? (
              <Sun size={18} strokeWidth={2} />
            ) : (
              <Moon size={18} strokeWidth={2} />
            )}
          </Button>
        )}

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full relative"
              />
            }
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Toggle notifications</span>
          </SheetTrigger>
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

        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9 rounded-full">
            <UserCircle size={20} />
            <span className="sr-only">Toggle user menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 mr-10">
            <div className="px-2 py-1.5 text-sm font-semibold text-center border-b mb-1 text-muted-foreground">
              My Account
            </div>
            <DropdownMenuItem className="text-center justify-center">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-center justify-center">
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex justify-center text-red-600 focus:text-white focus:bg-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
