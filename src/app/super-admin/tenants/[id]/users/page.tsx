"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Power, Trash2, UserPlus } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ConfirmModal, ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api } from "@/lib/api";

type TenantUser = {
  id: number;
  name: string;
  email: string;
  role: "business_owner" | "staff";
  status: "active" | "inactive";
  is_secondary_view?: boolean;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "default" | "danger" | "teal";
  action: "status" | "remove";
  user: TenantUser;
};

export default function TenantUsersPage() {
  const { id } = useParams<{ id: string }>();
  const [users, setUsers] = useState<TenantUser[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [asSecondary, setAsSecondary] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  function load() {
    api<TenantUser[]>(`/super-admin/tenants/${id}/users`)
      .then(setUsers)
      .catch((caught) => setError(caught.message));
  }

  useEffect(load, [id]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const creatingSecondary = asSecondary;
      await api(`/super-admin/tenants/${id}/users`, {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(form),
          is_secondary_view: creatingSecondary,
        }),
      });
      event.currentTarget.reset();
      setAsSecondary(false);
      setNotice(creatingSecondary ? "Secondary login created successfully." : "User account created successfully.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create user. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function requestStatus(user: TenantUser) {
    const nextInactive = user.status === "active";
    setConfirm({
      title: nextInactive ? "Deactivate user" : "Activate user",
      message: nextInactive
        ? `Deactivate ${user.name} (${user.email})? They will be signed out and cannot log in until activated again.`
        : `Activate ${user.name} (${user.email})? They will be able to sign in again.`,
      confirmLabel: nextInactive ? "Deactivate" : "Activate",
      tone: nextInactive ? "danger" : "teal",
      action: "status",
      user,
    });
  }

  function requestRemove(user: TenantUser) {
    setConfirm({
      title: "Remove user",
      message: `Remove ${user.name}? Historical records will remain intact.`,
      confirmLabel: "Remove",
      tone: "danger",
      action: "remove",
      user,
    });
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActionBusy(true);
    setError("");
    setNotice("");
    try {
      if (confirm.action === "status") {
        const nextInactive = confirm.user.status === "active";
        await api(`/super-admin/users/${confirm.user.id}/${nextInactive ? "deactivate" : "activate"}`, { method: "POST" });
        setNotice(
          nextInactive
            ? `${confirm.user.name} has been deactivated and can no longer sign in.`
            : `${confirm.user.name} has been activated and can sign in again.`,
        );
      } else {
        await api(`/super-admin/users/${confirm.user.id}`, { method: "DELETE" });
        setNotice(`${confirm.user.name} has been removed.`);
      }
      setConfirm(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete this action. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  const hasSecondary = users?.some((user) => user.is_secondary_view) ?? false;

  return (
    <PlatformShell
      title="Tenant users"
      eyebrow="Identity administration"
      action={
        <Link href={`/super-admin/tenants/${id}`} className="flex h-10 items-center gap-2 border border-[#cbc7bc] px-3 text-sm font-semibold">
          <ArrowLeft size={17} />Tenant
        </Link>
      }
    >
      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        busy={actionBusy}
        onCancel={() => { if (!actionBusy) setConfirm(null); }}
        onConfirm={handleConfirm}
      />
      {error && (
        <div className="mb-5">
          <ErrorMessage message={error} />
        </div>
      )}
      {notice && (
        <div className="mb-5">
          <SuccessMessage message={notice} />
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
        {!users ? (
          <PageState message="Loading users..." />
        ) : (
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{users.length} accounts</h2>
            </div>
            <div className="divide-y divide-[#dedad0]">
              {users.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="grid size-10 place-items-center bg-[#e7e4db] font-bold">{user.name.charAt(0)}</span>
                  <div className="min-w-48 flex-1">
                    <strong className="block text-sm">{user.name}</strong>
                    <span className="text-xs text-[#6f746e]">{user.email}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-[#6f746e]">{user.role.replace("_", " ")}</span>
                  {user.is_secondary_view && (
                    <span className="bg-[#167c73]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#167c73]">Secondary view</span>
                  )}
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase ${user.status === "active" ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#b84837]/10 text-[#b84837]"}`}>
                    {user.status}
                  </span>
                  <button title={`${user.status === "active" ? "Deactivate" : "Activate"} user`} onClick={() => requestStatus(user)} className="grid size-9 place-items-center border border-[#cbc7bc]">
                    <Power size={16} />
                  </button>
                  <button title="Delete user" onClick={() => requestRemove(user)} className="grid size-9 place-items-center border border-[#cbc7bc] text-[#b84837]">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {users.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No tenant users.</p>}
            </div>
          </Panel>
        )}
        <Panel className="h-fit p-5">
          <div className="flex items-center gap-2">
            <UserPlus size={19} className="text-[#167c73]" />
            <h2 className="font-display text-2xl font-semibold uppercase">Add account</h2>
          </div>
          <form onSubmit={create} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">
              Name
              <input required name="name" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input required name="email" type="email" className={`mt-2 ${inputClass}`} />
            </label>
            <label className="block text-sm font-semibold">
              Role
              <select name="role" className={`mt-2 ${inputClass}`} disabled={asSecondary}>
                <option value="staff">Staff</option>
                <option value="business_owner">Business owner</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={asSecondary}
                disabled={hasSecondary}
                onChange={(event) => setAsSecondary(event.target.checked)}
              />
              Secondary financial view login
            </label>
            {hasSecondary && <p className="text-xs text-[#6f746e]">This tenant already has a secondary login.</p>}
            <label className="block text-sm font-semibold">
              Temporary password
              <input required name="password" type="password" minLength={8} className={`mt-2 ${inputClass}`} />
            </label>
            <button disabled={loading} className={`${buttonClass} w-full`}>
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        </Panel>
      </div>
    </PlatformShell>
  );
}
