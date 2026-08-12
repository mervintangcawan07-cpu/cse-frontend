"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  // Sample Question Widget State
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ⚡ Auto-redirect active logged-in users (<30 min inactivity) to Dashboard
  useEffect(() => {
    async function checkActiveSession() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            router.replace("/dashboard");
          }
        }
      } catch (err) {
        // Session invalid or expired -> Stay on landing page
      }
    }
    checkActiveSession();
  }, [router]);

  const sampleQuestion = {
    category: "General Information & PH Constitution",
    prompt:
      "According to Article XI of the 1987 Philippine Constitution, public office is a public trust. Who among the following officers may be removed from office by impeachment?",
    options: [
      "A. Cabinet Secretaries and Department Undersecretaries",
      "B. The President, Vice-President, Members of Supreme Court, and Ombudsman",
      "C. Members of the House of Representatives and Senators",
      "D. Provincial Governors and City Mayors",
    ],
    correctIndex: 1,
    explanation:
      "Article XI, Section 2 specifies that the President, Vice-President, Members of the Supreme Court, Members of the Constitutional Commissions, and the Ombudsman may be removed from office on impeachment.",
  };

  const categories = [
    {
      title: "Numerical Reasoning",
      icon: "🧮",
      items: "Basic Operations, Word Problems, Data Interpretation, Number Series",
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-400",
      badgeBg: "bg-blue-600",
    },
    {
      title: "Verbal Ability",
      icon: "📖",
      items:
        "Grammar & Correct Usage, Vocabulary, Paragraph Organization, Reading Comprehension",
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-400",
      badgeBg: "bg-emerald-600",
    },
    {
      title: "Analytical Ability",
      icon: "🧩",
      items: "Logic, Word Association, Assumptions, Logical Reasoning",
      color: "from-purple-500/10 to-violet-500/10 border-purple-500/30 text-purple-400",
      badgeBg: "bg-purple-600",
    },
    {
      title: "General Information",
      icon: "🇵🇭",
      items: "Philippine Constitution, RA 6713, Peace & Human Rights, Environment",
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-400",
      badgeBg: "bg-amber-600",
    },
  ];

  const features = [
    {
      title: "Smart Mock Exams",
      description: "Simulate the real Civil Service Exam with timed, adaptive tests.",
      icon: "⏱️",
    },
    {
      title: "Active Recall Flashcards",
      description: "Master vocabulary, constitution articles, and formulas faster.",
      icon: "🎴",
    },
    {
      title: "In-Depth Rationalizations",
      description:
        "Understand exactly why an answer is correct with detailed explanations.",
      icon: "🧠",
    },
    {
      title: "Performance Analytics",
      description:
        "Track your progress and pinpoint your weakest subjects instantly.",
      icon: "📊",
    },
  ];

  const pricingPlans = [
    {
      name: "1-Month Pass",
      price: "₱99",
      duration: "Valid for 30 Days",
      description: "Ideal for quick, intensive last-minute review.",
      popular: false,
    },
    {
      name: "6-Month Pass",
      price: "₱199",
      duration: "Valid for 180 Days",
      description: "Recommended for structured multi-month exam prep.",
      popular: true,
    },
    {
      name: "1-Year Pass",
      price: "₱299",
      duration: "Valid for 365 Days",
      description: "Best value for long-term study across exam schedules.",
      popular: false,
    },
  ];

  const faqs = [
    {
      q: "Does this reviewer cover both Professional and Sub-Professional levels?",
      a: "Yes! All major core subjects—Numerical, Verbal, Analytical, and General Information—are structured to prepare you for both examination levels.",
    },
    {
      q: "What is the passing grade for the Civil Service Exam?",
      a: "To pass the official CSC Examination (PPT or COMEX), an examinee must obtain an overall general rating of at least 80.00%.",
    },
    {
      q: "Can I access the study materials on my smartphone?",
      a: "Absolutely. CSE Reviewer is fully optimized for mobile browsers, laptops, and tablets so you can review anywhere, anytime.",
    },
    {
      q: "How often is the question bank updated?",
      a: "Our mock exams and rationalizations are continuously reviewed and aligned with the latest Civil Service Commission syllabus guidelines.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Navigation Bar */}
        <nav className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 sm:px-8 py-4 flex justify-between items-center shadow-md">
          <Link
            href="/"
            className="flex items-center gap-2 font-black text-lg text-white tracking-tight"
          >
            <span className="p-1.5 bg-blue-600 rounded-lg text-xs">CSE</span>
            <span>Reviewer</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-300">
            <a href="#sample" className="hover:text-white transition">Sample Test</a>
            <a href="#scope" className="hover:text-white transition">Review Scope</a>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing Plans</a>
            <a href="#faqs" className="hover:text-white transition">FAQs</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-2 font-semibold text-xs text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 font-bold text-xs text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition shadow-md"
            >
              Start Free
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Hero Section */}
          <section className="relative px-4 py-16 sm:py-24 max-w-4xl mx-auto text-center space-y-6">
            <span className="inline-block px-4 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full text-xs font-bold tracking-wide uppercase">
              🇵🇭 Philippines' #1 CSE Exam Prep
            </span>

            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight">
              Pass the Civil Service Exam on your{" "}
              <span className="text-blue-500">first try.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Stop guessing and start passing. Join thousands of Filipinos who passed the exam using our smart mock exams, flashcards, and detailed rationalizations.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 font-black text-sm text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-2xl shadow-xl transition"
              >
                🚀 Start Reviewing Now
              </Link>
              <a
                href="#pricing"
                className="w-full sm:w-auto px-8 py-4 font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 transition"
              >
                🔒 View Access Plans
              </a>
            </div>
          </section>

          {/* Interactive Mini Sample Question Widget */}
          <section id="sample" className="px-4 py-8 max-w-3xl mx-auto w-full">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <span className="text-xs font-black uppercase text-blue-400 tracking-wider">
                    Instant Sample Question Test
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                  Try it out!
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {sampleQuestion.category}
                </p>
                <h2 className="text-sm sm:text-base font-bold text-white leading-relaxed">
                  {sampleQuestion.prompt}
                </h2>

                <div className="space-y-2.5 pt-2">
                  {sampleQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === sampleQuestion.correctIndex;

                    let btnStyle =
                      "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700";
                    if (showExplanation) {
                      if (isCorrect)
                        btnStyle =
                          "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold";
                      else if (isSelected)
                        btnStyle =
                          "bg-rose-500/20 border-rose-500/50 text-rose-300 font-medium";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedOption(idx);
                          setShowExplanation(true);
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border text-xs sm:text-sm transition flex items-center justify-between ${btnStyle}`}
                      >
                        <span>{opt}</span>
                        {showExplanation && isCorrect && (
                          <span className="text-emerald-400 font-extrabold text-xs">
                            ✓ Correct
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {showExplanation && (
                  <div className="p-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl space-y-1 text-xs text-slate-200">
                    <p className="font-extrabold uppercase text-[10px] text-blue-400">
                      Official Rationalization:
                    </p>
                    <p className="leading-relaxed font-medium">
                      {sampleQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Key Metrics Bar */}
          <section className="bg-slate-900 border-y border-slate-800 py-10 px-6 mt-8">
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-amber-400">
                  10,000+
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Practice Questions
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-blue-400">
                  88%
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Target Pass Rate
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">
                  100%
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Updated CSC Syllabus
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-purple-400">
                  24 / 7
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Mobile & Desktop Access
                </p>
              </div>
            </div>
          </section>

          {/* Comprehensive Scope Section */}
          <section id="scope" className="py-16 px-6 max-w-6xl mx-auto w-full space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                Comprehensive Review Scope
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">
                Master Every Subject Tested on Exam Day
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Covering both Professional and Sub-Professional Civil Service exam levels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-3xl border bg-gradient-to-br ${cat.color} space-y-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{cat.icon}</span>
                      <h3 className="text-lg font-black text-white">{cat.title}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 ${cat.badgeBg} text-white font-bold text-[10px] rounded-full uppercase`}
                    >
                      CSC Standard
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {cat.items}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Features Grid */}
          <section id="features" className="py-16 px-6 max-w-6xl mx-auto w-full space-y-10">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Everything you need to succeed
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm">
                Designed specifically for Philippine Civil Service examinees.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-4"
                >
                  <div className="w-12 h-12 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center text-2xl">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-bold text-white">{feature.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* PRICING PLANS SECTION */}
          <section id="pricing" className="py-16 bg-slate-900/60 border-t border-slate-800 px-6">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Transparent Pricing
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Choose Your PRO Review Pass
                </h2>
                <p className="text-xs text-slate-400">
                  Pay once via GCash, Maya, Card, or QRPH. No auto-recurring fees.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pricingPlans.map((plan, idx) => (
                  <div
                    key={idx}
                    className={`p-6 rounded-3xl border flex flex-col justify-between space-y-6 relative ${
                      plan.popular
                        ? "bg-slate-900 border-2 border-amber-500 shadow-2xl"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 right-6 px-3 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase">
                        Most Popular
                      </span>
                    )}

                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {plan.name}
                      </span>
                      <div className="text-3xl font-black text-amber-400">
                        {plan.price}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          / {plan.duration}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <Link
                      href="/signup"
                      className={`w-full py-3 text-center text-xs font-bold rounded-xl transition ${
                        plan.popular
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                          : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                      }`}
                    >
                      Get Started
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Frequently Asked Questions */}
          <section id="faqs" className="py-16 px-6 max-w-3xl mx-auto w-full space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                Got Questions?
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden transition"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full p-4 text-left font-bold text-xs sm:text-sm text-white flex justify-between items-center gap-4 hover:text-blue-400 transition"
                    >
                      <span>{faq.q}</span>
                      <span className="text-slate-400 font-black text-base">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bottom Callout Banner */}
          <section className="py-12 px-6 max-w-5xl mx-auto w-full">
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl" />

              <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
                Ready to Secure Your Government Career?
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto font-medium leading-relaxed">
                Start practicing with real CSE-aligned questions today. No app installation required.
              </p>

              <div className="pt-2">
                <Link
                  href="/signup"
                  className="inline-block px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition hover:scale-105"
                >
                  Create Your Free Account Now 🇵🇭
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-8 px-6 text-center text-xs space-y-2">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <Link href="/" className="font-black text-white">
              CSE <span className="text-blue-500">Reviewer</span>
            </Link>
            <p>© 2026 CSE Reviewer Philippines. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}