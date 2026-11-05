"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { FOCUS_FIELD, FieldRow, FocusField, FocusModal, ToggleCard } from "@/components/shared/focus-modal";
import { FOCUS_INPUT, FOCUS_SELECT, StepFooter, StepSection, useFocusSteps } from "@/components/shared/focus-steps";
import { apiFetch } from "@/lib/api-fetch";
import { USER_PERMISSIONS, keysForRole, needsDepartment, offeredFor, withPermission } from "@/lib/user-access";
import { isAdminRole } from "@/lib/nav-access";
import { cn } from "@/lib/utils";
import { SidebarAccess } from "./SidebarAccess";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const USER_STEPS = [
  { key: "account", label: "Account" },
  { key: "access", label: "Access" },
  { key: "personal", label: "Personal" },
  { key: "employment", label: "Employment" },
] as const;
type UserStep = (typeof USER_STEPS)[number]["key"];

const EMPTY = {
  name: "", email: "", password: "", role_id: "", department_id: "",
  phone: "", whatsapp_no: "", dob: "", qualification: "", address: "",
  aadhaar_no: "", bank_account_no: "", join_date: "",
};
type Form = typeof EMPTY;
type Option = { label: string; value: string };

/** Roles and departments for the pickers, shared with the user page. */
export function useUserMasters() {
  const [roles, setRoles] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  useEffect(() => {
    let live = true;
    const load = (path: string, set: (o: Option[]) => void) =>
      apiFetch(`${API_URL}/${path}`).then((r) => r.json())
        .then((d) => { if (live && d.success) set(d.data.map((x: { id: number; name: string }) => ({ label: x.name, value: String(x.id) }))); })
        .catch(() => {});
    load("roles", setRoles);
    load("departments", setDepartments);
    return () => { live = false; };
  }, []);
  return { roles, departments };
}

/** A password field with a show/hide toggle. */
export function PasswordInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={shown ? "text" : "password"} autoComplete="new-password" value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} placeholder="Set a password" className={cn(FOCUS_INPUT, "pr-10")} />
      <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export const passwordProblem = (password: string) => (password ? null : "Set a password for the new user");

/** The new-user form. Existing users are edited on their page. */
export function UserForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { roles, departments } = useUserMasters();
  const [form, setForm] = useState<Form>(EMPTY);
  const [keys, setKeys] = useState<string[]>([]);
  // Sidebar modules ticked on the Access step; null keeps the role's defaults.
  const [navPick, setNavPick] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof Form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value) });
  const deptNeeded = needsDepartment(form.role_id);
  const roleName = roles.find((o) => o.value === form.role_id)?.label ?? "";
  const departmentName = departments.find((o) => o.value === form.department_id)?.label ?? "";

  const problemOf = (key: UserStep) => {
    if (key !== "account") return null;
    if (!form.name.trim()) return "Enter the user's name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address";
    if (passwordProblem(form.password)) return passwordProblem(form.password);
    if (!form.role_id) return "Pick a role";
    if (deptNeeded && !form.department_id) return "Team Leads and Staff need a department";
    return null;
  };
  const nav = useFocusSteps<UserStep>(USER_STEPS, { create: true, problem: problemOf });

  const save = async () => {
    const missing = USER_STEPS.find((s) => problemOf(s.key));
    if (missing) {
      toast.error(problemOf(missing.key));
      return nav.go(missing.key);
    }
    setSaving(true);
    try {
      const blank = (v: string) => v.trim() || null;
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: Number(form.role_id),
        department_id: deptNeeded ? Number(form.department_id) : null,
        is_active: true,
        permissionKeys: keysForRole(keys, form.role_id),
        nav_access: isAdminRole(roleName) ? null : navPick,
        phone: blank(form.phone), whatsapp_no: blank(form.whatsapp_no), dob: blank(form.dob), qualification: blank(form.qualification),
        address: blank(form.address), aadhaar_no: blank(form.aadhaar_no), bank_account_no: blank(form.bank_account_no), join_date: blank(form.join_date),
      };
      const res = await apiFetch(`${API_URL}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error((Array.isArray(data.message) ? data.message.join(", ") : data.message) || "Couldn't add the user");
      toast.success("User added");
      onCreated(data.data.id);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't add the user");
    } finally {
      setSaving(false);
    }
  };

  const section = (key: UserStep, title: string, description: string, children: ReactNode) => (
    <StepSection title={title} description={description} hidden={nav.step !== key}>{children}</StepSection>
  );

  return (
    <FocusModal
      open
      onOpenChange={(o) => { if (!o && !saving) onClose(); }}
      title="New user"
      steps={nav.steps}
      active={nav.step}
      onStepChange={(k) => nav.jump(k as UserStep)}
      footer={<StepFooter nav={nav} create saving={saving} onCancel={onClose} onSave={() => void save()} createLabel="Add user" />}
    >
      <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (!nav.last) nav.next(); else void save(); }}>
        {section("account", "Account", "How they sign in, and what they can see.", <>
          <FieldRow>
            <FocusField label="Full name" htmlFor="us-name" required>
              <Input id="us-name" {...text("name")} placeholder="e.g. Priya Raman" autoFocus className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Email" htmlFor="us-email" required hint="They sign in with this.">
              <Input id="us-email" type="email" autoComplete="off" {...text("email")} placeholder="priya@majestan.com" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Password" htmlFor="us-password" required hint="Share it with them privately; they can't change it themselves.">
            <PasswordInput id="us-password" value={form.password} onChange={(v) => set("password", v)} />
          </FocusField>
          <FieldRow>
            <FocusField label="Role" required>
              <FormSelect name="role" placeholder="Select role" className={FOCUS_SELECT} options={roles} value={form.role_id || null}
                onValueChange={(v) => { setNavPick(null); setForm((f) => ({ ...f, role_id: v || "", department_id: needsDepartment(v) ? f.department_id : "" })); }} />
            </FocusField>
            <FocusField label="Department" required={deptNeeded} hint={form.role_id && !deptNeeded ? "Admins and Managers work across all departments." : undefined}>
              <FormSelect name="department" placeholder={form.role_id && !deptNeeded ? "All departments" : "Select department"} className={FOCUS_SELECT}
                options={departments} value={form.department_id || null} disabled={!deptNeeded} onValueChange={(v) => { setNavPick(null); set("department_id", v || ""); }} />
            </FocusField>
          </FieldRow>
        </>)}

        {section("access", "Access", "Which modules they see on the sidebar, and what they can see inside them.", !roleName ? (
          <p className="text-[14px] text-muted-foreground">Pick a role on the Account step first; the sidebar starts from that role&rsquo;s defaults.</p>
        ) : isAdminRole(roleName) ? (
          <p className="text-[14px] text-muted-foreground">Admins see and do everything, so there is nothing to set.</p>
        ) : <>
          <SidebarAccess role={roleName} department={departmentName} blogAccess={false} value={navPick} onChange={async (next) => setNavPick(next)} />
          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-[14px] font-semibold text-foreground">Fine-grained access</h4>
              <p className="text-[13px] text-muted-foreground">What they can see inside the modules. Only admins can delete.</p>
            </div>
            {USER_PERMISSIONS.filter((p) => offeredFor(p, form.role_id)).map((p) => (
              <ToggleCard key={p.key} title={p.title} description={p.description} checked={keys.includes(p.key)}
                onCheckedChange={(on) => setKeys((k) => withPermission(k, p.key, on))} />
            ))}
          </div>
        </>)}

        {section("personal", "Personal", "Contact details and background.", <>
          <FieldRow>
            <FocusField label="Phone" htmlFor="us-phone" optional>
              <Input id="us-phone" type="tel" {...text("phone")} placeholder="+91 98765 43210" className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="WhatsApp" htmlFor="us-whatsapp" optional>
              <Input id="us-whatsapp" type="tel" {...text("whatsapp_no")} placeholder="+91 98765 43210" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FieldRow>
            <FocusField label="Date of birth" htmlFor="us-dob" optional>
              <Input id="us-dob" type="date" {...text("dob")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Qualification" htmlFor="us-qual" optional>
              <Input id="us-qual" {...text("qualification")} placeholder="e.g. MBA, B.Tech" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Address" htmlFor="us-address" optional>
            <Textarea id="us-address" rows={2} {...text("address")} placeholder="Residential address" className={cn(FOCUS_FIELD, "min-h-16 resize-y py-2")} />
          </FocusField>
        </>)}

        {section("employment", "Employment", "Joining date and the details payroll needs.", <>
          <FieldRow>
            <FocusField label="Joined on" htmlFor="us-join" optional>
              <Input id="us-join" type="date" {...text("join_date")} className={FOCUS_INPUT} />
            </FocusField>
            <FocusField label="Aadhaar number" htmlFor="us-aadhaar" optional>
              <Input id="us-aadhaar" inputMode="numeric" {...text("aadhaar_no")} placeholder="0000 0000 0000" className={FOCUS_INPUT} />
            </FocusField>
          </FieldRow>
          <FocusField label="Bank account number" htmlFor="us-bank" optional>
            <Input id="us-bank" inputMode="numeric" {...text("bank_account_no")} className={FOCUS_INPUT} />
          </FocusField>
        </>)}
      </form>
    </FocusModal>
  );
}
