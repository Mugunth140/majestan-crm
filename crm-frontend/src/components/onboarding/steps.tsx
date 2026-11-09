"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AvatarPicker } from "@/components/users/avatar-picker";
import { Avatar } from "@/components/record/feed";
import { PrismarkAssembly } from "@/components/brand/prismark-loader";
import { ThemePreview } from "@/components/settings/theme-preview";
import { Input } from "@/components/ui/input";
import { meApi, type Me } from "@/lib/me-api";
import { APP_VERSION, type Release } from "@/lib/release";
import { cn } from "@/lib/utils";
import { ShotStage } from "./shot-stage";
import { slideById, slidesFor } from "./tour-data";
import type { Step } from "./player";

export interface ChecklistItem { key: string; title: string; detail: string; href: string; done: boolean }

const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";

/** Profile photo and phone, held outside the step so the player's Next button can save them. */
function useProfileDraft() {
  const [me, setMe] = useState<Me | null>(null);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  useEffect(() => {
    meApi.get().then((m) => { setMe(m); setPhone(m.phone ?? ""); setWhatsapp(m.whatsapp_no ?? ""); }).catch(() => {});
  }, []);
  const save = async () => {
    if (!me) return true;
    const patch: Record<string, string> = {};
    if (phone.trim() !== (me.phone ?? "")) patch.phone = phone.trim();
    if (whatsapp.trim() !== (me.whatsapp_no ?? "")) patch.whatsapp_no = whatsapp.trim();
    if (!Object.keys(patch).length) return true;
    try {
      setMe(await meApi.update(patch));
      return true;
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save your number");
      return false;
    }
  };
  return { me, setMe, phone, setPhone, whatsapp, setWhatsapp, save };
}

function Badge({ unlocked, done, total }: { unlocked: boolean; done: number; total: number }) {
  return (
    <div className="flex flex-col items-center">
    <div className="ob-badge relative mx-auto flex size-40 items-center justify-center md:size-52">
      <div className={cn("absolute inset-0 rounded-full", unlocked ? "bg-[radial-gradient(circle_at_30%_25%,#5FE0B0,#0B8F66_55%,#05543C)]" : "bg-[radial-gradient(circle_at_30%_25%,#3a3a3a,#1d1d1d_60%,#111)]")} />
      <div className="absolute inset-[7%] rounded-full border-2 border-white/25" />
      <div className="absolute inset-0 overflow-hidden rounded-full"><div className="ob-shine absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-md" /></div>
      <div className="relative flex flex-col items-center text-white">
        <Trophy className="size-12 md:size-16" strokeWidth={1.5} />
        <span className="mt-2 text-[12px] font-semibold uppercase tracking-[0.14em] md:text-[13px]">Getting started</span>
      </div>
    </div>
    <p className="mt-5 text-[13px] text-muted-foreground">{unlocked ? "Unlocked" : `${done} of ${total} steps done`}</p>
    <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-foreground/10">
      <div className="h-full rounded-full bg-[#2FB585] transition-[width] duration-700" style={{ width: `${(done / total) * 100}%` }} />
    </div>
    </div>
  );
}

function ChecklistList({ items }: { items: ChecklistItem[] | null }) {
  if (!items) return <div className="mt-5 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-foreground/5" />)}</div>;
  return (
    <ul className="mt-5 space-y-1.5">
      {items.map((i) => (
        <li key={i.key} className="flex items-start gap-3 rounded-lg bg-foreground/[0.035] px-3 py-2.5">
          <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", i.done ? "bg-[#2FB585] text-black" : "border border-foreground/25")}>
            {i.done && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-[14px]", i.done ? "text-muted-foreground line-through decoration-foreground/30" : "text-foreground")}>{i.title}</span>
            <span className="block text-[12.5px] text-muted-foreground">{i.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Every step of the first-time tour: welcome, profile, theme, the product slides, then first steps. */
export function useWelcomeSteps(userName: string, role: string): Step[] {
  const draft = useProfileDraft();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const picked = theme === "light" ? "light" : "dark";
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const loadChecklist = () => meApi.checklist().then((r) => setChecklist(r.items)).catch(() => setChecklist([]));
  useEffect(() => { void loadChecklist(); }, []);

  const welcome: Step = {
    id: "welcome",
    eyebrow: "Welcome",
    title: `Hi ${firstName(userName)}, the CRM has been redesigned`,
    visual: (
      <div className="flex flex-col items-center py-10 text-center md:py-0">
        <PrismarkAssembly className="size-24 text-[#017D58] md:size-36 dark:text-[#2FB585]" />
        <p className="ob-rise mt-8 text-[26px] font-semibold tracking-[-0.02em] text-foreground md:text-[34px]">Prismark CRM</p>
        <p className="ob-rise mt-1 text-[14px] text-muted-foreground md:text-[15px]" style={{ animationDelay: "1.05s" }}>Redesigned for the way you work</p>
      </div>
    ),
    body: (
      <div className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-muted-foreground">
        <p>Everything you used before is still here, but faster, cleaner and easier to find.</p>
        <p>This short tour shows you what changed. It takes about two minutes, and you can skip it any time and take it again from <span className="text-foreground">Settings</span>.</p>
      </div>
    ),
    next: "Start the tour",
  };

  const avatar = draft.me?.avatar_url ?? null;
  const profile: Step = {
    id: "profile",
    eyebrow: "Your profile",
    title: "Pick your picture",
    visual: (
      <div className="flex flex-col items-center py-6 text-center md:py-0">
        <div className="relative">
          <div aria-hidden className="absolute -inset-6 rounded-full bg-[#2FB585]/10 blur-2xl" />
          {draft.me ? (
            <Avatar name={draft.me.name} src={avatar} className="relative size-28 text-[34px] shadow-[0_0_0_4px_var(--background),0_0_0_6px_rgba(47,181,133,0.6)] md:size-44 md:text-[52px]" />
          ) : <div className="size-28 animate-pulse rounded-full bg-foreground/10 md:size-44" />}
        </div>
        <p className="mt-5 text-[18px] font-semibold text-foreground md:text-[22px]">{draft.me?.name ?? userName}</p>
        <p className="text-[13px] text-muted-foreground md:text-[14px]">{draft.me?.role?.name}{draft.me?.department?.name ? ` · ${draft.me.department.name.replace(/\s+Department$/i, "")}` : ""}</p>
      </div>
    ),
    body: (
      <div className="mt-3 space-y-5">
        <p className="text-[14px] leading-relaxed text-muted-foreground">Your picture shows next to every lead you own and every message you log. Upload a photo of yourself, or pick an avatar.</p>
        {draft.me && <AvatarPicker userId={draft.me.id} value={avatar} onChange={(url) => draft.setMe((m) => (m ? { ...m, avatar_url: url } : m))} className="sm:grid-cols-5" />}
        <div className="space-y-4 border-t pt-5">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/85">Phone <span className="font-normal text-muted-foreground">(optional)</span></span>
            <Input value={draft.phone} onChange={(e) => draft.setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={20} placeholder="Your mobile number" className="h-10" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-foreground/85">WhatsApp number <span className="font-normal text-muted-foreground">(if different)</span></span>
            <Input value={draft.whatsapp} onChange={(e) => draft.setWhatsapp(e.target.value)} inputMode="tel" maxLength={20} className="h-10" />
          </label>
        </div>
      </div>
    ),
    next: "Continue",
    blocked: draft.me && !avatar ? "Choose a picture to continue" : undefined,
    onNext: async () => {
      const ok = await draft.save();
      if (ok) void loadChecklist();
      return ok;
    },
  };

  const looks: Step = {
    id: "theme",
    eyebrow: "Appearance",
    title: "Made for dark mode",
    visual: <ShotStage shot={(resolvedTheme ?? picked) === "light" ? "dashboard-light" : "dashboard"} alt="The dashboard in the chosen theme" />,
    body: (
      <div className="mt-4">
        <p className="text-[14px] leading-relaxed text-muted-foreground">The CRM is designed dark first: easier on the eyes through a long day of calls. Pick one to try it now.</p>
        <div role="radiogroup" aria-label="Theme" className="mt-5 grid grid-cols-2 gap-3">
          {([
            { v: "dark", label: "Dark", note: "Recommended" },
            { v: "light", label: "Light", note: "For bright rooms" },
          ] as const).map((o) => {
            const on = picked === o.v;
            return (
              <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => setTheme(o.v)}
                className={cn("relative rounded-xl border p-2.5 text-left transition-[border-color,box-shadow,background-color]",
                  on ? "border-[#2FB585] bg-[#2FB585]/[0.06] shadow-[0_0_0_1px_#2FB585]" : "hover:border-foreground/25")}>
                <ThemePreview mode={o.v} className="h-16" />
                <span className="mt-3 block text-[14.5px] font-medium text-foreground">{o.label}</span>
                <span className="block text-[12.5px] text-muted-foreground">{o.note}</span>
                {on && <span className="absolute bottom-3 right-3 flex size-5 items-center justify-center rounded-full bg-[#2FB585] text-black"><Check className="size-3" strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[12.5px] text-muted-foreground">Switch any time in Settings, Appearance.</p>
      </div>
    ),
    onNext: () => {
      // Dark is the default look; someone who never chose gets it saved explicitly.
      if (theme !== "light" && theme !== "dark") setTheme("dark");
      return true;
    },
  };

  const tour: Step[] = slidesFor(role).map((s) => ({ id: s.id, eyebrow: s.eyebrow, title: s.title, slide: s }));

  // Reaching the last step finishes the tour, so it counts as done here.
  const final = checklist?.map((i) => (i.key === "tour" ? { ...i, done: true } : i)) ?? null;
  const done = final?.filter((i) => i.done).length ?? 0;
  const finish: Step = {
    id: "finish",
    eyebrow: "First steps",
    title: "You're all set. Now earn your first badge",
    visual: <Badge unlocked={!!final && done === final.length} done={done} total={final?.length ?? 4} />,
    body: (
      <div className="mt-3">
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          Finish these {checklist?.length ?? 4} steps to unlock <span className="text-foreground">Getting started</span> on your dashboard. They tick themselves as you work.
        </p>
        <ChecklistList items={final} />
      </div>
    ),
    next: "Start working",
  };

  return [welcome, profile, looks, ...tour, finish];
}

/** What's new since `since`: features only (fixes stay in the release notes), with a slide for each that has one. */
export function whatsNewSteps(releases: Release[], role = ""): Step[] {
  const changes = releases.flatMap((r) => r.changes).filter((c) => c.kind !== "fixed");
  if (!changes.length) return [];
  const intro: Step = {
    id: "whats-new",
    eyebrow: `Version ${APP_VERSION}`,
    title: "What's new",
    visual: <ShotStage shot="dashboard" alt="The CRM after the update" />,
    body: (
      <ul className="mt-5 space-y-2.5">
        {changes.map((c) => (
          <li key={c.text} className="flex items-start gap-3 text-[14px] leading-snug">
            <span className={cn("mt-px w-[68px] shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium",
              c.kind === "new" ? "bg-[#2FB585]/15 text-[#017D58] dark:text-[#2FB585]" : "bg-blue-500/10 text-blue-600 dark:text-blue-400")}>
              {c.kind === "new" ? "New" : "Improved"}
            </span>
            <span className="text-foreground/90">{c.text}</span>
          </li>
        ))}
      </ul>
    ),
    next: changes.some((c) => c.slide) ? "Show me" : "Got it",
  };
  const shown = new Set<string>();
  const slides: Step[] = changes.flatMap((c) => {
    const s = c.slide ? slideById(c.slide) : undefined;
    if (!s || shown.has(s.id) || (s.roles && !s.roles.includes(role))) return [];
    shown.add(s.id);
    return [{ id: s.id, eyebrow: "What's new", title: s.title, slide: s }];
  });
  return [intro, ...slides];
}
