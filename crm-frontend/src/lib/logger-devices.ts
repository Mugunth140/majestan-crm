import type { StatusTone } from "@/components/tables/cells";

/** A phone running the call logger app, as GET /contact-logs/devices returns it. */
export type LoggerDevice = {
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
  health: DeviceHealth;
  is_active: boolean;
};

export type DeviceHealth = "healthy" | "permission_required" | "sync_error" | "awaiting_sync" | "offline";

type LegacyLoggerDevice = Partial<LoggerDevice> & {
  name?: string;
  email?: string;
  role?: string;
  last_sync_at?: string;
};

export const DEVICE_HEALTH: Record<DeviceHealth, { label: string; tone: StatusTone; hint: string }> = {
  healthy: { label: "Healthy", tone: "green", hint: "Synced in the last hour" },
  permission_required: { label: "Permission needed", tone: "amber", hint: "Call-log access isn't granted on the phone" },
  sync_error: { label: "Sync error", tone: "red", hint: "The latest sync failed" },
  awaiting_sync: { label: "Awaiting sync", tone: "blue", hint: "Signed in, no calls synced yet" },
  offline: { label: "Offline", tone: "gray", hint: "No check-in in the last hour" },
};

/** Fills gaps in older API responses (before health and staff were added). */
export function normalizeDevice(value: LegacyLoggerDevice): LoggerDevice {
  const lastSeen = value.last_seen_at || value.last_sync_at || new Date(0).toISOString();
  const hasPermission = value.call_log_permission ?? true;
  const health = value.health || (!hasPermission ? "permission_required" : value.is_active ? "healthy" : "offline");
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
    android_version: value.android_version || "Unknown",
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

/**
 * The device's health. During a rolling deploy an older API may send an
 * unknown value: derive a conservative one instead of breaking the screen.
 */
export function healthOf(device: LoggerDevice): DeviceHealth {
  if (DEVICE_HEALTH[device.health]) return device.health;
  if (!device.call_log_permission) return "permission_required";
  if (device.last_error) return "sync_error";
  return device.last_successful_sync_at ? "healthy" : "awaiting_sync";
}

/** Loads every registered device; `null` when the viewer isn't allowed to see them. */
export async function fetchLoggerDevices(apiFetch: (url: string) => Promise<Response>, apiUrl: string): Promise<LoggerDevice[] | null> {
  const response = await apiFetch(`${apiUrl}/contact-logs/devices`);
  if (response.status === 403) return null;
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Couldn't load the devices");
  return (body.data || []).map(normalizeDevice);
}
