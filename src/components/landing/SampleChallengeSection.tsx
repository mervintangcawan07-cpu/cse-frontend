"use client";

import { useState } from "react";
import Link from "next/link";
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

export default function SampleChallengeSection() {
  // 3-Question PRO Challenge State
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([null, null, null]);
  const [submittedChallenges, setSubmittedChallenges] = useState<boolean[]>([false, false, false]);

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

  return (
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
  );
}
