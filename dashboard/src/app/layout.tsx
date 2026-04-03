import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

const ibmPlex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: { default: "بزار | لوحة التحكم", template: "%s | بزار" },
  description: "بزار — منصة التجارة الإلكترونية البحرينية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlex.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}