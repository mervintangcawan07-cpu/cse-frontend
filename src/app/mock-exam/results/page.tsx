"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ExamResultsPage() {
  const router = useRouter();
  const [reviewData, setReviewData] = useState<any>(null);

  useEffect(() => {
    // Read the review data saved from the exam page
    const storedReview = localStorage.getItem("cse_latest_review");
    
    if (!storedReview) {
      // If there's no recent exam data, send them back to dashboard
      router.push("/dashboard");
      return;
    }
    
    setReviewData(JSON.parse(storedReview));
  }, [router]);

  if (!reviewData) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <p className="text-slate-500 animate-pulse font-medium">Loading your results...</p>
      </div>
    );
  }

  const { questions, selectedAnswers, score, correct, incorrect, skipped } = reviewData;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Summary Header */}
      <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto font-extrabold">
          🎉
        </div>
        
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Exam Completed!</h1>
          <p className="text-slate-500 mt-2 text-sm">Your results have been securely saved to your account.</p>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 grid grid-cols-3 gap-4 text-center max-w-2xl mx-auto">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Score</p>
            <p className="text-3xl font-black text-blue-600 mt-1">{score}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Correct</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{correct}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Mistakes</p>
            <p className="text-3xl font-black text-rose-600 mt-1">{incorrect + skipped}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link href="/dashboard" className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
            Back to Dashboard
          </Link>
          <Link href="/mock-exam/take" className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm">
            Take Another Exam
          </Link>
        </div>
      </div>

      {/* Detailed Review Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 px-2">Detailed Review</h2>
        
        <div className="space-y-6">
          {questions.map((q: any, idx: number) => {
            const userAnswer = selectedAnswers[idx];
            const isCorrect = userAnswer === q.answerIndex;
            const isSkipped = userAnswer === undefined;

            return (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm">
                    {idx + 1}
                  </span>
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase text-blue-600">{q.category}</span>
                    <h3 className="text-slate-800 font-bold text-lg leading-relaxed">{q.prompt}</h3>
                  </div>
                </div>

                <div className="ml-11 space-y-3">
                  {/* User's Answer */}
                  <div className={`p-4 rounded-xl border ${
                    isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : isSkipped ? "bg-slate-50 border-slate-200 text-slate-600"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}>
                    <p className="text-xs font-bold uppercase opacity-70 mb-1">
                      {isCorrect ? "Your Answer (Correct)" : isSkipped ? "You Skipped" : "Your Answer (Incorrect)"}
                    </p>
                    <p className="font-semibold">
                      {isSkipped ? "No answer selected" : q.options[userAnswer]}
                    </p>
                  </div>

                  {/* Show Correct Answer if they got it wrong */}
                  {!isCorrect && (
                    <div className="p-4 rounded-xl border bg-blue-50 border-blue-200 text-blue-900">
                      <p className="text-xs font-bold uppercase opacity-70 mb-1">Correct Answer</p>
                      <p className="font-semibold">{q.options[q.answerIndex]}</p>
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="mt-4 p-5 rounded-xl bg-slate-50 text-slate-700 text-sm leading-relaxed border border-slate-100">
                      <span className="font-bold text-slate-900">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}