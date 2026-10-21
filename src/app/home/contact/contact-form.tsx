"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message: string }>("/contact", {
        method: "POST",
        authenticated: false,
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
        }),
      });
      setNotice(result.message);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The message could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  const field = "mt-2 h-11 w-full border border-[#c9c5b9] bg-white px-3 text-sm outline-none focus:border-[#167c73]";

  return (
    <form onSubmit={submit} className="border border-[#d7d3c8] bg-[#fbfaf6] p-6">
      <h2 className="font-display text-3xl font-semibold uppercase">Send a message</h2>
      <p className="mt-2 text-sm leading-6 text-[#3c423c]">Your message goes straight to the IUBits team. We reply using the email or phone you enter.</p>
      <label className="mt-5 block text-sm font-semibold">
        Name
        <input required value={name} onChange={(event) => setName(event.target.value)} className={field} autoComplete="name" />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={field} autoComplete="email" />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className={field} autoComplete="tel" />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Message
        <textarea required minLength={10} value={message} onChange={(event) => setMessage(event.target.value)} className={`${field} h-32 py-2`} />
      </label>
      {error && <p className="mt-4 border-l-4 border-[#b84837] bg-[#b84837]/8 px-3 py-2 text-sm text-[#8d3326]">{error}</p>}
      {notice && <p className="mt-4 border-l-4 border-[#167c73] bg-[#167c73]/8 px-3 py-2 text-sm text-[#0f5c56]">{notice}</p>}
      <button disabled={loading} className="mt-5 inline-flex h-11 items-center bg-[#20221f] px-5 text-sm font-semibold text-white hover:bg-[#167c73] disabled:opacity-60">
        {loading ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
