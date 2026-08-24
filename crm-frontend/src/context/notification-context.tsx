"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
    
    // We can just use an EventSource
    // Note: If EventSource doesn't support headers directly in browser,
    // some implementations use URL params for auth.
    // Assuming backend accepts it or relies on cookies, but given it's jwt-auth.guard, 
    // EventSource doesn't send Authorization headers natively.
    // For simplicity we will still poll if SSE auth is complex, OR wait! 
    // The user explicitly asked:
    // "replace interval with EventSource". 
    // Let's implement it.
    
    let url = `${API_URL}/notifications/stream`;
    if (token) url += `?token=${token}`;
    
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.notifications) {
          setNotifications(data.notifications);
        }
      } catch (err) {}
    };

    return () => {
      eventSource.close();
    };
  }, [fetchNotifications]);

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
