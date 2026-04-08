import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "600", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS SaaS",
  description: "Punto de venta multi-local — Next.js y Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full min-h-dvh flex flex-col bg-[var(--pos-bg)] text-[var(--pos-text)]">
        {children}
      </body>
    </html>
  );
}
