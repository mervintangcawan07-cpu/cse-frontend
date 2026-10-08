// Relative Path: src/app/partner-portal/layout.tsx
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Portal",
  description:
    "Exclusive Partner Portal for GovStudyX educational creators, organizations, and partners.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PartnerPortalRootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 flex flex-col font-sans">
      {children}
    </div>
  );
}
