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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iubits.cc";
const description = "Multi-tenant POS for garages, cottages, shops, and supermarkets — billing, inventory, payroll, and finance.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "IUBits POS",
  title: "IUBits POS | Business Operations",
  description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/brand/iubits-mark.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: "./",
    siteName: "IUBits POS",
    title: "IUBits POS",
    description,
    images: [
      {
        url: "/brand/iubits-og.jpg",
        width: 1200,
        height: 630,
        alt: "IUBits POS",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IUBits POS",
    description,
    images: ["/brand/iubits-og.jpg"],
  },
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
