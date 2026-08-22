// Relative Path: src/components/cse/CSCDailyQuestionWidget.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import FormattedPrompt from "@/components/FormattedPrompt";
import ExplainMistakeButton from "@/components/ExplainMistakeButton";

interface DailyQuestionData {
  id: string;
  category: string;
  subtopic: string;
  prompt: string;
  options: string[];
  imageUrl?: string | null;
  answerIndex?: number | null;
  explanation?: string | null;
}

interface CommunityStats {
  totalAttempts: number;
  communityAccuracy: number;
  distribution: number[];
}

export default function CSCDailyQuestionWidget() {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<DailyQuestionData | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [userAttempt, setUserAttempt] = useState<{ userAnswer: number; isCorrect: boolean } | null>(null);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [streakEarned, setStreakEarned] = useState<number | null>(null);

  const fetchDailyQuestion = async () => {
    try {
      const res = await fetch("/api/questions/daily");
      if (res.ok) {
        const data = await res.json();
        setQuestion(data.question);
        setHasAnswered(data.hasAnswered);
        setUserAttempt(data.userAttempt);
        setCommunityStats(data.communityStats);
        if (data.userAttempt) {
          setSelectedOption(data.userAttempt.userAnswer);
        }
      }
    } catch (err) {
      console.error("Failed to load daily question:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyQuestion();
  }, []);

  const handleSubmit = async () => {
    if (selectedOption === null || submitting || !question) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/questions/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          selectedIndex: selectedOption,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHasAnswered(true);
        setUserAttempt({
          userAnswer: selectedOption,
          isCorrect: data.isCorrect,
        });
        setQuestion((prev) =>
          prev
            ? {
                ...prev,
                answerIndex: data.correctAnswerIndex,
                explanation: data.explanation,
              }
            : null
        );
        setCommunityStats(data.communityStats);
        setStreakEarned(data.streak);
      }
    } catch (err) {
      console.error("Failed to submit daily question:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 font-bold animate-pulse">
        Loading Today&apos;s Question of the Day...
      </div>
    );
  }

  if (!question) return null;

  const resolvedAnswerIndex = question.answerIndex;
  const isCorrect = userAttempt?.isCorrect;

  return (
    <div className="bg-white border border-blue-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 shadow-md relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header & Badges */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-sm flex items-center gap-1.5">
            <span>⚡</span>
            <span>Question of the Day</span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-mono">
            {question.category}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {question.subtopic}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {hasAnswered ? (
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1">
              <span>✓</span> Completed Today
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 flex items-center gap-1">
              <span>🔥</span> +1 Daily Streak Reward
            </span>
          )}
        </div>
      </div>

      {/* Question Prompt */}
      <div className="space-y-3">
        <FormattedPrompt text={question.prompt} className="text-sm sm:text-base md:text-lg font-extrabold text-slate-900 leading-relaxed" />
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1">
        {question.options.map((opt, idx) => {
          const letter = ["A", "B", "C", "D", "E"][idx] || `${idx + 1}`;
          let style = "bg-slate-50 border-slate-200/90 text-slate-800 hover:border-blue-300 hover:bg-blue-50/40";

          if (hasAnswered && resolvedAnswerIndex !== null && resolvedAnswerIndex !== undefined) {
            if (idx === resolvedAnswerIndex) {
              style = "bg-emerald-50 border-emerald-500 text-emerald-800 font-bold shadow-sm";
            } else if (idx === userAttempt?.userAnswer && !isCorrect) {
              style = "bg-rose-50 border-rose-500 text-rose-800 font-bold";
            } else {
              style = "bg-slate-50/50 border-slate-100 text-slate-400 opacity-60";
            }
          } else if (selectedOption === idx) {
            style = "bg-blue-50 border-blue-500 text-blue-800 font-bold shadow-sm";
          }

          // Percentage choice in community
          const totalAttempts = communityStats?.totalAttempts || 0;
          const choiceCount = communityStats?.distribution[idx] || 0;
          const choicePct = totalAttempts > 0 ? Math.round((choiceCount / totalAttempts) * 100) : 0;

          return (
            <button
              key={idx}
              type="button"
              disabled={hasAnswered || submitting}
              onClick={() => setSelectedOption(idx)}
              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left text-xs sm:text-sm font-medium transition cursor-pointer flex flex-col justify-between gap-2 ${style}`}
            >
              <div className="flex items-start gap-2.5 sm:gap-3 w-full">
                <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 text-slate-700 shadow-xs">
                  {letter}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
              </div>

              {hasAnswered && (
                <div className="w-full pt-1.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60 mt-1">
                  <span>Community picked:</span>
                  <span className="font-bold text-slate-700">{choicePct}%</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Feedback & Community Stats */}
      {hasAnswered && (
        <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 animate-fade-in ${
          isCorrect
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{isCorrect ? "🎉" : "❌"}</span>
              <div>
                <span className="font-black text-sm block">
                  {isCorrect ? "Great Job! Correct Answer!" : "Incorrect — Keep Practicing!"}
                </span>
                <span className="text-xs opacity-80">
                  {communityStats?.communityAccuracy ?? 100}% of examinees answered correctly today.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExplainMistakeButton
                prompt={question.prompt}
                userChoice={
                  typeof userAttempt?.userAnswer === "number"
                    ? question.options[userAttempt.userAnswer] || "No answer"
                    : "No answer"
                }
                correctChoice={
                  typeof resolvedAnswerIndex === "number"
                    ? question.options[resolvedAnswerIndex] || "Correct option"
                    : "Correct option"
                }
                officialExplanation={question.explanation || undefined}
                category={question.category}
              />
            </div>
          </div>

          {question.explanation && (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1 shadow-xs">
              <p className="font-bold text-slate-900">Official Solution:</p>
              <p>{question.explanation}</p>
            </div>
          )}

          {!isCorrect && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 border-t border-rose-200 gap-1.5">
              <span className="text-rose-700 font-medium">
                📕 This question was automatically saved to your Mistake Notebook.
              </span>
              <Link href="/mistakes" className="text-rose-600 hover:text-rose-700 font-bold underline">
                View Mistake Notebook →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Widget Footer Action */}
      {!hasAnswered && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <span className="text-xs text-slate-500 font-medium">
            Select your answer and submit to earn streak points.
          </span>
          <button
            onClick={handleSubmit}
            disabled={selectedOption === null || submitting}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/20 disabled:opacity-50 text-center"
          >
            {submitting ? "Evaluating..." : "Submit Daily Answer ⚡"}
          </button>
        </div>
      )}
    </div>
  );
}
