import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Pull a readable message out of an API error body (Nest sends a string or a list). */
function errorMessage(data: unknown): string | undefined {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" && message ? message : undefined;
}

/**
 * Kanban drop: show the row in its new column at once, save it, and put it
 * back (with the server's reason) if the save is refused.
 */
export async function moveRow<T>({
  setRows,
  row,
  same,
  patch,
  request,
  success,
}: {
  setRows: Dispatch<SetStateAction<T[]>>;
  row: T;
  /** Identifies the moved row in the list. */
  same: (a: T, b: T) => boolean;
  patch: Partial<T>;
  /** Path under the API root, e.g. `/hr/12`. */
  request: { path: string; method: "PATCH" | "PUT"; body: unknown };
  success: string;
}): Promise<boolean> {
  setRows((rows) => rows.map((r) => (same(r, row) ? { ...r, ...patch } : r)));
  try {
    const res = await apiFetch(`${API_URL}${request.path}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || (data as { success?: boolean } | null)?.success === false) {
      throw new Error(errorMessage(data) ?? "Couldn't update the status");
    }
    toast.success(success);
    return true;
  } catch (error) {
    setRows((rows) => rows.map((r) => (same(r, row) ? row : r)));
    toast.error(error instanceof Error ? error.message : "Couldn't update the status");
    return false;
  }
}

/** Keep an on/off flag in the type the API sent it as (1/0 or true/false). */
export const activeValue = (current: unknown, on: boolean) => (typeof current === "number" ? (on ? 1 : 0) : on);
