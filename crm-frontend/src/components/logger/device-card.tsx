"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Smartphone } from "lucide-react";
import { StatusCell } from "@/components/tables/cells";
import { DEVICE_HEALTH, healthOf, type LoggerDevice } from "@/lib/logger-devices";
import { feedFullTime, feedStamp } from "@/lib/feed-time";
import { cn } from "@/lib/utils";

/** The device's health as a tinted pill; the hover title says what it means. */
export function HealthPill({ device }: { device: LoggerDevice }) {
  const health = DEVICE_HEALTH[healthOf(device)];
  return <span title={health.hint}><StatusCell status={health.label} tone={health.tone} /></span>;
}

/** When something last happened: "40 mins ago", "4:50 PM", "Yesterday, 4:50 PM"; "Never" when it hasn't. */
export function Stamp({ value, className }: { value: string | null; className?: string }) {
  if (!value) return <span className={cn("text-muted-foreground", className)}>Never</span>;
  const at = new Date(value);
  return <time dateTime={at.toISOString()} title={feedFullTime(at)} className={cn("whitespace-nowrap", className)}>{feedStamp(at)}</time>;
}

const known = (v?: string | null) => (v && !/^unknown/i.test(v) ? v : null);

/** "Pixel 7 · Android 14 · App 1.4.0"; the app sends "Unknown …" when it can't tell, which is left out. */
export const deviceLine = (d: LoggerDevice) =>
  [known(d.device_model), known(d.android_version) && `Android ${d.android_version}`, known(d.app_version) && `App ${d.app_version}`]
    .filter(Boolean).join(" · ") || "Device details not reported";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[14px] text-foreground">{children}</p>
    </div>
  );
}

/** One device as a card: phones on the Logger page, and a user's Devices tab. */
export function DeviceCard({ device, title, onOpen }: { device: LoggerDevice; title?: ReactNode; onOpen?: () => void }) {
  return (
    <article
      onClick={onOpen}
      className={cn("rounded-xl border bg-card p-4", onOpen && "cursor-pointer transition-colors hover:bg-muted/40")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground"><Smartphone className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-foreground">{title ?? (known(device.device_model) || "Phone")}</p>
          <p className="truncate text-[13px] text-muted-foreground">{deviceLine(device)}</p>
        </div>
        <HealthPill device={device} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Item label="Last check-in"><Stamp value={device.last_seen_at} /></Item>
        <Item label="Last sync"><Stamp value={device.last_successful_sync_at} /></Item>
        <Item label="Calls in last sync">{device.last_sync_count}</Item>
        <Item label="Call-log access">
          <span className={device.call_log_permission ? "" : "text-amber-700 dark:text-amber-400"}>{device.call_log_permission ? "Granted" : "Not granted"}</span>
        </Item>
      </div>
      {device.last_error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{device.last_error}</span>
        </p>
      )}
    </article>
  );
}
