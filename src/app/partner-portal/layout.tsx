// Relative Path: src/app/partner-portal/layout.tsx
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GovStudyX Partner Portal — Exclusive Educational Ecosystem",
  description: "Exclusive Partner Portal for GovStudyX educational creators, organizations, and partners.",
};

export default function PartnerPortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 flex flex-col font-sans">
      {children}
    </div>
  );
}
