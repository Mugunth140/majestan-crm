"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import { AVATAR_PRESETS, presetOf, presetUrl } from "@/lib/avatar-presets";
import { syncStoredUser } from "@/lib/me-api";
import { cn } from "@/lib/utils";
import { photoProblem } from "./profile-photo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
const ACCEPT = "image/jpeg,image/png,image/webp";

/** Upload a photo, or pick one of the ready-made avatars. Saves straight away. */
export function AvatarPicker({ userId, value, onChange, className }: {
  userId: number;
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const preset = presetOf(value);
  const uploaded = !!value && !preset;

  const save = async (key: string, req: () => Promise<Response>) => {
    setBusy(key);
    try {
      const res = await req();
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error || body?.message || "Couldn't save your picture");
      const url: string | null = body.data?.avatar_url ?? null;
      syncStoredUser({ avatar_url: url });
      onChange(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const upload = (file?: File) => {
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return void toast.error(problem);
    const body = new FormData();
    body.append("file", file);
    void save("upload", () => apiFetch(`${API_URL}/users/${userId}/avatar`, { method: "POST", body }));
  };

  const pick = (name: string) => {
    if (name === preset) return;
    void save(name, () => apiFetch(`${API_URL}/users/me/avatar/preset`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    }));
  };

  const tile = "relative aspect-square w-full overflow-hidden rounded-xl outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[#2FB585] active:scale-95";
  const on = "shadow-[0_0_0_2px_#2FB585]";

  return (
    <div role="radiogroup" aria-label="Profile picture" className={cn("grid grid-cols-5 gap-2 sm:grid-cols-6", className)}>
      <button type="button" role="radio" aria-checked={uploaded} aria-label={uploaded ? "Your photo. Upload a different one" : "Upload your photo"}
        onClick={() => input.current?.click()}
        className={cn(tile, "flex flex-col items-center justify-center gap-0.5 border border-dashed border-foreground/25 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/45 hover:text-foreground", uploaded && cn(on, "border-transparent"))}>
        {uploaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value!} alt="" className="absolute inset-0 size-full object-cover" />
        ) : busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : (
          <>
            <Camera className="size-4" />
            <span className="text-[10px] font-medium leading-none">Upload</span>
          </>
        )}
      </button>
      {AVATAR_PRESETS.map((name) => {
        const chosen = name === preset;
        return (
          <button key={name} type="button" role="radio" aria-checked={chosen} aria-label={`Avatar ${AVATAR_PRESETS.indexOf(name) + 1}`}
            onClick={() => pick(name)} disabled={!!busy}
            className={cn(tile, "bg-foreground/[0.05] hover:bg-foreground/[0.09] disabled:cursor-wait", chosen && on)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={presetUrl(name)} alt="" className={cn("size-full p-0.5 transition-opacity", busy && busy !== name && "opacity-60")} />
            {busy === name && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Loader2 className="size-4 animate-spin text-white" /></span>}
            {chosen && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[#2FB585] text-black"><Check className="size-2.5" strokeWidth={3.5} /></span>}
          </button>
        );
      })}
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; upload(f); }} />
    </div>
  );
}
