import Link from "next/link";
import LandingAuthRedirect from "@/components/landing/LandingAuthRedirect";
import LandingNav from "@/components/landing/LandingNav";
import SampleChallengeSection from "@/components/landing/SampleChallengeSection";
import PricingSection from "@/components/landing/PricingSection";
import FaqSection from "@/components/landing/FaqSection";

const scopeCategories = [
  {
    title: "Numerical Ability",
    icon: "🧮",
    items: "Arithmetic operations, word problems, ratios & proportions, percentage change, work & rate, data interpretation.",
    accent: "border-blue-200 bg-blue-50/50 text-blue-900",
    pill: "bg-blue-600 text-white",
  },
  {
    title: "Verbal Ability",
    icon: "📖",
    items: "Grammar & correct usage, vocabulary in context, synonyms & antonyms, paragraph organization, reading comprehension.",
    accent: "border-indigo-200 bg-indigo-50/50 text-indigo-900",
    pill: "bg-indigo-600 text-white",
  },
  {
    title: "Analytical Ability",
    icon: "🧩",
    items: "Logical sequencing, deductive reasoning, conditional logic, word association, assumption identification.",
    accent: "border-purple-200 bg-purple-50/50 text-purple-900",
    pill: "bg-purple-600 text-white",
  },
  {
    title: "General Information",
    icon: "🇵🇭",
    items: "Philippine Constitution (1987), RA 6713 (Code of Conduct), peace & human rights, environmental concepts.",
    accent: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
    pill: "bg-emerald-600 text-white",
  },
];

const coreFeatures = [
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
      {/* Headless client island for authenticated user redirect */}
      <LandingAuthRedirect />

      {/* Marketing Top Navigation with Mobile Drawer Island */}
      <LandingNav />

      {/* MAIN BODY */}
      <main className="flex-1 flex flex-col">
        {/* HERO SECTION */}
        <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-12 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200/80 rounded-full text-xs font-bold text-blue-700 shadow-2xs">
            <span>🇵🇭</span>
            <span>Comprehensive Philippine Civil Service Reviewer</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Prepare Smarter for the <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              Civil Service Examination
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            Practice challenging CSE-style questions, understand why each answer is correct, learn how to eliminate wrong choices, and build stronger exam reasoning skills.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3.5 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 font-black text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:opacity-95 rounded-2xl shadow-lg shadow-blue-600/20 transition transform active:scale-98 text-center"
            >
              Start Reviewing Free
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-4 font-bold text-sm text-slate-700 bg-white hover:bg-slate-50 rounded-2xl border border-slate-300/80 shadow-xs transition text-center"
            >
              Explore PRO Plans
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="pt-6 flex flex-wrap justify-center items-center gap-4 sm:gap-8 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-black">✓</span>
              <span>Updated 2026 CSC Syllabus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-black">✓</span>
              <span>In-Depth Step-by-Step Rationalizations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-black">✓</span>
              <span>Mobile, Tablet & PC Accessible</span>
            </div>
          </div>
        </section>

        {/* 3-QUESTION INTERACTIVE PRO CHALLENGE */}
        <SampleChallengeSection />

        {/* COMPREHENSIVE REVIEW SCOPE */}
        <section id="scope" className="py-14 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Exam Coverage
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              Master Every Subject on Exam Day
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Structured to prepare you for both Professional and Sub-Professional Civil Service exam levels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {scopeCategories.map((cat, idx) => (
              <div
                key={idx}
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
        <section id="features" className="py-14 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Platform Features
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Everything Built for Serious Review
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Tools specifically engineered to improve your speed, accuracy, and reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {coreFeatures.map((feat, i) => (
              <div
                key={i}
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
        <section id="classmates" className="py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 rounded-3xl p-6 sm:p-10 shadow-sm flex flex-col md:flex-row items-center gap-8">
            <div className="space-y-4 flex-1 text-center md:text-left">
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-indigo-600 text-white rounded-full">
                Study Together Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Connect with Fellow Examinees
              </h2>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                Never study alone. Add study classmates, send direct 1-on-1 messages to discuss challenging problems, invite friends to shared study rooms, and review together in real time.
              </p>
              <div className="pt-2 flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold text-indigo-900">
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

            <div className="w-full md:w-80 bg-white border border-indigo-200 rounded-2xl p-4 shadow-md space-y-3">
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
                  <p className="text-slate-700">&quot;How did you eliminate Choice C in the proportion problem?&quot;</p>
                </div>
                <div className="p-2.5 bg-blue-600 text-white rounded-xl space-y-0.5 text-right">
                  <p className="font-bold text-blue-100 text-[11px]">You:</p>
                  <p className="text-white">&quot;Check the common trap: C forgets the initial 2 hours work!&quot;</p>
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
        <section className="py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              Ready to Pass the Civil Service Exam?
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm max-w-xl mx-auto font-medium leading-relaxed">
              Start practicing with realistic questions, in-depth rationalizations, and collaborative study tools today.
            </p>

            <div className="pt-2">
              <Link
                href="/signup"
                className="inline-block px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-black text-sm rounded-2xl shadow-lg transition transform hover:scale-105 active:scale-98"
              >
                Create Your Account Now 🇵🇭
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
