import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PWAInstaller } from "@/components/ui/pwa-installer";
import { getPublicApiUrl } from "@/lib/env";
import { getOptionalStorefrontBaseUrl } from "@/lib/seo";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بزار - تسوق بسهولة",
  description: "منصة التسوق الإلكتروني في البحرين",
  metadataBase: getOptionalStorefrontBaseUrl() ? new URL(getOptionalStorefrontBaseUrl()!) : undefined,
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "بزار",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiOrigin = (() => {
    try {
      return new URL(getPublicApiUrl()).origin;
    } catch {
      return null;
    }
  })();

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {apiOrigin && <link rel="dns-prefetch" href={apiOrigin} />}
        {apiOrigin && <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />}
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-cairo)] antialiased bg-gray-50">
        <Providers>{children}</Providers>
        <PWAInstaller />
      </body>
    </html>
  );
}
