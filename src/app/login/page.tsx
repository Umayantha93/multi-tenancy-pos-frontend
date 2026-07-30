"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Gauge, LockKeyhole, Wrench } from "lucide-react";
import { api, storeSession, User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@garage.lk");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await api<{ token: string; user: User; features: string[] }>("/auth/login", { method: "POST", authenticated: false, body: JSON.stringify({ email, password }) });
      storeSession(result.token, result.user, result.features);
      router.push(result.user.role === "super_admin" ? "/super-admin/dashboard" : "/dashboard");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in."); }
    finally { setLoading(false); }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-[#242723] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(125deg, transparent 0 36px, #f5c842 37px 38px)" }} />
        <div className="relative flex items-center gap-3"><span className="grid size-11 place-items-center bg-[#f5c842] text-[#20221f]"><Wrench size={23} /></span><div><strong className="font-display text-2xl uppercase">Bay 06</strong><p className="text-xs text-white/55">Garage operations</p></div></div>
        <div className="relative max-w-xl"><p className="mb-4 font-display text-lg uppercase text-[#f5c842]">Built for the workshop floor</p><h1 className="font-display text-7xl font-semibold uppercase leading-[0.88]">Every vehicle.<br />Every rupee.<br />One system.</h1><div className="mt-10 flex gap-8 border-t border-white/20 pt-6 text-sm text-white/60"><span>POS & billing</span><span>Parts & stock</span><span>Payroll & finance</span></div></div>
        <p className="relative text-xs uppercase text-white/35">Sri Lanka · LKR · Workshop ready</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <form onSubmit={submit} className="page-enter w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center bg-[#f5c842]"><Wrench size={21} /></span><strong className="font-display text-2xl uppercase">Bay 06</strong></div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-[#167c73]"><Gauge size={17} />Operations console</div>
          <h2 className="font-display text-5xl font-semibold uppercase leading-none">Clock in.<br />Get moving.</h2>
          <p className="mt-4 text-sm text-[#6f746e]">Sign in with your garage account to open the counter.</p>
          <div className="mt-9 space-y-5">
            <label className="block text-sm font-semibold">Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-2 h-12 w-full border border-[#c9c5b9] bg-[#fbfaf6] px-4 outline-none focus:border-[#167c73]" /></label>
            <label className="block text-sm font-semibold">Password<div className="relative mt-2"><LockKeyhole className="absolute left-4 top-3.5 text-[#858a83]" size={19} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required className="h-12 w-full border border-[#c9c5b9] bg-[#fbfaf6] pl-12 pr-4 outline-none focus:border-[#167c73]" /></div></label>
          </div>
          {error && <p className="mt-4 border-l-4 border-[#b84837] bg-[#b84837]/8 px-3 py-2 text-sm text-[#8d3326]">{error}</p>}
          <button disabled={loading} className="mt-7 flex h-12 w-full items-center justify-between bg-[#20221f] px-5 font-semibold text-white transition hover:bg-[#167c73] disabled:opacity-60"><span>{loading ? "Opening console..." : "Open console"}</span><ArrowRight size={19} /></button>
          <p className="mt-6 text-xs text-[#858a83]">Starter login: admin@garage.lk / password</p>
        </form>
      </section>
    </main>
  );
}