// Relative Path: src/app/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

// 1. Static Asset Imports
import heroBg1 from "./image3-2.webp";
import mobileHeroBg from "@/app/image-final.webp";

// 2. Component Imports
import LandingAuthRedirect from "@/components/landing/LandingAuthRedirect";
import SampleChallengeSection from "@/components/landing/SampleChallengeSection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";
import InstallEntryLink from "@/components/pwa/InstallEntryLink";
import MobileHeroExperience from "@/components/landing/MobileHeroExperience";
import TabletHeroExperience from "@/components/landing/TabletHeroExperience";

const homepageTitle = "Philippine Civil Service Exam Reviewer & Mock Exams";
const homepageDescription =
  "Prepare for the Philippine Civil Service Examination with realistic CSE questions, mock exams, flashcards, drills, and detailed answer rationalizations.";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${homepageTitle} | ${siteConfig.name}`,
    description: homepageDescription,
  },
  twitter: {
    card: "summary",
    title: `${homepageTitle} | ${siteConfig.name}`,
    description: homepageDescription,
  },
};

const homepageStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: siteConfig.url,
    description: siteConfig.description,
    email: siteConfig.emails.general,
    areaServed: {
      "@type": "Country",
      name: "Philippines",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: homepageDescription,
    inLanguage: "en-PH",
    publisher: {
      "@id": `${siteConfig.url}/#organization`,
    },
  },
] as const;

interface ScopeCategory {
  title: string;
  icon: string;
  items: string;
  accent: string;
  pill: string;
}

interface CoreFeature {
  title: string;
  description: string;
  icon: string;
  tag: string;
}

const scopeCategories: readonly ScopeCategory[] = [
  {
    title: "Numerical Ability",
    icon: "🧮",
    items:
      "Arithmetic operations, word problems, ratios & proportions, percentage change, work & rate, data interpretation.",
    accent: "border-blue-200 bg-blue-50/50 text-blue-900",
    pill: "bg-blue-600 text-white",
  },
  {
    title: "Verbal Ability",
    icon: "📖",
    items:
      "Grammar & correct usage, vocabulary in context, synonyms & antonyms, paragraph organization, reading comprehension.",
    accent: "border-indigo-200 bg-indigo-50/50 text-indigo-900",
    pill: "bg-indigo-600 text-white",
  },
  {
    title: "Analytical Ability",
    icon: "🧩",
    items:
      "Logical sequencing, deductive reasoning, conditional logic, word association, assumption identification.",
    accent: "border-purple-200 bg-purple-50/50 text-purple-900",
    pill: "bg-purple-600 text-white",
  },
  {
    title: "General Information",
    icon: "🇵🇭",
    items:
      "Philippine Constitution (1987), RA 6713 (Code of Conduct), peace & human rights, environmental concepts.",
    accent: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
    pill: "bg-emerald-600 text-white",
  },
];

const coreFeatures: readonly CoreFeature[] = [
  {
    title: "Timed Mock Exams",
    description:
      "Practice with authentic 170-item exams timed under real CSC conditions with category diagnostic breakdown.",
    icon: "⏱️",
    tag: "Exam Simulation",
  },
  {
    title: "Smart Elimination Drills",
    description:
      "Learn why wrong choices are traps. Every option includes a rationale so you learn to eliminate distractors fast.",
    icon: "🎯",
    tag: "Strategy",
  },
  {
    title: "Active Recall Flashcards",
    description:
      "Master tricky vocabulary words, constitutional provisions, and math formulas with interactive flashcards.",
    icon: "🎴",
    tag: "Quick Review",
  },
  {
    title: "Mistake Notebook",
    description:
      "Every question you miss is automatically saved in your personal notebook for focused re-drilling until mastered.",
    icon: "📓",
    tag: "Targeted Prep",
  },
  {
    title: "Study Classmates & Messaging",
    description:
      "Connect with fellow examinees, add study buddies, and direct message to discuss questions and share tips.",
    icon: "👥",
    tag: "Collaborative Study",
  },
  {
    title: "Study Rooms & Live Whiteboard",
    description:
      "Join virtual study rooms with shared topics, real-time interactive whiteboard solving, and audio discussion.",
    icon: "🎨",
    tag: "Interactive Stage",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <LandingAuthRedirect />

      <main className="flex-1 flex flex-col">
       {/* ================================================================= */}
        {/* 1. PORTRAIT VIEW                                                   */}
        {/* Phones & tablets in portrait keep the existing mobile experience. */}
        {/* ================================================================= */}
        <div className="block xl:hidden landscape:hidden">
          <MobileHeroExperience heroImage={mobileHeroBg} />
        </div>

        {/* ================================================================= */}
        {/* 2. SMALL LANDSCAPE FALLBACK                                        */}
        {/* Preserve the existing landscape experience only for small phones. */}
        {/* Tablet landscape no longer uses the dark tablet hero.              */}
        {/* ================================================================= */}
        <div className="hidden max-md:landscape:block">
          <TabletHeroExperience heroImage={heroBg1} />
        </div>

        {/* ================================================================= */}
        {/* 3. TABLET LANDSCAPE + DESKTOP                                      */}
        {/* Both now use the primary light GovStudyX landing-page experience.  */}
        {/* ================================================================= */}
        <div className="hidden md:landscape:block xl:block">
          {/* DESKTOP HERO */}
          <section className="relative w-full border-b border-slate-200/60 overflow-hidden min-h-[620px] lg:min-h-[680px] xl:min-h-[720px] flex items-center">
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <Image
                src={heroBg1}
                alt="Civil Service examination candidate reviewing on desktop"
                fill
                priority
                quality={75}
                sizes="(min-width: 1280px) 100vw, 0px"
                className="object-cover object-[68%_center] lg:object-center"
              />
              <div className="absolute inset-y-0 left-0 w-[72%] lg:w-[62%] xl:w-1/2 bg-gradient-to-r from-slate-50/95 via-slate-50/65 lg:via-slate-50/45 xl:via-slate-50/35 to-transparent pointer-events-none" />
            </div>

            <div className="relative z-10 w-full px-8 lg:px-12 xl:pl-16 xl:pr-8 mt-8 mb-7">
             <div className="max-w-[640px] lg:max-w-3xl text-left space-y-6 lg:space-y-8">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-50/90 backdrop-blur-sm border border-blue-200/80 rounded-full text-sm font-bold text-blue-700 shadow-xs">
                  <span className="text-base">🇵🇭</span>
                  <span>Comprehensive Philippine Civil Service Reviewer</span>
                </div>

                <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-slate-900 tracking-tight leading-[1.12]">
                  Prepare Smarter for the <br />
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                    Civil Service Examination
                  </span>
                </h1>

                <p className="text-base lg:text-lg xl:text-xl text-slate-700 leading-relaxed font-medium max-w-2xl">
                  Practice challenging CSE-style questions, understand why each answer is correct,
                  learn how to eliminate wrong choices, and build stronger exam reasoning skills.
                </p>

                <div className="flex flex-row flex-wrap items-center gap-3 lg:gap-4 pt-3">
                  <Link
                    href="/signup"
                    className="px-6 lg:px-8 xl:px-9 py-3.5 lg:py-4 font-black text-sm lg:text-base text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 rounded-2xl shadow-lg shadow-blue-600/20 transition transform active:scale-98 text-center"
                  >
                    Start Reviewing Free
                  </Link>
                  <a
                    href="#pricing"
                    className="px-6 lg:px-8 xl:px-9 py-3.5 lg:py-4 font-bold text-sm lg:text-base text-slate-700 bg-white/90 backdrop-blur-sm hover:bg-white rounded-2xl border border-slate-300/80 shadow-xs transition text-center"
                  >
                    Explore PRO Plans
                  </a>
                  <InstallEntryLink
                    label="Install GovStudyX"
                    className="px-6 lg:px-7 py-3.5 lg:py-4 font-bold text-sm lg:text-base text-blue-700 bg-blue-50/90 backdrop-blur-sm hover:bg-blue-100 rounded-2xl border border-blue-200/80 shadow-xs transition text-center inline-flex items-center justify-center gap-2"
                  />
                </div>

                <div className="pt-4 flex flex-row flex-wrap items-center gap-x-6 gap-y-3 lg:gap-x-8 text-sm lg:text-base font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-black text-lg">✓</span>
                    <span>Updated 2026 CSC Syllabus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-black text-lg">✓</span>
                    <span>In-Depth Step-by-Step Rationalizations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-black text-lg">✓</span>
                    <span>Mobile, Tablet &amp; PC Accessible</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3-QUESTION INTERACTIVE PRO CHALLENGE */}
          <SampleChallengeSection />

          {/* COMPREHENSIVE REVIEW SCOPE */}
          <section id="scope" className="py-14 px-6 max-w-6xl mx-auto w-full space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Exam Coverage
              </span>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900">
                Master Every Subject on Exam Day
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                Structured to prepare you for both Professional and Sub-Professional Civil Service exam levels.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {scopeCategories.map((cat) => (
                <div
                  key={cat.title}
                  className={`p-6 rounded-3xl border ${cat.accent} space-y-3 shadow-xs hover:shadow-md transition`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon}</span>
                      <h3 className="text-lg font-black">{cat.title}</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 ${cat.pill} font-extrabold text-[10px] rounded-full uppercase`}>
                      CSC Syllabus
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {cat.items}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* AUTHENTIC FEATURE SHOWCASE */}
          <section id="features" className="py-14 px-6 max-w-6xl mx-auto w-full space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Platform Features
              </span>
              <h2 className="text-2xl lg:text-3xl font-black text-slate-900">
                Everything Built for Serious Review
              </h2>
              <p className="text-slate-600 text-sm">
                Tools specifically engineered to improve your speed, accuracy, and reasoning.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {coreFeatures.map((feat) => (
                <div
                  key={feat.title}
                  className="p-6 bg-white rounded-3xl border border-slate-200/90 space-y-3.5 shadow-xs hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center text-xl">
                      {feat.icon}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">{feat.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {feat.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* STUDY CLASSMATES & MESSAGING HIGHLIGHT */}
          <section id="classmates" className="py-12 px-6 max-w-5xl mx-auto w-full">
            <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 rounded-3xl p-8 lg:p-10 shadow-xs flex flex-row items-center gap-8">
              <div className="space-y-4 flex-1 text-left">
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-indigo-600 text-white rounded-full">
                  Study Together Hub
                </span>
                <h2 className="text-2xl lg:text-3xl font-black text-slate-900">
                  Connect with Fellow Examinees
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  Never study alone. Add study classmates, send direct 1-on-1 messages to discuss challenging problems, invite friends to shared study rooms, and review together in real time.
                </p>
                <div className="pt-2 flex flex-wrap justify-start gap-4 text-xs font-bold text-indigo-900">
                  <div className="flex items-center gap-1.5">
                    <span>💬</span>
                    <span>Direct 1-on-1 Messaging</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>👥</span>
                    <span>Classmate Requests</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>Live Whiteboard Solving</span>
                  </div>
                </div>
              </div>

              <div className="w-80 bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900">Active Study Chat</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">Encrypted</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-slate-100 rounded-xl space-y-0.5">
                    <p className="font-bold text-indigo-950 text-[11px]">Classmate Maria:</p>
                    <p className="text-slate-700 leading-snug">
                      &quot;How did you eliminate Choice C in the proportion problem?&quot;
                    </p>
                  </div>
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl space-y-0.5 text-right">
                    <p className="font-bold text-blue-100 text-[11px]">You:</p>
                    <p className="text-white leading-snug">
                      &quot;Check the common trap: C forgets the initial 2 hours work!&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* PRICING PLANS */}
          <PricingSection />

          {/* FREQUENTLY ASKED QUESTIONS */}
          <FaqSection />

          {/* FINAL CALLOUT BANNER */}
          <section className="py-12 px-6 max-w-5xl mx-auto w-full">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-10 lg:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
              <h2 className="text-3xl lg:text-4xl font-black tracking-tight">
                Ready to Pass the Civil Service Exam?
              </h2>
              <p className="text-blue-100 text-sm max-w-xl mx-auto font-medium leading-relaxed">
                Start practicing with realistic questions, in-depth rationalizations, and collaborative study tools today.
              </p>

              <div className="pt-2">
                <Link
                  href="/signup"
                  className="inline-block px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-black text-sm rounded-2xl shadow-lg transition transform hover:scale-105 active:scale-[0.98] text-center"
                >
                  Create Your Account Now 🇵🇭
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}