"use client";

import { useState } from "react";

const FAQS = [
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

export default function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
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
        {FAQS.map((faq, i) => {
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
  );
}
