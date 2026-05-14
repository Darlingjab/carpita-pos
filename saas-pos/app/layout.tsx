import type { Metadata, Viewport } from "next";
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
  title: "Carpita POS",
  description: "Punto de venta — Carpita",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover para env(safe-area-inset-*) en iPhone con notch/Dynamic Island
  viewportFit: "cover",
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
