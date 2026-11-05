"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { notificationHref, notificationSentence } from "@/lib/notification-text";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface Notification {
  id: number;
  title?: string;
  message?: string;
  type?: string;
  entity_id?: number | null;
  entity_type?: string | null;
  lead_id?: number; // legacy support
  created_at?: string;
  is_read?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refresh: () => void;
}

// Already alerted, so a notification sent again by the stream alerts once.
const alerted = new Set<number>();

/** A pop-up in the app, and a desktop alert too while the CRM is in the background. */
function alertUser(n: Notification, go: (href: string) => void) {
  if (alerted.has(n.id)) return;
  alerted.add(n.id);
  const href = notificationHref(n);
  const text = notificationSentence(n);
  toast(n.title || "Notification", {
    description: text,
    duration: 10000,
    action: href ? { label: "Open", onClick: () => go(href) } : undefined,
  });
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return;
  if (window.Notification.permission !== "granted" || !document.hidden) return;
  const desktop = new window.Notification(n.title || "Notification", { body: text, tag: `crm-${n.id}` });
  desktop.onclick = () => {
    window.focus();
    if (href) go(href);
    desktop.close();
  };
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      // In a real scenario, this would use the user token.
      const res = await apiFetch(`${API_URL}/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNotifications([...data.data].sort((a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ));
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    let token = "";
    if (typeof window !== "undefined") {
      token = localStorage.getItem("crm_token") || "";
    }
    
    // The stream sends only what arrived since its last check, so add those
    // to the list, and alert the user to each follow-up that just came due.
    let url = `${API_URL}/notifications/stream`;
    if (token) url += `?token=${token}`;

    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || !Array.isArray(data.notifications) || data.notifications.length === 0) return;
        const incoming: Notification[] = data.notifications;
        incoming.filter((n) => n.type === "followup_reminder").forEach((n) => alertUser(n, router.push));
        setNotifications((prev) => {
          const known = new Set(prev.map((n) => n.id));
          const fresh = incoming.filter((n) => !known.has(n.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch {}
    };

    return () => {
      eventSource.close();
    };
  }, [fetchNotifications, router]);

  const markRead = async (id: number) => {
    try {
      await apiFetch(`${API_URL}/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiFetch(`${API_URL}/notifications/read-all`, { method: "PATCH", credentials: "include" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const clearAll = async () => {
    try {
      await apiFetch(`${API_URL}/notifications/all`, { method: "DELETE", credentials: "include" });
      setNotifications([]);
      toast.success("All notifications cleared");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiFetch(`${API_URL}/notifications/${id}`, { method: "DELETE", credentials: "include" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const contextValue = useMemo(() => ({
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    deleteNotification,
    refresh: fetchNotifications
  }), [notifications, unreadCount, fetchNotifications]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
