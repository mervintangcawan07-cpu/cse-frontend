import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FooterVisibility from "@/components/FooterVisibility";
import CookieConsent from "@/components/common/CookieConsent";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import AppViewportShell from "../components/common/AppViewportShell";
import { siteConfig } from "@/lib/config/site";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "GovStudyX",
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.json",
  metadataBase: new URL(siteConfig.url),
  appleWebApp: {
    capable: true,
    title: "GovStudyX",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <AppViewportShell>{children}</AppViewportShell>
          </AuthProvider>
        </ThemeProvider>

        <FooterVisibility>
          <Footer />
        </FooterVisibility>

        <CookieConsent />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}