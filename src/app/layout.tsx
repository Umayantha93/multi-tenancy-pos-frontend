import type { Metadata } from "next";
import localFont from "next/font/local";
import { LocaleProvider } from "@/lib/locale";
import "./globals.css";

const bodyFont = localFont({
  src: "../fonts/DMSans-latin.woff2",
  variable: "--font-body",
  weight: "100 1000",
  display: "swap",
});

const displayFont = localFont({
  src: [
    { path: "../fonts/BarlowCondensed-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/BarlowCondensed-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/BarlowCondensed-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
});

const sinhalaFont = localFont({
  src: "../fonts/NotoSansSinhala-sinhala.woff2",
  variable: "--font-sinhala",
  weight: "400 700",
  display: "swap",
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
