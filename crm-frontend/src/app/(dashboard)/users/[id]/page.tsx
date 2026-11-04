"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Database, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api-fetch";
import { isAdmin as isAdminUser } from "@/lib/permissions";
import { USER_PERMISSIONS, keysForRole, needsDepartment, offeredFor, userCode, withPermission } from "@/lib/user-access";
import { fetchLoggerDevices, type LoggerDevice } from "@/lib/logger-devices";
import { InlineSelect, InlineText, Section, withCurrent } from "@/components/record/inline-field";
import { DataCard, Fact, RecordPage, RecordSkeleton, type RecordTab } from "@/components/record/record-page";
import { HEADER_BUTTON, StatusMenu } from "@/components/record/header-actions";
import { TabHeader } from "@/components/record/feed";
import { ProfilePhoto } from "@/components/users/profile-photo";
import { statusDot, statusPillClass, formatTableDate } from "@/components/tables/cells";
import { DeviceCard } from "@/components/logger/device-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FormSelect } from "@/components/shared/form-select";
import { FOCUS_BUTTON, FocusField } from "@/components/shared/focus-modal";
import { FOCUS_SELECT } from "@/components/shared/focus-steps";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordInput, useUserMasters } from "../_components/UserForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type Tab = "overview" | "access" | "devices";
type User = {
  id: number; name: string; email: string; role_id: number; department_id: number | null; is_active: boolean;
  role?: { id: number; name: string } | null; department?: { id: number; name: string } | null;
  phone?: string | null; whatsapp_no?: string | null; dob?: string | null; qualification?: string | null; address?: string | null;
  aadhaar_no?: string | null; bank_account_no?: string | null; join_date?: string | null; created_at?: string;
  avatar_url?: string | null;
  permissions?: string[];
};

const STATUS_OPTIONS = [
  { value: "Active", dot: statusDot("Active", "green") },
  { value: "Inactive", dot: statusDot("Inactive", "gray") },
];
// Validation errors come as `message` (sometimes a list), others as `error`.
const errorText = (result: { message?: string | string[]; error?: string } | null) =>
  Array.isArray(result?.message) ? result.message.join(", ") : result?.message ?? result?.error;
const dateOnly = (v?: string | null) => (v ? String(v).slice(0, 10) : "");

function UserPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { roles, departments } = useUserMasters();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => (searchParams.get("tab") === "devices" ? "devices" : "overview"));
  const [devices, setDevices] = useState<LoggerDevice[] | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // A role change to Team Lead or Staff waits here until a department is picked.
  const [pendingRole, setPendingRole] = useState<{ role: string; department: string } | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canEdit] = useState(() => isAdminUser());
  // Admins change anyone's photo; people can also change their own.
  const [isSelf] = useState(() => {
    try { return String(JSON.parse(localStorage.getItem("crm_user") || "{}")?.id) === id; } catch { return false; }
  });

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const result = await apiJson<{ success?: boolean; data?: User }>(`${API_URL}/users/${id}`);
      if (result?.success && result.data) return result.data;
      toast.error("User not found");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't load the user");
    }
    router.push("/users");
    return null;
  }, [id, router]);
  const load = async () => { const data = await fetchUser(); if (data) setUser(data); };

  useEffect(() => {
    let live = true;
    fetchUser().then((data) => {
      if (!live) return;
      if (data) setUser(data);
      setIsLoading(false);
    });
    // The phones this user signed in on; hidden from viewers who can't see devices.
    fetchLoggerDevices(apiFetch, API_URL)
      .then((list) => { if (live) setDevices(list ? list.filter((d) => String(d.staff?.id) === id) : null); })
      .catch(() => { if (live) setDevices(null); });
    return () => { live = false; };
  }, [id, fetchUser]);

  /** Saves part of the user. The reply leaves out role and permissions, so reload the whole record. */
  const save = async (patch: Record<string, unknown>, done = "Saved") => {
    const res = await apiFetch(`${API_URL}/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      const message = errorText(result) || "Couldn't save the change";
      toast.error(message);
      throw new Error(message);
    }
    await load();
    toast.success(done);
  };
  const saveText = (key: keyof User) => (v: string) => save({ [key]: v.trim() || null });
  const saveRequired = (key: "name" | "email", what: string) => (v: string) => {
    if (!v.trim()) {
      toast.error(`The ${what} can't be empty.`);
      throw new Error("required");
    }
    return save({ [key]: v.trim() });
  };

  if (isLoading) return <RecordSkeleton title="User" />;
  if (!user) return null;

  const u = user;
  const keys = u.permissions ?? [];
  const roleId = String(u.role_id ?? u.role?.id ?? "");
  const deptNeeded = needsDepartment(roleId);
  const status = u.is_active ? "Active" : "Inactive";
  const photo = (className: string) => (
    <ProfilePhoto userId={u.id} name={u.name} src={u.avatar_url} editable={canEdit || isSelf} className={className}
      onChange={(url) => setUser((prev) => (prev ? { ...prev, avatar_url: url } : prev))} />
  );
  const subtitle = [userCode(u.id), u.role?.name, u.department?.name].filter(Boolean).join(" · ");

  const changeRole = async (next: string) => {
    if (!next || next === roleId) return;
    if (needsDepartment(next) && !u.department_id) {
      setPendingRole({ role: next, department: "" });
      return;
    }
    await save({
      role_id: Number(next),
      department_id: needsDepartment(next) ? u.department_id : null,
      permissionKeys: keysForRole(keys, next),
    }, "Role changed");
  };
  const confirmRole = async () => {
    if (!pendingRole?.department) return void toast.error("Pick a department");
    setBusy(true);
    try {
      await save({ role_id: Number(pendingRole.role), department_id: Number(pendingRole.department), permissionKeys: keysForRole(keys, pendingRole.role) }, "Role changed");
      setPendingRole(null);
    } catch { /* toast shown */ } finally { setBusy(false); }
  };
  const togglePermission = async (key: string, on: boolean) => {
    setSavingKey(key);
    try { await save({ permissionKeys: withPermission(keys, key, on) }, on ? "Access granted" : "Access removed"); } catch { /* toast shown */ } finally { setSavingKey(null); }
  };
  const setActive = (next: string) => save({ is_active: next === "Active" }, next === "Active" ? "User activated" : "User deactivated").catch(() => {});
  const setNewPassword = async () => {
    if (!password) return void toast.error("Enter the new password");
    setBusy(true);
    try {
      await save({ password }, "Password changed");
      setPassword(null);
    } catch { /* toast shown */ } finally { setBusy(false); }
  };

  const overview = (
    <div>
      <TabHeader title="Overview" />
      <div className="space-y-5 px-3 pb-8 sm:px-10">
        <DataCard title="Account">
          <InlineText label="Name" value={u.name} disabled={!canEdit} onSave={saveRequired("name", "name")} />
          <InlineText label="Email" type="email" value={u.email} disabled={!canEdit} onSave={saveRequired("email", "email")} />
          <InlineSelect label="Role" value={roleId} options={withCurrent(roles, roleId)} disabled={!canEdit} onSave={changeRole} />
          {deptNeeded
            ? <InlineSelect label="Department" value={u.department_id ? String(u.department_id) : null} options={departments} disabled={!canEdit}
                onSave={(v) => save({ department_id: Number(v) })} />
            : <Fact label="Department">All departments</Fact>}
        </DataCard>
        <DataCard title="Contact">
          <InlineText label="Phone" type="tel" value={u.phone} disabled={!canEdit} onSave={saveText("phone")} />
          <InlineText label="WhatsApp" type="tel" value={u.whatsapp_no} disabled={!canEdit} onSave={saveText("whatsapp_no")} />
          <InlineText label="Address" multiline value={u.address} disabled={!canEdit} onSave={saveText("address")} />
        </DataCard>
        <DataCard title="Personal and employment">
          <InlineText label="Date of birth" type="date" value={dateOnly(u.dob)} disabled={!canEdit} onSave={saveText("dob")} />
          <InlineText label="Qualification" value={u.qualification} disabled={!canEdit} onSave={saveText("qualification")} />
          <InlineText label="Joined on" type="date" value={dateOnly(u.join_date)} disabled={!canEdit} onSave={saveText("join_date")} />
          <InlineText label="Aadhaar" value={u.aadhaar_no} disabled={!canEdit} onSave={saveText("aadhaar_no")} />
          <InlineText label="Bank account" value={u.bank_account_no} disabled={!canEdit} onSave={saveText("bank_account_no")} />
        </DataCard>
      </div>
    </div>
  );

  const offered = USER_PERMISSIONS.filter((p) => offeredFor(p, roleId));
  const access = (
    <div>
      <TabHeader title="Access" />
      <div className="space-y-5 px-3 pb-8 sm:px-10">
        <section className="overflow-hidden rounded-xl border bg-card">
          <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">Extra access</h3>
          {u.role?.name === "Admin" || u.role?.name === "Super Admin" ? (
            <p className="px-4 py-4 text-[14px] text-muted-foreground">Admins can see and do everything, so there is nothing extra to grant.</p>
          ) : offered.map((p) => (
            <label key={p.key} className="flex items-start gap-3 border-b px-4 py-3.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-foreground">{p.title}</span>
                <span className="block text-[13px] text-muted-foreground">{p.description}</span>
              </span>
              {savingKey === p.key && <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch checked={keys.includes(p.key)} disabled={!canEdit || savingKey !== null} onCheckedChange={(on) => void togglePermission(p.key, on)} className="mt-0.5" />
            </label>
          ))}
        </section>
        {canEdit && (
          <section className="overflow-hidden rounded-xl border bg-card">
            <h3 className="flex h-11 items-center border-b px-4 text-[14px] font-semibold text-foreground">Sign-in</h3>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <span className="min-w-0 flex-1 text-[14px] text-muted-foreground">
                Set a new password for {u.name.split(" ")[0]}. Their logger phones are signed out and need to sign in again.
              </span>
              <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => setPassword("")}>
                <KeyRound className="h-3.5 w-3.5" /> Change password
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );

  const devicesTab = (
    <div>
      <TabHeader title="Logger devices" />
      <div className="space-y-3 px-3 pb-8 sm:px-10">
        {devices?.length ? devices.map((d) => <DeviceCard key={d.id} device={d} />) : (
          <EmptyState kind="records" className="py-12" title="No phones registered" description={`When ${u.name.split(" ")[0]} signs in to the logger app, their phone shows up here.`} />
        )}
      </div>
    </div>
  );

  const tabs: RecordTab<Tab>[] = [
    { key: "overview", label: "Overview", icon: Database },
    { key: "access", label: "Access", icon: ShieldCheck },
    ...(devices ? [{ key: "devices" as const, label: "Devices", icon: Smartphone, count: devices.length }] : []),
  ];
  const statusMenu = (size: "h-7" | "h-8") => (
    <StatusMenu status={status} options={STATUS_OPTIONS} size={size} pillClass={statusPillClass(status, u.is_active ? "green" : "gray")} onChange={canEdit ? setActive : undefined} />
  );

  return (
    <>
      <RecordPage
        title={u.name}
        tabs={tabs}
        active={tabs.some((t) => t.key === activeTab) ? activeTab : "overview"}
        onTab={setActiveTab}
        actions={<>
          {statusMenu("h-8")}
          {canEdit && <button type="button" className={HEADER_BUTTON} onClick={() => setPassword("")}><KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> Change password</button>}
        </>}
        phone={
          <div className="flex items-center gap-3">
            {photo("h-10 w-10 text-[13px]")}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
            </div>
            {statusMenu("h-7")}
          </div>
        }
        aside={
          <>
            <div className="flex items-center gap-3 border-b p-4">
              {photo("h-12 w-12 text-[15px]")}
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold leading-6 text-foreground">{u.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <Section title="Details">
              <Fact label="Email">{u.email ? <a href={`mailto:${u.email}`} className="hover:underline">{u.email}</a> : null}</Fact>
              <Fact label="Phone">{u.phone ? <a href={`tel:${u.phone}`} className="hover:underline">{u.phone}</a> : null}</Fact>
              <Fact label="Role">{u.role?.name}</Fact>
              <Fact label="Department">{deptNeeded ? u.department?.name : "All departments"}</Fact>
              <Fact label="Joined">{formatTableDate(u.join_date)}</Fact>
              <Fact label="Added">{formatTableDate(u.created_at)}</Fact>
            </Section>
          </>
        }
      >
        {activeTab === "overview" && overview}
        {activeTab === "access" && access}
        {activeTab === "devices" && devices && devicesTab}
      </RecordPage>

      <Dialog open={pendingRole !== null} onOpenChange={(o) => { if (!o && !busy) setPendingRole(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pick a department</DialogTitle>
            <DialogDescription>Team Leads and Staff work in one department. Which one is {u.name.split(" ")[0]} in?</DialogDescription>
          </DialogHeader>
          <FocusField label="Department" required>
            <FormSelect name="department" placeholder="Select department" className={FOCUS_SELECT} options={departments}
              value={pendingRole?.department || null} onValueChange={(v) => setPendingRole((p) => (p ? { ...p, department: v || "" } : p))} />
          </FocusField>
          <DialogFooter>
            <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => setPendingRole(null)} disabled={busy}>Cancel</button>
            <button type="button" className={FOCUS_BUTTON.primary} onClick={() => void confirmRole()} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Change role
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={password !== null} onOpenChange={(o) => { if (!o && !busy) setPassword(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>{u.name} signs in with this from now on. Their logger phones are signed out.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); void setNewPassword(); }}>
            <FocusField label="New password" htmlFor="user-new-password">
              <PasswordInput id="user-new-password" value={password ?? ""} onChange={setPassword} autoFocus />
            </FocusField>
            <DialogFooter className="mt-4">
              <button type="button" className={FOCUS_BUTTON.secondary} onClick={() => setPassword(null)} disabled={busy}>Cancel</button>
              <button type="submit" className={FOCUS_BUTTON.primary} disabled={busy || !password}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Set password
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function UserDetailPage() {
  return (
    <Suspense fallback={<RecordSkeleton title="User" />}>
      <UserPage />
    </Suspense>
  );
}

