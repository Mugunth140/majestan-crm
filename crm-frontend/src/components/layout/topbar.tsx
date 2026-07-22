"use client";

import { Bell, Moon, Sun, UserCircle, LogOut, X, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Notification {
  id: number;
  title?: string;
  message?: string;
  lead_id?: number;
  created_at?: string;
  is_read?: boolean;
}

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

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-close user dropdown after a certain duration (e.g., 4 seconds)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isDropdownOpen) {
      timeoutId = setTimeout(() => {
        setIsDropdownOpen(false);
      }, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [isDropdownOpen]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        // Newest first
        setNotifications([...data.data].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ));
      }
    } catch {
      // silently ignore notification fetch errors
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  const handleDeleteNotification = async (id: number, leadId?: number) => {
    try {
      await fetch(`${API_URL}/notifications/${id}`, { method: "DELETE", credentials: "include" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (leadId) {
        router.push(`/leads/${leadId}`);
        setNotifOpen(false);
      }
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch(`${API_URL}/notifications/all`, { method: "DELETE", credentials: "include" });
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="absolute right-8 top-8 z-50 flex items-center justify-end bg-transparent pointer-events-none">
      <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1.5 shadow-sm pointer-events-auto">
        {mounted && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="sr-only">Toggle theme</span>
            {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </Button>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full relative"
            onClick={() => {
              setNotifOpen((o) => !o);
              if (!notifOpen) fetchNotifications();
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <span className="sr-only">Toggle notifications</span>
          </Button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-100">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/10">
                <span className="font-semibold text-sm text-foreground">
                  Notifications
                  {notifications.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({notifications.length})</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-red-500 px-2"
                      onClick={handleClearAll}
                    >
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setNotifOpen(false)}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bell size={28} className="text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (n.lead_id) {
                          handleDeleteNotification(n.id, n.lead_id);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        {n.title && (
                          <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
                            {n.title}
                          </p>
                        )}
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        {n.created_at && (
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {timeAgo(n.created_at)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 text-muted-foreground shrink-0 mt-0.5"
                        title="Dismiss"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 rounded-full">
            <UserCircle size={20} />
            <span className="sr-only">Toggle user menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 mr-10">
            <div className="px-2 py-1.5 text-sm font-semibold text-center border-b mb-1 text-muted-foreground">My Account</div>
            <DropdownMenuItem className="text-center justify-center">Profile</DropdownMenuItem>
            <DropdownMenuItem className="text-center justify-center">Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex justify-center text-red-600 focus:text-white focus:bg-red-600 dark:focus:bg-red-800  dark:focus:text-white cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
