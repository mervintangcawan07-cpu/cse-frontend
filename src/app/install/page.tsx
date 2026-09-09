// Relative Path: src/app/install/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Zap, ShieldCheck, Laptop, ArrowLeft, BookOpen } from "lucide-react";
import InstallAppClient from "@/components/pwa/InstallAppClient";

export const metadata: Metadata = {
  title: "Install GovStudyX",
  description:
    "Install GovStudyX on your phone or computer for quick access to Civil Service Exam review tools.",
  alternates: {
    canonical: "https://govstudyx.com/install",
  },
};

export default function InstallPage() {
  const benefits = [
    {
      title: "Quick access",
      description: "Launch GovStudyX directly from your home screen.",
      icon: Zap,
    },
    {
      title: "Safe offline fallback",
      description:
        "Get a clear offline screen without caching sensitive exam, account, or payment data.",
      icon: ShieldCheck,
    },
    {
      title: "App-like study experience",
      description:
        "Open GovStudyX in standalone mode with less browser UI distraction.",
      icon: Laptop,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-slate-900 dark:text-slate-100 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-8">
        {/* Navigation back link */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900">
            Progressive Web App
          </span>
        </div>

        {/* HERO / INSTALL CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6">
          {/* App Icon */}
          <div className="flex justify-center">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-800">
              <Image
                src="/icons/icon-192x192.png"
                alt="GovStudyX Application Icon"
                width={96}
                height={96}
                priority
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Title & Tagline */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Install GovStudyX
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
              Review anytime with quick access from your home screen.
            </p>
          </div>

          {/* Dynamic Interactive Install Component */}
          <div className="pt-2">
            <InstallAppClient />
          </div>
        </div>

        {/* BENEFITS SECTION */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Why Install GovStudyX
          </h2>
          <div className="grid gap-3 sm:grid-cols-1">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs"
                >
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {b.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER NAVIGATION */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          <Link
            href="/"
            className="hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            Home
          </Link>
          <Link
            href="/practice"
            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Practice Drills</span>
          </Link>
          <Link
            href="/about"
            className="hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            About
          </Link>
          <Link
            href="/terms"
            className="hover:text-slate-900 dark:hover:text-slate-200 transition"
          >
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
