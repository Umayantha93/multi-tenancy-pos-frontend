"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, storeSession, User } from "@/lib/api";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@bay06.lk");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await api<{ token: string; user: User; features: string[] }>("/auth/login", { method: "POST", authenticated: false, body: JSON.stringify({ email, password }) });
      if (result.user.role !== "super_admin") throw new Error("Use a platform administrator account here.");
      storeSession(result.token, result.user, result.features); router.push("/super-admin/dashboard");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in."); } finally { setLoading(false); }
  }
  return <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
    <section className="flex items-center justify-center bg-[#f7f5ee] px-6 py-12"><form onSubmit={submit} className="page-enter w-full max-w-md"><Link href="/login" className="mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase text-[#6f746e]"><ArrowLeft size={15} />Tenant login</Link><div className="mb-5 grid size-12 place-items-center bg-[#f5c842]"><ShieldCheck size={24} /></div><p className="text-xs font-bold uppercase text-[#167c73]">Restricted platform access</p><h1 className="mt-2 font-display text-5xl font-semibold uppercase leading-none">Control the<br />whole network.</h1><div className="mt-8 space-y-5"><label className="block text-sm font-semibold">Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full border border-[#c9c5b9] bg-white px-4 outline-none focus:border-[#167c73]" /></label><label className="block text-sm font-semibold">Password<div className="relative mt-2"><LockKeyhole size={18} className="absolute left-4 top-3.5 text-[#858a83]" /><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full border border-[#c9c5b9] bg-white pl-12 pr-4 outline-none focus:border-[#167c73]" /></div></label></div>{error && <p className="mt-4 border-l-4 border-[#b84837] bg-[#b84837]/8 px-3 py-2 text-sm text-[#8d3326]">{error}</p>}<button disabled={loading} className="mt-7 flex h-12 w-full items-center justify-between bg-[#181b19] px-5 font-semibold text-white hover:bg-[#167c73] disabled:opacity-60"><span>{loading ? "Verifying..." : "Enter platform"}</span><ArrowRight size={19} /></button></form></section>
    <section className="relative hidden overflow-hidden bg-[#181b19] p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#f5c842 1px, transparent 1px), linear-gradient(90deg, #f5c842 1px, transparent 1px)", backgroundSize: "64px 64px" }} /><div className="relative font-display text-2xl uppercase">Bay 06 Cloud</div><div className="relative"><p className="font-display text-8xl font-semibold uppercase leading-[0.82]">Tenants.<br />Plans.<br />Access.</p><p className="mt-8 max-w-md text-sm leading-6 text-white/50">One operational view across every active business, user, and enabled module.</p></div><p className="relative text-xs uppercase text-white/30">Platform operations / Sri Lanka</p></section>
  </main>;
}