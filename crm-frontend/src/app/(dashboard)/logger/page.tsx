"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ShieldAlert, Smartphone, Users, Wifi, WifiOff } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type LoggerDevice = {
  id: number;
  name: string;
  email: string;
  role: string;
  last_sync_at: string;
  is_active: boolean;
};

export default function LoggerPage() {
  const [devices, setDevices] = useState<LoggerDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  const fetchDevices = useCallback(async (refreshing = false) => {
    refreshing ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/contact-logs/devices`);
      if (response.status === 403) {
        setIsAllowed(false);
        return;
      }
      const result = await response.json();
      if (response.ok && result.success) {
        setDevices(result.data || []);
        setIsAllowed(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = window.setInterval(() => fetchDevices(true), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchDevices]);

  const activeCount = useMemo(() => devices.filter((device) => device.is_active).length, [devices]);
  const inactiveCount = devices.length - activeCount;

  return (
    <>
      <MobileHeader title="Logger devices" />
      <div className="w-full flex flex-col gap-6 pt-4 lg:p-0 md:h-full">
        <Device desktop={<div className="flex h-[48px] items-center justify-between px-4 md:px-0"><div><h1 className="text-[28px] font-bold tracking-tight">Logger devices</h1><p className="text-sm text-muted-foreground">Native call logger health across your team.</p></div><Button variant="outline" size="sm" onClick={() => fetchDevices(true)} disabled={isRefreshing}><RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />Refresh</Button></div>} mobile={null} />

        {isAllowed === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
            <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
            <h2 className="mt-3 font-semibold">Admin or manager access required</h2>
            <p className="mt-1 text-sm text-muted-foreground">Logger device health is visible only to admins and managers.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Logger installations" value={devices.length} icon={<Smartphone className="h-5 w-5" />} tone="blue" />
              <SummaryCard label="Active in last hour" value={activeCount} icon={<Wifi className="h-5 w-5" />} tone="green" />
              <SummaryCard label="Needs attention" value={inactiveCount} icon={<WifiOff className="h-5 w-5" />} tone="amber" />
            </div>

            <section className="overflow-hidden rounded-2xl border bg-card shadow-sm md:flex-1 md:overflow-y-auto">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Installed logger devices</h2></div>
                <span className="text-xs text-muted-foreground">Active means synced within the last hour</span>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#0052FF]" /></div>
              ) : devices.length === 0 ? (
                <div className="px-6 py-20 text-center"><Smartphone className="mx-auto h-9 w-9 text-muted-foreground/40" /><p className="mt-3 font-medium">No logger installations yet</p><p className="mt-1 text-sm text-muted-foreground">A staff member appears here after their Android app connects to the CRM.</p></div>
              ) : (
                <div className="divide-y divide-border/70">
                  {devices.map((device) => (
                    <div key={device.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${device.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                        {device.is_active ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{device.name}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{device.role}</span></div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{device.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${device.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>{device.is_active ? "Active" : "Offline"}</span>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(device.last_sync_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "blue" | "green" | "amber" }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60",
    amber: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/60",
  };
  return <div className={`rounded-2xl border p-5 ${styles[tone]}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{label}</span>{icon}</div><p className="mt-4 text-3xl font-bold tracking-tight">{value}</p></div>;
}
