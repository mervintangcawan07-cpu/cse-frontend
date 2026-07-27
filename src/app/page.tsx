"use client";

import { useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  // Sample Question Widget State
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const sampleQuestion = {
    category: "General Information & PH Constitution",
    prompt: "According to Article XI of the 1987 Philippine Constitution, public office is a public trust. Who among the following officers may be removed from office by impeachment?",
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
      color: "from-blue-500/10 to-indigo-500/10 border-blue-200 text-blue-700",
      badgeBg: "bg-blue-600",
    },
    {
      title: "Verbal Ability",
      icon: "📖",
      items: "Grammar & Correct Usage, Vocabulary, Paragraph Organization, Reading Comprehension",
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-700",
      badgeBg: "bg-emerald-600",
    },
    {
      title: "Analytical Ability",
      icon: "🧩",
      items: "Logic, Word Association, Assumptions, Logical Reasoning",
      color: "from-purple-500/10 to-violet-500/10 border-purple-200 text-purple-700",
      badgeBg: "bg-purple-600",
    },
    {
      title: "General Information",
      icon: "🇵🇭",
      items: "Philippine Constitution, RA 6713, Peace & Human Rights, Environment",
      color: "from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-700",
      badgeBg: "bg-amber-600",
    },
  ];

  const features = [
    { title: "Smart Mock Exams", description: "Simulate the real Civil Service Exam with timed, adaptive tests.", icon: "⏱️" },
    { title: "Active Recall Flashcards", description: "Master vocabulary, constitution articles, and formulas faster.", icon: "🎴" },
    { title: "In-Depth Rationalizations", description: "Understand exactly why an answer is correct with detailed explanations.", icon: "🧠" },
    { title: "Performance Analytics", description: "Track your progress and pinpoint your weakest subjects instantly.", icon: "📊" },
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
      a: "Absolutely. CSE Mastery is fully optimized for mobile browsers, laptops, and tablets so you can review anywhere, anytime.",
    },
    {
      q: "How often is the question bank updated?",
      a: "Our mock exams and rationalizations are continuously reviewed and aligned with the latest Civil Service Commission syllabus guidelines.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 bg-slate-50/95 backdrop-blur-3xl min-h-screen flex flex-col">
        
        {/* Navigation Bar */}
        <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 px-6 md:px-12 py-4 flex justify-between items-center shadow-sm">
          <div className="text-2xl font-extrabold text-blue-600 tracking-tight">
            CSE<span className="text-slate-800">Mastery</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/login" className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 transition">
              Log In
            </Link>
            <Link href="/register" className="px-5 py-2.5 font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-sm">
              Start Free
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col">
          <section className="relative px-4 py-20 md:py-28 max-w-4xl mx-auto text-center space-y-6">
            
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-bold tracking-wide uppercase">
              Philippines' #1 CSE Reviewer
            </span>

            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-tight tracking-tight">
              Pass the Civil Service Exam on your <span className="text-blue-600">first try.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 mt-6 max-w-2xl mx-auto leading-relaxed">
              Stop guessing and start passing. Join thousands of Filipinos who passed the exam using our smart mock exams, flashcards, and detailed rationalizations.
            </p>

            <div className="flex justify-center mt-8 w-full sm:w-auto">
              <Link href="/register" className="px-8 py-4 font-bold text-lg text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/30 text-center w-full sm:w-auto">
                Start Reviewing Now
              </Link>
            </div>

          </section>

          {/* Interactive Mini Sample Question Widget */}
          <section className="px-6 py-6 max-w-3xl mx-auto w-full">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <span className="text-xs font-black uppercase text-blue-600 tracking-wider">
                    Instant Sample Question Test
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                  Try it out!
                </span>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {sampleQuestion.category}
                </p>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                  {sampleQuestion.prompt}
                </h2>

                <div className="space-y-2.5 pt-2">
                  {sampleQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === sampleQuestion.correctIndex;

                    let btnStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100";
                    if (showExplanation) {
                      if (isCorrect) btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
                      else if (isSelected) btnStyle = "bg-rose-50 border-rose-300 text-rose-800 font-medium";
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
                        {showExplanation && isCorrect && <span className="text-emerald-600 font-extrabold text-xs">✓ Correct</span>}
                      </button>
                    );
                  })}
                </div>

                {showExplanation && (
                  <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl space-y-1 text-xs text-blue-950 animate-in fade-in duration-200">
                    <p className="font-extrabold uppercase text-[10px] text-blue-700">Official Rationalization:</p>
                    <p className="leading-relaxed font-medium">{sampleQuestion.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Key Metrics Bar */}
          <section className="bg-slate-900 text-white py-10 px-6 border-y border-slate-800 mt-6">
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-amber-400">10,000+</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Practice Questions</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-blue-400">88%</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Pass Rate</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">100%</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Updated CSC Syllabus</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-purple-400">24 / 7</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile & Desktop Access</p>
              </div>
            </div>
          </section>

          {/* Scope Section */}
          <section className="py-20 px-6 bg-white border-b border-slate-200/80">
            <div className="max-w-6xl mx-auto space-y-12">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  Comprehensive Review Scope
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                  Master Every Subject Tested on Exam Day
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  Covering both Professional and Sub-Professional Civil Service exam levels.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categories.map((cat, idx) => (
                  <div
                    key={idx}
                    className={`p-6 rounded-3xl border bg-gradient-to-br ${cat.color} transition hover:shadow-lg space-y-4`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{cat.icon}</span>
                        <h3 className="text-lg font-black text-slate-900">{cat.title}</h3>
                      </div>
                      <span className={`px-2.5 py-1 ${cat.badgeBg} text-white font-bold text-[10px] rounded-full uppercase`}>
                        CSC Standard
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {cat.items}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Original Features Grid */}
          <section className="bg-slate-50 py-20 px-4 border-b border-slate-200">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">Everything you need to succeed</h2>
                <p className="text-slate-500 mt-4 text-lg">Designed specifically for the Philippine Civil Service Professional and Sub-Professional levels.</p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {features.map((feature, i) => (
                  <div key={i} className="p-6 bg-white rounded-3xl border border-slate-100 hover:shadow-md transition">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-2xl mb-6">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Frequently Asked Questions (FAQ) Section */}
          <section className="py-20 px-6 bg-white">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600">Got Questions?</span>
                <h2 className="text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div
                      key={i}
                      className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        className="w-full p-5 text-left font-bold text-sm text-slate-900 flex justify-between items-center gap-4 hover:bg-slate-100/50"
                      >
                        <span>{faq.q}</span>
                        <span className="text-slate-400 font-black text-base">{isOpen ? "−" : "+"}</span>
                      </button>

                      {isOpen && (
                        <div className="p-5 pt-0 text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-200/60">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Bottom Callout Banner */}
          <section className="py-16 px-6 max-w-5xl mx-auto w-full">
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl" />
              
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                Ready to Secure Your Government Career?
              </h2>
              <p className="text-slate-300 text-sm max-w-xl mx-auto font-medium leading-relaxed">
                Start practicing with real CSE-aligned questions today. No installation required.
              </p>

              <div className="pt-2">
                <Link
                  href="/register"
                  className="inline-block px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base rounded-2xl shadow-xl transition hover:scale-105"
                >
                  Create Your Free Account Now 🇵🇭
                </Link>
              </div>
            </div>
          </section>

        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-12 px-6 text-center">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="text-xl font-extrabold text-white tracking-tight mb-4 md:mb-0">
              CSE<span className="text-blue-500">Mastery</span>
            </div>
            <p className="text-sm">© 2026 CSE Mastery Philippines. All rights reserved.</p>
          </div>
        </footer>

      </div>
    </div>
  );
}