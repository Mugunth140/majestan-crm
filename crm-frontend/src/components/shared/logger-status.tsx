"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { PhoneCall, AlertCircle } from "lucide-react";

interface LoggerStatusProps {
  variant?: "full" | "dot";
}

export function LoggerStatus({ variant = "full" }: LoggerStatusProps) {
  const [isActive, setIsActive] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await apiFetch("/api/v1/auth/me");
        const data = await res.json();
        if (data?.data?.device_last_sync_at) {
          const lastSync = new Date(data.data.device_last_sync_at);
          const now = new Date();
          const diffMins = (now.getTime() - lastSync.getTime()) / 60000;
          setIsActive(diffMins < 60);
        } else {
          setIsActive(false);
        }
      } catch {
        setIsActive(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5 * 60000);
    return () => clearInterval(interval);
  }, []);

  if (isActive === null) return null;

  if (variant === "dot") {
    return (
      <div className="relative flex items-center justify-center" title={isActive ? "Logger Active" : "Logger Disconnected"}>
        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
        {isActive && (
          <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-medium ${isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
      {isActive ? <PhoneCall size={14} /> : <AlertCircle size={14} />}
      <span className="hidden sm:inline">{isActive ? "Logger Active" : "Logger Disconnected"}</span>
    </div>
  );
}
