"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Device } from "@/components/shared/device";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, RefreshCw, ShieldAlert, Smartphone, WifiOff } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type LoggerDevice = {
  id: number;
  device_id: string;
  staff: { id: number; name: string; email: string; role: string };
  device_model: string;
  android_version: string;
  app_version: string;
  call_log_permission: boolean;
  registered_at: string;
  last_seen_at: string;
  last_sync_attempt_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_count: number;
  last_error: string | null;
  health: "healthy" | "permission_required" | "sync_error" | "awaiting_sync" | "offline";
  is_active: boolean;
};

type LegacyLoggerDevice = Partial<LoggerDevice> & {
  name?: string;
  email?: string;
  role?: string;
  last_sync_at?: string;
};

const HEALTH = {
  healthy: { label: "Healthy", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", hint: "Synced <1h" },
  permission_required: { label: "Permission needed", icon: ShieldAlert, className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", hint: "Grant call access" },
  sync_error: { label: "Sync error", icon: AlertTriangle, className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300", hint: "Latest sync failed" },
  awaiting_sync: { label: "Awaiting sync", icon: CircleHelp, className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", hint: "No sync yet" },
  offline: { label: "Offline", icon: WifiOff, className: "bg-muted text-muted-foreground", hint: "No check-in <1h" },
};

function ago(value: string | null) {
  return value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : "Never";
}

function normalizeDevice(value: LegacyLoggerDevice): LoggerDevice {
  const lastSeen = value.last_seen_at || value.last_sync_at || new Date(0).toISOString();
  const hasPermission = value.call_log_permission ?? true;
  const health = value.health || (
    !hasPermission ? "permission_required" : value.is_active ? "healthy" : "offline"
  );
  return {
    id: value.id || 0,
    device_id: value.device_id || `legacy-${value.id || value.email || "unknown"}`,
    staff: value.staff || {
      id: value.id || 0,
      name: value.name || "Unknown staff",
      email: value.email || "No email available",
      role: value.role || "Staff",
    },
    device_model: value.device_model || "Unknown device",
    android_version: value.android_version || "Unknown Android version",
    app_version: value.app_version || "Legacy logger",
    call_log_permission: hasPermission,
    registered_at: value.registered_at || lastSeen,
    last_seen_at: lastSeen,
    last_sync_attempt_at: value.last_sync_attempt_at || value.last_sync_at || null,
    last_successful_sync_at: value.last_successful_sync_at || (value.is_active ? value.last_sync_at || null : null),
    last_sync_count: value.last_sync_count || 0,
    last_error: value.last_error || null,
    health,
    is_active: value.is_active ?? health === "healthy",
  };
}

export default function LoggerPage() {
  const [devices, setDevices] = useState<LoggerDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/contact-logs/devices`);
      if (response.status === 403) return setIsAllowed(false);
      const body = await response.json();
      if (response.ok && body.success) {
        setDevices((body.data || []).map(normalizeDevice));
        setIsAllowed(true);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(true), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const totals = useMemo(() => ({
    enrolled: devices.length,
    healthy: devices.filter((device) => device.health === "healthy").length,
    attention: devices.filter((device) => device.health !== "healthy").length,
  }), [devices]);

  return (
    <>
      <MobileHeader title="Logger devices" />
      <main className="flex w-full flex-col gap-6 pt-4 lg:p-0 md:h-full">
        <Device desktop={<div className="flex h-[48px] items-center justify-between px-4 md:px-0"><div><h1 className="text-[28px] font-bold tracking-tight">Logger Control</h1></div><Button variant="outline" size="sm" disabled={isRefreshing} onClick={() => load(true)}><RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />Refresh</Button></div>} mobile={null} />

        {isAllowed === false ? <AccessDenied /> : <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Summary label="Registered devices" value={totals.enrolled} />
            <Summary label="Working normally" value={totals.healthy} />
            <Summary label="Needs attention" value={totals.attention} />
          </div>
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm md:flex-1 md:overflow-y-auto">
            <div className="flex flex-col justify-between gap-2 border-b px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Registered logger devices</h2></div><span className="text-xs text-muted-foreground">Auto-refreshes every minute</span></div>
            {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#0052FF]" /></div> : devices.length === 0 ? <EmptyState /> : <div className="overflow-x-auto"><div className="lg:min-w-[980px]">
              <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(145px,0.9fr)_minmax(125px,0.85fr)_minmax(125px,0.85fr)_minmax(95px,0.65fr)_minmax(180px,1.1fr)] gap-4 border-b bg-muted/20 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:grid">
                <span>Staff / device</span><span>Health</span><span>Last check-in</span><span>Last sync</span><span>Calls</span><span>Access / build</span>
              </div>
              <div className="divide-y divide-border/70">{devices.map((device) => <DeviceRow key={device.id} device={device} />)}</div>
            </div></div>}
          </section>
        </>}
      </main>
    </>
  );
}

function DeviceRow({ device }: { device: LoggerDevice }) {
  // During a rolling deploy an older API response may not yet include health.
  // Derive a conservative status instead of allowing one incomplete record to
  // break the whole Logger screen.
  const health = HEALTH[device.health] ? device.health : (
    !device.call_log_permission
      ? "permission_required"
      : device.last_error
        ? "sync_error"
        : device.last_successful_sync_at
          ? "healthy"
          : "awaiting_sync"
  );
  const status = HEALTH[health];
  const Icon = status.icon;
  const staff = device.staff;
  return <article className="px-5 py-5 transition-colors hover:bg-muted/25">
    <div className="grid gap-5 lg:grid-cols-[minmax(220px,1.5fr)_minmax(145px,0.9fr)_minmax(125px,0.85fr)_minmax(125px,0.85fr)_minmax(95px,0.65fr)_minmax(180px,1.1fr)] lg:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${status.className}`}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{staff?.name || "Unknown staff"}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{staff?.role || "Staff"}</span></div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{staff?.email || "No email available"}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{device.device_model}</p>
        </div>
      </div>

      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">Health</p><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}><Icon className="h-3.5 w-3.5" />{status.label}</span><p className="mt-1 text-xs text-muted-foreground">{status.hint}</p></div>

      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">Last check-in</p><p className="text-sm font-medium text-foreground">{ago(device.last_seen_at)}</p></div>
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">Last sync</p><p className="text-sm font-medium text-foreground">{ago(device.last_successful_sync_at)}</p></div>
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">Calls</p><p className="text-sm font-medium text-foreground">{device.last_sync_count}</p></div>

      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:hidden">Access / build</p><p className={`text-xs font-semibold ${device.call_log_permission ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{device.call_log_permission ? "Call-log access granted" : "Call-log access not granted"}</p><p className="mt-1 text-xs text-muted-foreground">App {device.app_version} · Android {device.android_version}</p></div>
    </div>
    {device.last_error && <p className="mt-4 truncate rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300"><strong>Error:</strong> {device.last_error}</p>}
  </article>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p></div>; }
function EmptyState() { return <div className="px-6 py-24 text-center"><Smartphone className="mx-auto h-10 w-10 text-muted-foreground/35" /><h2 className="mt-4 font-semibold">No logger devices have registered</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Install the APK, sign in with a staff CRM account, and ensure it can reach the production API. The device will then appear here.</p></div>; }
function AccessDenied() { return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/60 dark:bg-amber-950/20"><ShieldAlert className="mx-auto h-8 w-8 text-amber-600" /><h2 className="mt-3 font-semibold">Admin or manager access required</h2><p className="mt-1 text-sm text-muted-foreground">Device health is restricted to admins and managers.</p></div>; }
