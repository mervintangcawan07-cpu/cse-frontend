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
        Loading Today's Question of the Day...
      </div>
    );
  }

  if (!question) return null;

  const resolvedAnswerIndex = question.answerIndex;
  const isCorrect = userAttempt?.isCorrect;

  return (
    <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header & Badges */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-sm flex items-center gap-1.5">
            <span>⚡</span>
            <span>Question of the Day</span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 font-mono">
            {question.category}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {question.subtopic}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasAnswered ? (
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 flex items-center gap-1">
              <span>✓</span> Completed Today
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20 flex items-center gap-1">
              <span>🔥</span> +1 Daily Streak Reward
            </span>
          )}
        </div>
      </div>

      {/* Question Prompt */}
      <div className="space-y-4">
        <FormattedPrompt text={question.prompt} className="text-base md:text-lg font-bold text-white leading-relaxed" />
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {question.options.map((opt, idx) => {
          const letter = ["A", "B", "C", "D", "E"][idx] || `${idx + 1}`;
          let style = "bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900";

          if (hasAnswered && resolvedAnswerIndex !== null && resolvedAnswerIndex !== undefined) {
            if (idx === resolvedAnswerIndex) {
              style = "bg-emerald-600/20 border-emerald-500/50 text-emerald-300 font-bold shadow-md shadow-emerald-500/10";
            } else if (idx === userAttempt?.userAnswer && !isCorrect) {
              style = "bg-rose-600/20 border-rose-500/50 text-rose-300 font-bold";
            } else {
              style = "bg-slate-950/40 border-slate-900 text-slate-500 opacity-60";
            }
          } else if (selectedOption === idx) {
            style = "bg-blue-600/20 border-blue-500 text-blue-300 font-bold shadow-md shadow-blue-500/10";
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
              className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition cursor-pointer flex flex-col justify-between gap-2 ${style}`}
            >
              <div className="flex items-start gap-3 w-full">
                <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  {letter}
                </span>
                <span className="flex-1 leading-relaxed">{opt}</span>
              </div>

              {hasAnswered && (
                <div className="w-full pt-1.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/50 mt-1">
                  <span>Community picked:</span>
                  <span className="font-bold text-slate-300">{choicePct}%</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Feedback & Community Stats */}
      {hasAnswered && (
        <div className={`p-5 rounded-2xl border space-y-3 animate-fade-in ${
          isCorrect
            ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
            : "bg-rose-950/30 border-rose-500/40 text-rose-300"
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
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-1">
              <p className="font-bold text-slate-200">Official Solution:</p>
              <p>{question.explanation}</p>
            </div>
          )}

          {!isCorrect && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-rose-500/20">
              <span className="text-rose-300 font-medium">
                📕 This question was automatically saved to your Mistake Notebook.
              </span>
              <Link href="/mistakes" className="text-rose-400 hover:text-white font-bold underline">
                View Mistake Notebook →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Widget Footer Action */}
      {!hasAnswered && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            Select your answer and submit to earn streak points.
          </span>
          <button
            onClick={handleSubmit}
            disabled={selectedOption === null || submitting}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            {submitting ? "Evaluating..." : "Submit Daily Answer ⚡"}
          </button>
        </div>
      )}
    </div>
  );
}
