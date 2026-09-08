import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, Noto_Sans_Sinhala } from "next/font/google";
import { LocaleProvider } from "@/lib/locale";
import "./globals.css";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sinhalaFont = Noto_Sans_Sinhala({
  variable: "--font-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bay 06 | Business Operations",
  description: "Multi-tenant POS for garages, cottages, shops, and supermarkets — billing, inventory, payroll, and finance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${sinhalaFont.variable} h-full antialiased`}
    >
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
