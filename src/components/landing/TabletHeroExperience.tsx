// Relative Path: src/components/landing/TabletHeroExperience.tsx
"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import defaultHeroBg from "@/app/image3-2.webp";
import InstallEntryLink from "@/components/pwa/InstallEntryLink";

interface TabletHeroExperienceProps {
  readonly heroImage?: StaticImageData | string;
}

const keyExamPills = [
  { icon: "🌟", label: "CSE Professional & Sub-Professional" },
  { icon: "⏱️", label: "Authentic 170-Item Timed Mock Exams" },
  { icon: "🎯", label: "Smart Trap Choice Elimination Drills" },
  { icon: "🧠", label: "Active Recall Flashcards & Notes" },
] as const;

export default function TabletHeroExperience({
  heroImage = defaultHeroBg,
}: TabletHeroExperienceProps) {
  return (
    <section
      className="relative w-full min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-6 sm:p-8 lg:p-12 overflow-y-auto"
      aria-label="Tablet Examination Showcase"
    >
      {/* Background Image with Layered Gradients */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <Image
          src={heroImage}
          alt="Civil service candidate studying"
          fill
          priority
          quality={75}
          sizes="(max-width: 1279px) 100vw, 0px"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/60 to-slate-950" />
      </div>

      {/* Symmetrical 2-Column Split Workspace */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center py-6">
        
        {/* LEFT COLUMN: Brand, Motivational Copy & Syllabus Pillars (7 cols) */}
        <div className="lg:col-span-7 space-y-6 text-left">
          {/* Top Brand Header */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-xs font-bold text-blue-300 shadow-sm">
            <span>🇵🇭</span>
            <span>Comprehensive Philippine Civil Service Reviewer</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.12] drop-shadow-md">
              Small Steps Every Day <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Make Big Dreams Come True
              </span>
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed max-w-xl">
              Keep studying. Your future in public service is worth it. Master challenging CSE questions with verified rationalizations.
            </p>
          </div>

          {/* Feature Pillars Stack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 max-w-xl">
            {keyExamPills.map((pill) => (
              <div
                key={pill.label}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-700/60 backdrop-blur-md shadow-sm"
              >
                <span className="text-lg shrink-0">{pill.icon}</span>
                <span className="text-xs sm:text-[13px] font-bold text-slate-200 leading-tight">
                  {pill.label}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Syllabus Verification */}
          <div className="flex items-center gap-6 pt-2 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-black text-sm">✓</span>
              <span>Updated 2026 CSC Syllabus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-black text-sm">✓</span>
              <span>Mobile, Tablet &amp; PC Sync</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Glassmorphic Launch Card (5 cols) */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            
            {/* Platform Brand Identity */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 relative shrink-0 overflow-hidden rounded-xl shadow-md">
                  <Image
                    src="/brand/govstudyx-icon.png"
                    alt="GovStudyX"
                    width={40}
                    height={40}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-2xl font-black tracking-tight text-white">
                  GovStudy<span className="text-amber-400">X</span>
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-400">
                Your Path to a Brighter Future
              </p>
            </div>

            {/* Quick Action Funnel */}
            <div className="space-y-3 pt-2">
              <Link
                href="/signup"
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>Start Reviewing Free</span>
                <span>&rarr;</span>
              </Link>

              <Link
                href="/login"
                className="w-full py-3.5 bg-slate-800/90 hover:bg-slate-800 active:scale-[0.98] border border-slate-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-sm transition flex items-center justify-center"
              >
                I already have an account
              </Link>

              <InstallEntryLink
                label="Install Tablet Web App"
                className="w-full py-3 bg-blue-950/40 hover:bg-blue-900/40 active:scale-[0.98] border border-blue-700/40 text-blue-300 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2"
              />
            </div>

            {/* Legal Tagline */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                GovStudyX is an independent educational platform not affiliated with the Civil Service Commission (CSC).
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}