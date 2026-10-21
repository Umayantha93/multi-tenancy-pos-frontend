import type { Metadata } from "next";
import Link from "next/link";
import { IubitsLogo } from "@/components/iubits-logo";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact IUBits",
  description: "Send a message, or call and WhatsApp +94 71 170 8399.",
};

const phoneDisplay = "+94 71 170 8399";
const phoneTel = "+94711708399";

export default function ContactPage() {
  return (
    <div className="min-h-screen text-[#20221f]">
      <header className="sticky top-0 z-20 border-b border-[#d7d3c8] bg-[#fbfaf6]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link href="/home" className="mr-auto">
            <IubitsLogo tone="onLight" size="sm" />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#3c423c]">
            <Link href="/home#pos" className="hover:text-[#167c73]">The POS</Link>
            <Link href="/home#trades" className="hover:text-[#167c73]">Who it is for</Link>
            <Link href="/home#features" className="hover:text-[#167c73]">Features</Link>
            <Link href="/home/contact" className="text-[#167c73]">Contact</Link>
          </nav>
          <Link href="/login" className="inline-flex h-9 items-center bg-[#20221f] px-4 text-sm font-semibold text-white hover:bg-[#167c73]">
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#242723] text-white">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(125deg, transparent 0 36px, #f5c842 37px 38px)" }} />
          <div className="relative mx-auto max-w-6xl px-5 py-14">
            <p className="font-display text-lg uppercase text-[#f5c842]">IUBits</p>
            <h1 className="mt-2 font-display text-5xl font-semibold uppercase leading-none sm:text-6xl">Contact us</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/80">
              Ask about the point-of-sale system, an ERP, or a website. Send a message, call, or open WhatsApp.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <article className="border border-[#d7d3c8] bg-[#fbfaf6] p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-[#167c73]">Call</p>
              <a href={`tel:${phoneTel}`} className="mt-2 block font-display text-3xl font-semibold text-[#20221f] hover:text-[#167c73]">
                {phoneDisplay}
              </a>
              <a href={`tel:${phoneTel}`} className="mt-4 inline-flex h-10 items-center border border-[#20221f] px-4 text-sm font-semibold hover:bg-[#20221f] hover:text-white">
                Call now
              </a>
            </article>
            <article className="border border-[#d7d3c8] bg-[#fbfaf6] p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-[#167c73]">WhatsApp</p>
              <p className="mt-2 text-sm leading-6 text-[#3c423c]">Message the same number on WhatsApp.</p>
              <a
                href={`https://wa.me/${phoneTel.replace("+", "")}`}
                className="mt-4 inline-flex h-10 items-center bg-[#167c73] px-4 text-sm font-semibold text-white hover:bg-[#20221f]"
              >
                Open WhatsApp
              </a>
            </article>
          </div>
          <ContactForm />
        </section>
      </main>
    </div>
  );
}
