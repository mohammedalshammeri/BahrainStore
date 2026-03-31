import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بزار - تسوق بسهولة",
  description: "منصة التسوق الإلكتروني في البحرين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-cairo)] antialiased bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
