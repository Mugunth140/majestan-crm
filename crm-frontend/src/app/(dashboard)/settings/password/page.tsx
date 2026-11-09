"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Section, SettingsPage } from "@/components/settings/settings-ui";
import { meApi } from "@/lib/me-api";

export default function PasswordSettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current && next.length >= 8 && confirm === next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await meApi.changePassword(current, next);
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password changed. Your phone app will ask you to sign in again.");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't change your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Password" description="Change the password you sign in with.">
      <form onSubmit={submit}>
        <Section
          title="Change password"
          description="Use at least 8 characters. Changing it signs you out of the phone app."
          footer={<Button type="submit" disabled={!ready || busy}>{busy ? "Changing…" : "Change password"}</Button>}
        >
          <div className="grid max-w-sm gap-4">
            <Field label="Current password"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="New password" hint={tooShort ? "At least 8 characters." : undefined}>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-invalid={tooShort || undefined} />
            </Field>
            <Field label="Confirm new password" hint={mismatch ? "The two passwords don't match." : undefined}>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch || undefined} />
            </Field>
          </div>
        </Section>
      </form>
    </SettingsPage>
  );
}
