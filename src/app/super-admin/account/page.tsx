"use client";

import { FormEvent, useEffect, useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, PasswordInput, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser, storeSession, User } from "@/lib/api";

type AdminProfile = Pick<User, "id" | "name" | "email" | "role" | "status">;

export default function SuperAdminAccountPage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AdminProfile>("/super-admin/me")
      .then((result) => {
        setProfile(result);
        setName(result.name);
        setEmail(result.email);
      })
      .catch((caught) => setError(caught.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload: Record<string, string> = { name, email };
    if (password) {
      payload.current_password = currentPassword;
      payload.password = password;
      payload.password_confirmation = passwordConfirmation;
    }
    try {
      const updated = await api<AdminProfile>("/super-admin/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
      const token = localStorage.getItem("garage_token");
      const sessionUser = currentUser();
      if (token && sessionUser) {
        storeSession(token, { ...sessionUser, name: updated.name, email: updated.email }, currentFeatures());
      }
      setNotice(password ? "Account and password saved." : "Account details saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlatformShell title="My account" eyebrow="Platform administrator">
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
      {!profile && !error ? (
        <PageState message="Loading your account..." />
      ) : profile ? (
        <Panel className="max-w-xl p-5">
          <p className="text-sm text-[#6f746e]">Name, email, and password for this super-admin login.</p>
          <form onSubmit={save} className="mt-5 grid gap-4">
            <label className="text-xs font-bold uppercase">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required className={`${inputClass} mt-2`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className={`${inputClass} mt-2`} />
            </label>
            <div className="border-t border-[#d7d3c8] pt-4">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Change password</p>
              <p className="mt-1 text-xs text-[#6f746e]">Leave blank to keep the current password.</p>
            </div>
            <label className="text-xs font-bold uppercase">
              Current password
              <div className="mt-2">
                <PasswordInput value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className={inputClass} />
              </div>
            </label>
            <label className="text-xs font-bold uppercase">
              New password
              <div className="mt-2">
                <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" className={inputClass} />
              </div>
            </label>
            <label className="text-xs font-bold uppercase">
              Confirm new password
              <div className="mt-2">
                <PasswordInput value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={8} autoComplete="new-password" className={inputClass} />
              </div>
            </label>
            <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save details"}</button>
          </form>
        </Panel>
      ) : null}
    </PlatformShell>
  );
}
