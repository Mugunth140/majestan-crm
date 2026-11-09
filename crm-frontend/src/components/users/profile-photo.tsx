"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/record/feed";
import { apiFetch } from "@/lib/api-fetch";
import { refreshStaffPhotos } from "@/lib/staff-photos";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/** Why a picked file can't be a profile photo, or null when it can. */
export const photoProblem = (file: File) =>
  !ACCEPT.split(",").includes(file.type) ? "Choose a JPEG, PNG or WebP photo" : file.size > MAX_BYTES ? "The photo must be 5 MB or smaller" : null;

/** Keeps the signed-in user's stored copy in step, so the sidebar shows the new photo. */
function rememberOwnPhoto(userId: number, url: string | null) {
  try {
    const me = JSON.parse(localStorage.getItem("crm_user") || "{}");
    if (Number(me?.id) !== userId) return;
    localStorage.setItem("crm_user", JSON.stringify({ ...me, avatar_url: url }));
    window.dispatchEvent(new Event("crm-user-updated"));
  } catch { /* storage unavailable: the photo still shows after the next sign-in */ }
}

/**
 * A user's photo that changes it when clicked: upload a new one or remove it.
 * Without `editable` it's just the photo.
 */
export function ProfilePhoto({ userId, name, src, editable, onChange, className }: {
  userId: number;
  name: string;
  src?: string | null;
  editable?: boolean;
  onChange?: (url: string | null) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const send = async (file?: File) => {
    setBusy(true);
    try {
      let body: FormData | undefined;
      if (file) { body = new FormData(); body.append("file", file); }
      // Upload with a file; without one, remove the current photo.
      const res = await apiFetch(`${API_URL}/users/${userId}/avatar${file ? "" : "/remove"}`, { method: "POST", body });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) throw new Error((Array.isArray(result?.message) ? result.message.join(", ") : result?.message ?? result?.error) || "Couldn't change the photo");
      const url: string | null = result.data?.avatar_url ?? null;
      rememberOwnPhoto(userId, url);
      refreshStaffPhotos();
      onChange?.(url);
      toast.success(url ? "Photo updated" : "Photo removed");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't change the photo");
    } finally {
      setBusy(false);
    }
  };
  const pick = (file?: File) => {
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return void toast.error(problem);
    void send(file);
  };

  const photo = <Avatar name={name} src={src} className={cn("h-12 w-12 text-[15px]", className)} />;
  if (!editable) return photo;

  const overlay = (
    <span className={cn("absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity", busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
    </span>
  );
  const fileInput = (
    <input ref={input} type="file" accept={ACCEPT} className="hidden"
      onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; pick(file); }} />
  );

  // No photo yet: one click opens the file picker.
  if (!src) {
    return (
      <>
        <button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label="Add a profile photo"
          className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {photo}{overlay}
        </button>
        {fileInput}
      </>
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger disabled={busy} aria-label="Change profile photo"
          render={<button type="button" className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>
          {photo}{overlay}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => input.current?.click()} className="gap-2 text-[14px]"><Upload className="h-4 w-4" /> Upload new photo</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void send()} className="gap-2 text-[14px] text-red-600 dark:text-red-400"><Trash2 className="h-4 w-4" /> Remove photo</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {fileInput}
    </>
  );
}
