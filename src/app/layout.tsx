import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { ConnectionBanner } from "@/components/connection-banner";
import { ThemeScript } from "@/components/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BT Warehouse", template: "%s · BT Warehouse" },
  description: "Warehouse management for Bond Therapy and Rich Fill",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLocale()} className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider>
          <ConnectionBanner />
          {children}
          <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 4000 }} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
