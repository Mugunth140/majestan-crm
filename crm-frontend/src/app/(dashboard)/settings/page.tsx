"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { ProfilePhoto } from "@/components/users/profile-photo";
import { AvatarPicker } from "@/components/users/avatar-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, MobileSettingsNav, Section, SettingsPage } from "@/components/settings/settings-ui";
import { meApi, syncStoredUser, type Me, type MeUpdate } from "@/lib/me-api";

const EDITABLE = ["name", "phone", "whatsapp_no", "dob", "qualification", "address"] as const;
const formOf = (me: Me): Required<Record<(typeof EDITABLE)[number], string>> => ({
  name: me.name ?? "",
  phone: me.phone ?? "",
  whatsapp_no: me.whatsapp_no ?? "",
  dob: me.dob?.slice(0, 10) ?? "",
  qualification: me.qualification ?? "",
  address: me.address ?? "",
});

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<ReturnType<typeof formOf> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    meApi.get().then((m) => { setMe(m); setForm(formOf(m)); }).catch(() => toast.error("Couldn't load your profile"));
  }, []);

  const changed = !!me && !!form && EDITABLE.some((k) => form[k] !== formOf(me)[k]);
  const set = (k: keyof ReturnType<typeof formOf>) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!me || !form || !changed) return;
    if (!form.name.trim()) return toast.error("Your name can't be empty");
    setSaving(true);
    try {
      const patch = Object.fromEntries(EDITABLE.filter((k) => form[k] !== formOf(me)[k]).map((k) => [k, form[k]])) as MeUpdate;
      const next = await meApi.update(patch);
      setMe(next);
      setForm(formOf(next));
      syncStoredUser({ name: next.name });
      toast.success("Profile saved");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    router.push("/login");
  };

  const role = me?.role?.name;
  const team = me?.department?.name?.replace(/\s+Department$/i, "");

  return (
    <SettingsPage root title="Profile" description="How you appear to your team, and your contact details.">
      <Section>
        {me ? (
          <div className="flex items-center gap-4">
            <ProfilePhoto userId={me.id} name={me.name} src={me.avatar_url} editable className="size-16 text-[18px]"
              onChange={(url) => { setMe((m) => (m ? { ...m, avatar_url: url } : m)); syncStoredUser({ avatar_url: url }); }} />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-semibold text-foreground">{me.name}</p>
              <p className="truncate text-[13px] text-muted-foreground">{[role, team].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Upload a photo or pick an avatar below.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4"><Skeleton className="size-16 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div></div>
        )}
        {me && (
          <AvatarPicker userId={me.id} value={me.avatar_url} className="mt-5 border-t pt-5 sm:grid-cols-9 md:grid-cols-[repeat(13,minmax(0,1fr))]"
            onChange={(url) => setMe((m) => (m ? { ...m, avatar_url: url } : m))} />
        )}
      </Section>

      <MobileSettingsNav />

      <form onSubmit={save}>
        <Section
          title="Your details"
          description="Your email, role, team and ID details are managed by an admin."
          footer={
            <>
              {changed && <span className="mr-auto text-[12.5px] text-muted-foreground">Unsaved changes</span>}
              <Button type="button" variant="ghost" disabled={!changed || saving} onClick={() => me && setForm(formOf(me))}>Discard</Button>
              <Button type="submit" disabled={!changed || saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </>
          }
        >
          {form ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" className="sm:col-span-2"><Input value={form.name} onChange={set("name")} autoComplete="name" maxLength={80} /></Field>
              <Field label="Email"><Input value={me?.email ?? ""} disabled /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" maxLength={20} /></Field>
              <Field label="WhatsApp number"><Input value={form.whatsapp_no} onChange={set("whatsapp_no")} inputMode="tel" maxLength={20} /></Field>
              <Field label="Date of birth"><Input type="date" value={form.dob} onChange={set("dob")} /></Field>
              <Field label="Qualification" className="sm:col-span-2"><Input value={form.qualification} onChange={set("qualification")} maxLength={120} /></Field>
              <Field label="Address" className="sm:col-span-2"><Textarea value={form.address} onChange={set("address")} rows={3} maxLength={500} /></Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
          )}
        </Section>
      </form>

      <button type="button" onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/50 py-3.5 font-semibold text-red-600 transition-transform active:scale-[0.98] md:hidden dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
        <LogOut className="size-5" /> Log out
      </button>
    </SettingsPage>
  );
}
