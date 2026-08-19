import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: `About Us | ${siteConfig.name}`,
  description: `Discover how ${siteConfig.name} (${siteConfig.domain}) helps Filipino examinees prepare smarter for the Philippine Civil Service Examination through structured practice, rationalizations, and collaborative learning.`,
  alternates: {
    canonical: `${siteConfig.url}/about`,
  },
};

export default function AboutPage() {
  const tools = [
    {
      title: "Comprehensive Practice Question Bank",
      description: "Carefully curated and taxonomy-tagged questions across Numerical, Verbal, Analytical, and General Information sections.",
      icon: "📚",
    },
    {
      title: "Full 170-Item Timed Mock Exams",
      description: "Authentic exam simulations with precise CSC time constraints, category diagnostic breakdowns, and passing percentage evaluations.",
      icon: "⏱️",
    },
    {
      title: "Smart Elimination Drills",
      description: "Learn to spot distractors, extreme language, and deceptive answer traps before selecting the correct choice.",
      icon: "🎯",
    },
    {
      title: "Active Recall Flashcards",
      description: "Master vocabulary in context, Philippine Constitution provisions (1987), RA 6713 ethical standards, and vital math formulas.",
      icon: "🎴",
    },
    {
      title: "Automated Mistake Notebook",
      description: "Every missed item is cataloged with explanation bookmarks so you can re-drill your weak areas until mastery.",
      icon: "📓",
    },
    {
      title: "Study Together Hub & Virtual Classrooms",
      description: "Join fellow examinees in collaborative study rooms featuring synchronized whiteboards, direct messaging, and audio discussion.",
      icon: "👥",
    },
  ];

  const methodology = [
    {
      step: "1. Conceptual Understanding",
      detail: "We emphasize understanding WHY an answer is correct rather than relying on rote memorization of static answer keys.",
    },
    {
      step: "2. Strategic Distractor Elimination",
      detail: "Every option in our reviewer is accompanied by an explanation of why it is incorrect or a trap.",
    },
    {
      step: "3. Timed Exam Conditioning",
      detail: "Building speed and pacing stamina so you finish all 170 items comfortably within the official 3 hour and 10 minute limit.",
    },
    {
      step: "4. Continuous Targeted Remediation",
      detail: "Our analytics instantly highlight your lowest-performing sub-topics for immediate focused drill sessions.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-600 transition">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-900">About Us</span>
        </div>

        {/* HERO BANNER */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs font-bold text-blue-200">
            <span>🇵🇭</span>
            <span>Independent Philippine Civil Service Reviewer</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            About {siteConfig.name}
          </h1>
          <p className="text-sm sm:text-base text-blue-100 max-w-2xl leading-relaxed font-medium">
            Helping Filipinos prepare smarter, practice effectively, and approach the Civil Service Examination with genuine confidence.
          </p>
        </div>

        {/* MISSION & VISION */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Our Mission
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              Make Quality CSE Review Accessible, Organized &amp; Affordable
            </h2>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed font-medium">
            <strong>{siteConfig.name}</strong> was born from a simple observation: thousands of ambitious Filipinos take the Civil Service Examination every year, yet many struggle with fragmented study PDFs, outdated answer keys that don&apos;t explain the underlying reasoning, and expensive in-person review centers that conflict with busy work schedules.
          </p>
          <p className="text-slate-700 text-sm leading-relaxed font-medium">
            We built a unified, cloud-accessible learning platform where independent examinees can test themselves under real exam conditions, understand every mistake with step-by-step rationalizations, eliminate wrong choices strategically, and even study together with fellow applicants nationwide.
          </p>
        </div>

        {/* INDEPENDENT PLATFORM NOTICE */}
        <div className="bg-amber-50 rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm uppercase tracking-wider">
            <span>⚠️</span>
            <span>Independent Educational Platform Notice</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
            <strong>{siteConfig.name}</strong> ({siteConfig.domain}) is an independent educational reviewer platform. We are <strong>not the Civil Service Commission (CSC)</strong> and are not affiliated with, sponsored by, or endorsed by the Civil Service Commission or any Philippine government agency.
          </p>
          <p className="text-xs text-amber-900 leading-relaxed">
            All practice questions, sample challenges, flashcards, explanations, and study guides are original educational materials developed to assist learners. For official announcements, test dates, and government registration requirements, please refer directly to the Civil Service Commission&apos;s official website at <a href="https://csc.gov.ph" target="_blank" rel="noopener noreferrer" className="underline font-bold">csc.gov.ph</a>.
          </p>
        </div>

        {/* WHAT WE PROVIDE */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Platform Features
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              What {siteConfig.name} Provides
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tools.map((tool, idx) => (
              <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tool.icon}</span>
                  <h3 className="font-extrabold text-sm text-slate-900">{tool.title}</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* OUR LEARNING METHODOLOGY */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Our Methodology
            </span>
            <h2 className="text-2xl font-black text-slate-900">
              The {siteConfig.name} 4-Pillar Prep Strategy
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {methodology.map((m, i) => (
              <div key={i} className="p-5 bg-blue-50/50 rounded-2xl border border-blue-200/70 space-y-1.5">
                <h3 className="font-black text-xs uppercase tracking-wider text-blue-900">{m.step}</h3>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {m.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA CARD */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-lg">
          <h2 className="text-2xl sm:text-3xl font-black">Ready to Start Reviewing?</h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto font-medium leading-relaxed">
            Experience the difference with structured mock exams, detailed rationalizations, and active learning tools.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-white text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl shadow-md hover:bg-slate-50 transition"
            >
              Start Reviewing Free
            </Link>
            <Link
              href="/contact"
              className="px-8 py-3.5 bg-white/15 border border-white/30 text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-white/25 transition"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
