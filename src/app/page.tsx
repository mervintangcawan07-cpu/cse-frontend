"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuestionReview from "@/components/question/QuestionReview";
import { StructuredQuestion } from "@/types/question";

interface SampleChallengeQuestion extends StructuredQuestion {
  id: string;
  badgeLabel: string;
}

const SAMPLE_QUESTIONS: SampleChallengeQuestion[] = [
  {
    id: "sample-1",
    badgeLabel: "Challenge 1 of 3",
    category: "Numerical Reasoning",
    subtopic: "Multi-Step Work & Rate",
    difficulty: "HARD",
    prompt:
      "A government printing office uses three automated machines—Alpha, Beta, and Gamma. Working together at their constant standard rates, they can print a batch of 18,000 examination booklets in 6 hours. Machine Alpha works twice as fast as Machine Gamma, while Machine Beta works 1.5 times as fast as Machine Gamma. If Machine Beta breaks down after all three machines have worked together for exactly 2 hours, how many additional hours will it take Machines Alpha and Gamma working together to finish the remaining booklets?",
    options: [
      "4 hours",
      "6 hours",
      "8 hours",
      "9 hours",
    ],
    answerIndex: 1,
    explanation:
      "After 2 hours, 6,000 booklets are finished, leaving 12,000 booklets. Without Machine Beta (1,000 booklets/hr), Machines Alpha and Gamma produce exactly 2,000 booklets/hr together. 12,000 ÷ 2,000 = 6 hours.",
    stepByStep: [
      {
        step: "Step 1: Calculate the combined printing rate of all three machines.",
        detail:
          "Total rate = 18,000 booklets ÷ 6 hours = 3,000 booklets per hour.",
      },
      {
        step: "Step 2: Express individual rates in terms of Machine Gamma (g).",
        detail:
          "Let Gamma's rate = g. Alpha's rate = 2g. Beta's rate = 1.5g. Combined: 2g + 1.5g + g = 4.5g = 3,000 booklets/hr.",
      },
      {
        step: "Step 3: Solve for individual rates.",
        detail:
          "g (Gamma) = 3,000 ÷ 4.5 = 666.67 (or 2,000/3) booklets/hr. Alpha (2g) = 4,000/3 booklets/hr. Beta (1.5g) = 1,000 booklets/hr.",
      },
      {
        step: "Step 4: Calculate work completed before Machine Beta broke down.",
        detail:
          "In the first 2 hours, all 3 machines produced: 2 hours × 3,000 booklets/hr = 6,000 booklets.",
      },
      {
        step: "Step 5: Determine remaining work and remaining rate (Alpha + Gamma).",
        detail:
          "Remaining booklets = 18,000 - 6,000 = 12,000 booklets. Combined rate of Alpha and Gamma = (4,000/3) + (2,000/3) = 6,000/3 = 2,000 booklets/hr.",
      },
      {
        step: "Step 6: Compute additional hours required.",
        detail:
          "Time = Remaining Work ÷ Combined Rate = 12,000 booklets ÷ 2,000 booklets/hr = 6 hours.",
      },
    ],
    whyA: "Incorrect. This assumes all 3 machines continued operating for the remaining 12,000 booklets (12,000 ÷ 3,000 = 4 hours), failing to account for Beta's breakdown.",
    whyB: "Correct! Precisely accounts for the 2 hours of joint production and the adjusted combined speed of Alpha + Gamma.",
    whyC: "Incorrect. Results from calculating total elapsed time from start to finish (2 initial hrs + 6 additional hrs = 8 hrs total), but the question specifically asks for 'additional hours'.",
    whyD: "Incorrect. This computes how long Alpha and Gamma would take to print the entire 18,000 batch alone from scratch (18,000 ÷ 2,000 = 9 hrs), ignoring the 6,000 booklets already printed.",
    eliminationStrategy:
      "Notice that Beta contributes 1,000 booklets/hr out of 3,000 (exactly one-third). The remaining two machines work at 2/3 speed (2,000 booklets/hr). For 12,000 booklets remaining, 12,000 ÷ 2,000 must equal an integer (6). Eliminate 4 immediately as it assumes no breakdown.",
    commonTrap:
      "A frequent trap in CSE word problems is confusing 'additional hours to finish' with 'total hours elapsed from the beginning' (which would be 8). Always check what the final sentence asks.",
    examTip:
      "When rates are given as relative multiples (e.g., 'twice as fast', '1.5 times as fast'), set the slowest unit as variable x to avoid fractions until the final step.",
  },
  {
    id: "sample-2",
    badgeLabel: "Challenge 2 of 3",
    category: "Verbal Ability",
    subtopic: "Structural & Semantic Analogy",
    difficulty: "HARD",
    prompt:
      "Analyze the relationship between the primary pair and choose the pair that exhibits the EXACT same structural and grammatical relationship:\n\nOBDURATE : PERSUASION :: ________ : ________",
    options: [
      "impervious : penetration",
      "gullible : deception",
      "penitent : forgiveness",
      "meticulous : perfection",
    ],
    answerIndex: 0,
    explanation:
      "Both 'obdurate' and 'impervious' describe states of absolute resistance against an external action or influence ('persuasion' and 'penetration' respectively).",
    stepByStep: [
      {
        step: "Step 1: Define the primary pair precisely.",
        detail:
          "'Obdurate' is an adjective meaning stubbornly resistant or unyielding. 'Persuasion' is a noun referring to the act of swaying or convincing.",
      },
      {
        step: "Step 2: Formulate the defining relationship bridge sentence.",
        detail:
          "'Someone or something that is OBDURATE is completely immune or stubbornly resistant to PERSUASION.'",
      },
      {
        step: "Step 3: Test Option A (impervious : penetration).",
        detail:
          "'Something that is IMPERVIOUS is completely immune or stubbornly resistant to PENETRATION.' This matches the grammatical form (Adjective : Noun) and exact semantic polarity (immunity/resistance).",
      },
      {
        step: "Step 4: Test Option B (gullible : deception).",
        detail:
          "'Someone who is GULLIBLE is easily susceptible or vulnerable to DECEPTION.' This is the opposite relationship (vulnerability vs. immunity).",
      },
      {
        step: "Step 5: Test Option C & D.",
        detail:
          "'Penitent' seeks or desires forgiveness (not immune to it). 'Meticulous' strives for perfection (aim/goal relationship).",
      },
    ],
    whyA: "Correct! Exact parallel: [Adjective] describes something that cannot be affected or breached by [Noun].",
    whyB: "Incorrect. Classic inverted trap! A gullible person is vulnerable to deception, whereas an obdurate person resists persuasion.",
    whyC: "Incorrect. Represents an attitude and its sought result (penitent seeks forgiveness), not resistance or immunity.",
    whyD: "Incorrect. Represents an approach and its standard of execution (meticulous aims for perfection).",
    eliminationStrategy:
      "First eliminate C and D because they describe pursuit or desire rather than resistance. Between A and B, identify the polarity: obdurate means 'cannot be persuaded' (negative resistance), while gullible means 'easily deceived' (positive vulnerability). Thus, choose A.",
    commonTrap:
      "Option B uses words with strong thematic associations to human behavior, tempting examinees into picking it based on conversational similarity rather than structural logic.",
    examTip:
      "Always construct an explicit 'Bridge Sentence' containing both words (e.g. 'X is immune to Y') and substitute each option into the exact same sentence structure.",
  },
  {
    id: "sample-3",
    badgeLabel: "Challenge 3 of 3",
    category: "Analytical Reasoning",
    subtopic: "Multi-Condition Deductive Scheduling",
    difficulty: "HARD",
    prompt:
      "Six government interns—Arvin, Bea, Carlo, Danica, Elena, and Franco—are scheduled to undergo individual performance evaluation interviews from Monday through Saturday (one intern per day).\n\nThe schedule must satisfy the following constraints:\n1. Arvin must be interviewed on an earlier day than Bea.\n2. Elena must be interviewed on either Thursday or Friday.\n3. Danica must be interviewed immediately before or immediately after Carlo.\n4. Franco must be interviewed on Monday or Saturday.\n5. Bea is interviewed on Wednesday.\n\nWhich of the following MUST BE TRUE about the interview schedule?",
    options: [
      "Arvin is interviewed on Tuesday.",
      "Danica is interviewed on Friday.",
      "Elena is interviewed on Friday.",
      "Franco is interviewed on Saturday.",
    ],
    answerIndex: 0,
    explanation:
      "Because the consecutive pair [Danica, Carlo] is forced into Friday–Saturday, Franco is forced to Monday, which leaves Tuesday as the only possible day for Arvin.",
    stepByStep: [
      {
        step: "Step 1: Anchor the fixed positions.",
        detail:
          "Days are Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6). Bea is fixed on Wednesday (Day 3).",
      },
      {
        step: "Step 2: Apply Constraint 1 (Arvin before Bea).",
        detail:
          "Since Bea is on Wed (3), Arvin must be on Monday (1) or Tuesday (2). Only two slots exist before Bea.",
      },
      {
        step: "Step 3: Analyze the consecutive block for Danica & Carlo [D, C].",
        detail:
          "Danica and Carlo must occupy two adjacent days. They cannot occupy Days 1 & 2 because that would leave no slot for Arvin before Bea. They cannot occupy Days 4 & 5 because Elena must have Thu (4) or Fri (5). Therefore, the only available consecutive pair is Days 5 and 6 (Friday and Saturday).",
      },
      {
        step: "Step 4: Determine positions for Elena and Franco.",
        detail:
          "Since Days 5 & 6 are taken by Danica/Carlo, Elena must take Thursday (Day 4). Since Saturday (Day 6) is occupied by Danica/Carlo, Franco (who must be Mon or Sat) MUST take Monday (Day 1).",
      },
      {
        step: "Step 5: Deduce Arvin's position.",
        detail:
          "Since Monday (1) is occupied by Franco, and Arvin must be before Bea (3), Arvin MUST be on Tuesday (Day 2).",
      },
      {
        step: "Step 6: Verify the complete valid schedule.",
        detail:
          "Mon(1): Franco | Tue(2): Arvin | Wed(3): Bea | Thu(4): Elena | Fri(5): Danica or Carlo | Sat(6): Carlo or Danica. Every condition is satisfied.",
      },
    ],
    whyA: "Correct! In every valid arrangement satisfying all 5 conditions, Arvin must occupy Tuesday.",
    whyB: "Incorrect. While possible, it is not 'MUST BE TRUE' because Carlo could be interviewed on Friday and Danica on Saturday.",
    whyC: "Incorrect. Must be false! Friday is occupied by one of the [Danica/Carlo] pair, forcing Elena to Thursday.",
    whyD: "Incorrect. Must be false! Saturday is occupied by Danica or Carlo, forcing Franco to Monday.",
    eliminationStrategy:
      "Identify the 'block constraint' first. Two adjacent items [D,C] require two consecutive empty slots. With Wed fixed, slots [1,2], [4,5], and [5,6] are the only theoretical candidates. Eliminating impossible blocks quickly solves the entire puzzle.",
    commonTrap:
      "Confusing 'COULD BE TRUE' with 'MUST BE TRUE'. Danica on Friday (Option B) is a possible scenario, but Carlo on Friday is equally valid, making B only conditionally true, not universally true.",
    examTip:
      "In Civil Service analytical reasoning, always sketch a 6-slot grid (Mon–Sat). Fill in anchor positions with bold ink and test block constraints first.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  // Mobile menu drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 3-Question PRO Challenge State
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([null, null, null]);
  const [submittedChallenges, setSubmittedChallenges] = useState<boolean[]>([false, false, false]);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Auto-redirect active logged-in users to Dashboard
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
      } catch {
        // Stay on landing page
      }
    }
    checkActiveSession();
  }, [router]);

  const activeQuestion = SAMPLE_QUESTIONS[currentChallengeIndex];
  const currentSelected = selectedAnswers[currentChallengeIndex];
  const isCurrentSubmitted = submittedChallenges[currentChallengeIndex];

  const handleSelectOption = (index: number) => {
    if (isCurrentSubmitted) return;
    const updated = [...selectedAnswers];
    updated[currentChallengeIndex] = index;
    setSelectedAnswers(updated);
  };

  const handleSubmitAnswer = () => {
    if (currentSelected === null) return;
    const updated = [...submittedChallenges];
    updated[currentChallengeIndex] = true;
    setSubmittedChallenges(updated);
  };

  const handleNextChallenge = () => {
    if (currentChallengeIndex < SAMPLE_QUESTIONS.length - 1) {
      setCurrentChallengeIndex((prev) => prev + 1);
    }
  };

  const handleResetChallenges = () => {
    setSelectedAnswers([null, null, null]);
    setSubmittedChallenges([false, false, false]);
    setCurrentChallengeIndex(0);
  };

  const allCompleted = submittedChallenges.every(Boolean);

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

  const pricingPlans = [
    {
      name: "1-Month Intensive Pass",
      price: "₱99",
      duration: "30 Days Access",
      description: "Ideal for fast, focused preparation in the final weeks before your exam date.",
      popular: false,
    },
    {
      name: "6-Month Full Pass",
      price: "₱199",
      duration: "180 Days Access",
      description: "Our most popular pass. Complete coverage with ample time to master all subjects.",
      popular: true,
    },
    {
      name: "1-Year Mastery Pass",
      price: "₱299",
      duration: "365 Days Access",
      description: "Best value for continuous review across multiple CSC PPT and COMEX schedules.",
      popular: false,
    },
  ];

  const faqs = [
    {
      q: "Does this reviewer cover both Professional and Sub-Professional levels?",
      a: "Yes. All core subject areas—Numerical Ability, Verbal Ability, Analytical Ability, and General Information—are fully aligned with Civil Service Commission guidelines for both exam levels.",
    },
    {
      q: "How does the PRO rationalization differ from standard answer keys?",
      a: "Standard answer keys only tell you the letter. CSC Review PRO breaks down each question into step-by-step logic, explains why the correct answer is right, explains why every distractor is wrong, and provides elimination strategies.",
    },
    {
      q: "Can I connect and review with other examinees?",
      a: "Yes! The Study Together Hub lets you add classmates, send 1-on-1 direct study messages, and join virtual study rooms equipped with a live synchronized whiteboard and audio stage.",
    },
    {
      q: "Can I study on my smartphone, tablet, and PC?",
      a: "Yes. The entire platform is cloud-based and responsive across mobile phones, tablets, laptops, and desktop computers. No app store installation required.",
    },
    {
      q: "What payment methods are supported for PRO access?",
      a: "We support instant online payments via GCash, Maya, Debit/Credit Cards (Visa/Mastercard), and QRPH through secure PayMongo processing with zero recurring auto-charges.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <nav className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex justify-between items-center shadow-xs">
        <Link href="/" className="flex items-center gap-2 font-black text-lg text-slate-900 tracking-tight">
          <span className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-black shadow-xs">
            GS
          </span>
          <span className="font-extrabold text-slate-900">
            GovStudy<span className="text-blue-600">X</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-7 text-xs font-bold text-slate-600">
          <a href="#challenge" className="hover:text-blue-600 transition">Sample Challenge</a>
          <a href="#scope" className="hover:text-blue-600 transition">Review Scope</a>
          <a href="#features" className="hover:text-blue-600 transition">Features</a>
          <a href="#classmates" className="hover:text-blue-600 transition">Study Classmates</a>
          <a href="#pricing" className="hover:text-blue-600 transition">Pricing Plans</a>
          <a href="#faqs" className="hover:text-blue-600 transition">FAQs</a>
        </div>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 font-bold text-xs text-slate-700 hover:text-blue-600 transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 font-extrabold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:opacity-95 transition shadow-sm"
          >
            Start Reviewing
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-5 space-y-4 shadow-xl animate-fade-in sticky top-14 z-40">
          <div className="flex flex-col space-y-3 text-sm font-bold text-slate-700">
            <a href="#challenge" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Sample Challenge</a>
            <a href="#scope" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Review Scope</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Features</a>
            <a href="#classmates" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Study Classmates</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">Pricing Plans</a>
            <a href="#faqs" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-blue-600">FAQs</a>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-bold text-xs text-slate-700 bg-slate-100 rounded-xl"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-bold text-xs text-white bg-blue-600 rounded-xl shadow-xs"
            >
              Start Reviewing Free
            </Link>
          </div>
        </div>
      )}

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
        <section id="challenge" className="px-3 sm:px-6 py-12 max-w-4xl mx-auto w-full space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              Interactive Preview
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Think You Can Solve These?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Try three challenging CSE-style questions and experience the kind of reasoning and detailed explanations available in the reviewer.
            </p>
          </div>

          {/* Challenge Navigation Tabs */}
          <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl max-w-md mx-auto">
            {SAMPLE_QUESTIONS.map((q, idx) => {
              const isSelected = currentChallengeIndex === idx;
              const isDone = submittedChallenges[idx];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentChallengeIndex(idx)}
                  className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Q{idx + 1}</span>
                  {isDone && <span className="text-emerald-600 text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>

          {/* Interactive Question Card Powered by QuestionReview */}
          <QuestionReview
            question={activeQuestion}
            userAnswerIndex={currentSelected}
            itemNumber={currentChallengeIndex + 1}
            mode="INTERACTIVE"
            isSubmitted={isCurrentSubmitted}
            badgeLabel={activeQuestion.badgeLabel}
            onSelectOption={handleSelectOption}
            onSubmitAnswer={handleSubmitAnswer}
            footerActions={
              isCurrentSubmitted ? (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleResetChallenges}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white underline font-semibold cursor-pointer"
                  >
                    Reset All Challenges
                  </button>

                  {currentChallengeIndex < SAMPLE_QUESTIONS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNextChallenge}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Next Challenge Question →</span>
                    </button>
                  ) : (
                    <a
                      href="#pricing"
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition text-center"
                    >
                      Explore CSC Review PRO
                    </a>
                  )}
                </div>
              ) : null
            }
          />

          {/* ALL COMPLETED BANNER */}
          {allCompleted && (
            <div className="p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl shadow-xl p-6 sm:p-8 text-center space-y-4 animate-fade-in">
              <span className="text-3xl">🎓</span>
              <h3 className="text-xl sm:text-2xl font-black">
                Ready for More?
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
                These three questions are only a preview. Continue your preparation with full timed mock exams, comprehensive rationalizations, flashcards, and elimination drills in CSC Review PRO.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
                <a
                  href="#pricing"
                  className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition text-center"
                >
                  Explore PRO Plans
                </a>
                <Link
                  href="/signup"
                  className="w-full sm:w-auto px-8 py-3.5 bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/30 transition text-center"
                >
                  Start Reviewing Free
                </Link>
              </div>
            </div>
          )}
        </section>

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
                  <p className="text-slate-700">"How did you eliminate Choice C in the proportion problem?"</p>
                </div>
                <div className="p-2.5 bg-blue-600 text-white rounded-xl space-y-0.5 text-right">
                  <p className="font-bold text-blue-100 text-[11px]">You:</p>
                  <p className="text-white">"Check the common trap: C forgets the initial 2 hours work!"</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING PLANS */}
        <section id="pricing" className="py-16 px-4 sm:px-6 bg-white border-y border-slate-200/80">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-black text-blue-600 uppercase tracking-wider">
                Transparent Pricing
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
                Choose Your PRO Review Pass
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                One-time payment via GCash, Maya, Card, or QRPH. No hidden fees or recurring subscriptions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingPlans.map((plan, idx) => (
                <div
                  key={idx}
                  className={`p-6 sm:p-7 rounded-3xl border flex flex-col justify-between space-y-6 relative transition ${
                    plan.popular
                      ? "bg-gradient-to-b from-blue-50/50 to-indigo-50/50 border-2 border-blue-600 shadow-xl"
                      : "bg-white border-slate-200/90 shadow-sm hover:shadow-md"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[10px] rounded-full uppercase shadow-xs">
                      Most Popular
                    </span>
                  )}

                  <div className="space-y-3">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      {plan.name}
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-slate-900">
                      {plan.price}{" "}
                      <span className="text-xs font-semibold text-slate-500">
                        / {plan.duration}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {plan.description}
                    </p>

                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>Full Timed Mock Exam Suite</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>Complete Step-by-Step Rationalizations</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>Mistake Notebook & Elimination Drills</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>Classmates & Study Rooms Access</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/signup"
                    className={`w-full py-3.5 text-center text-xs font-black rounded-xl transition ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-md"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    Get Started Now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section id="faqs" className="py-16 px-4 sm:px-6 max-w-3xl mx-auto w-full space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-blue-600">
              Got Questions?
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-900 flex justify-between items-center gap-4 hover:text-blue-600 transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="text-slate-400 font-black text-base shrink-0">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 font-medium">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

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