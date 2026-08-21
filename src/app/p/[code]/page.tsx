import React from "react";
import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ShieldCheck,
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
  Star,
  Users,
  Zap,
} from "lucide-react";

interface PartnerLandingProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata(
  { params }: PartnerLandingProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { code } = await params;
  const cleanCode = decodeURIComponent(code).trim();

  const partner = await prisma.partner.findFirst({
    where: {
      OR: [
        { slug: { equals: cleanCode, mode: "insensitive" } },
        { code: { equals: cleanCode, mode: "insensitive" } },
      ],
      status: "ACTIVE",
    },
    select: {
      name: true,
      tagline: true,
      badgeText: true,
      description: true,
    },
  });

  if (!partner) {
    return {
      title: "Civil Service Exam Reviewer 2026 | GovStudyX",
      description: "Official online practice exam simulator and reviewer for Philippine Civil Service Exam aspirants.",
    };
  }

  const title = `Special Invitation from ${partner.name} — GovStudyX Civil Service Review 2026`;
  const description =
    partner.tagline ||
    partner.description ||
    "Prepare and pass the Philippine Civil Service Exam with 2,500+ updated practice questions, timed mock exams, and item rationalizations.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://govstudyx.com/p/${cleanCode}`,
      siteName: "GovStudyX",
      type: "website",
      locale: "en_PH",
      images: [
        {
          url: "/icons/og-image.png",
          width: 1200,
          height: 630,
          alt: `GovStudyX Partner: ${partner.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/icons/og-image.png"],
    },
  };
}

export default async function PartnerLandingPage({ params }: PartnerLandingProps) {
  const { code } = await params;
  const cleanCode = decodeURIComponent(code).trim();

  // Find partner by slug or uppercase code
  const partner = await prisma.partner.findFirst({
    where: {
      OR: [
        { slug: { equals: cleanCode, mode: "insensitive" } },
        { code: { equals: cleanCode, mode: "insensitive" } },
      ],
      status: "ACTIVE",
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      tagline: true,
      badgeText: true,
      description: true,
      discountPercent: true,
      avatarUrl: true,
    },
  });

  if (!partner) {
    notFound();
  }

  // Set Attribution Cookies (30 days)
  const cookieStore = await cookies();
  cookieStore.set("cse_partner_ref", partner.code, {
    httpOnly: false, // Accessible to client-side checkout scripts if needed
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  cookieStore.set("cse_ref", partner.code, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Verified Security Bar */}
      <div className="bg-emerald-950/80 border-b border-emerald-800/60 py-2.5 px-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-emerald-300">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official Civil Service Review Platform</span>
          </span>
          <span className="hidden sm:inline text-emerald-700">•</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>BSP-Regulated Secure 256-Bit SSL Checkout</span>
          </span>
          <span className="hidden sm:inline text-emerald-700">•</span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Trusted by 10,000+ CSE Aspirants</span>
          </span>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
              G
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                GovStudyX <span className="text-emerald-400 text-xs px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800">CSE 2026</span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={`/login?ref=${partner.code}`}
              className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 transition"
            >
              Sign In
            </Link>
            <Link
              href={`/signup?ref=${partner.code}`}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              Start Practice Free
            </Link>
          </div>
        </div>
      </header>

      {/* Partner Co-Branded Welcome Hero */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-8 text-center relative z-10">
          {/* Partner Endorsement Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300">
              Special Invitation via <strong className="text-emerald-400">{partner.name}</strong>
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
              {partner.badgeText || "Official Partner"}
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              Pass the Civil Service Exam on Your First Take.
            </h1>
            <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
              {partner.tagline ||
                "Access 2,500+ updated practice questions, timed mock exams, and in-depth rationalizations for Professional and Sub-Professional levels."}
            </p>
          </div>

          {/* Quick Partner Trust Card */}
          <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl max-w-2xl mx-auto shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{partner.name}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    VERIFIED
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {partner.description || "Official educational collaborator for GovStudyX Civil Service Exam preparation."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>2,500+ Questions</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Timed Mock Exams</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>AI Rationalizations</span>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href={`/signup?ref=${partner.code}`}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl transition shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 group"
            >
              <span>Create Free Account &amp; Practice</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>

            <Link
              href={`/pricing?ref=${partner.code}`}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>View PRO Subscription Plans</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Guarantee Grid */}
      <section className="py-16 bg-slate-900/40 border-t border-b border-slate-800/80 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Why Examinees Choose GovStudyX
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Designed specifically according to the latest Philippine Civil Service Commission test scope.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Comprehensive Scope</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verbal ability, numerical reasoning, analytical ability, and general information (Philippine Constitution, Code of Conduct RA 6713).
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Realistic Exam Simulator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Experience actual 170-item and 165-item timed simulations with automated score diagnostic feedback and performance tracking.
              </p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Safe &amp; Legitimacy Guaranteed</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                100% cloud-based, ad-free study environment. No spam, no sketchy downloads, and transparent billing via PayMongo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} GovStudyX. All rights reserved. Co-branded educational partner page for {partner.name}.</p>
      </footer>
    </div>
  );
}
