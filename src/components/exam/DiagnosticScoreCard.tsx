"use client";

import React, { useRef, useState } from "react";
import {
  Award,
  Download,
  Share2,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Copy,
  Check,
} from "lucide-react";
import { StructuredQuestion } from "@/types/question";

interface CategoryStat {
  name: string;
  total: number;
  correct: number;
  percentage: number;
}

interface DiagnosticScoreCardProps {
  score: number;
  totalItems: number;
  correct: number;
  incorrect: number;
  skipped: number;
  questions: StructuredQuestion[];
  selectedAnswers: { [key: number]: number };
}

export default function DiagnosticScoreCard({
  score,
  totalItems,
  correct,
  incorrect,
  skipped,
  questions,
  selectedAnswers,
}: DiagnosticScoreCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isPassed = score >= 80;

  // Compute breakdown by category
  const categoryStats: CategoryStat[] = React.useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();

    questions.forEach((q, idx) => {
      const cat = q.category || "General";
      const userChoice = selectedAnswers[idx];
      const isCorrect = userChoice === q.answerIndex;

      const current = map.get(cat) || { total: 0, correct: 0 };
      current.total += 1;
      if (isCorrect) current.correct += 1;
      map.set(cat, current);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      correct: data.correct,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));
  }, [questions, selectedAnswers]);

  // Generate and download image via client-side canvas
  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      // Create off-screen high-res canvas
      const width = 1200;
      const height = 630;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not initialize canvas context");
      }

      // 1. Dark Premium Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#090d16");
      bgGrad.addColorStop(0.5, "#0f172a");
      bgGrad.addColorStop(1, "#020617");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Decorative Outer Border
      ctx.strokeStyle = isPassed ? "rgba(16, 185, 129, 0.4)" : "rgba(99, 102, 241, 0.4)";
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, width - 48, height - 48);

      // 3. Header Accent Bar
      const headerGrad = ctx.createLinearGradient(48, 48, width - 48, 48);
      headerGrad.addColorStop(0, isPassed ? "#10b981" : "#6366f1");
      headerGrad.addColorStop(1, isPassed ? "#06b6d4" : "#a855f7");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(48, 48, width - 96, 6);

      // 4. Logo / Platform Header
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("GovStudyX • PHILIPPINES CIVIL SERVICE EXAM", 56, 96);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px sans-serif";
      ctx.fillText("Official Diagnostic Competency Performance Card", 56, 126);

      // 5. Left Column: Big Score Rating Box
      const scoreBoxX = 56;
      const scoreBoxY = 160;
      const scoreBoxW = 400;
      const scoreBoxH = 380;

      ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
      ctx.fillRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH);
      ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH);

      // Score Badge
      ctx.fillStyle = isPassed ? "#10b981" : "#f43f5e";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(isPassed ? "★ CSC PASSING GRADE REACHED" : "▲ BENCHMARK: 80.00% PASSING", scoreBoxX + 24, scoreBoxY + 50);

      // Big Percentage
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 96px sans-serif";
      ctx.fillText(`${score}%`, scoreBoxX + 24, scoreBoxY + 160);

      // Sub-metrics in box
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(`Accuracy: ${correct} / ${totalItems} Items`, scoreBoxX + 24, scoreBoxY + 220);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "15px sans-serif";
      ctx.fillText(`Incorrect: ${incorrect}  •  Skipped: ${skipped}`, scoreBoxX + 24, scoreBoxY + 250);

      // Status pill at bottom of score box
      ctx.fillStyle = isPassed ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)";
      ctx.fillRect(scoreBoxX + 24, scoreBoxY + 290, scoreBoxW - 48, 50);
      ctx.fillStyle = isPassed ? "#34d399" : "#fb7185";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(
        isPassed ? "PASS READY FOR 2026 CSE" : "REVIEW RECOMMENDED",
        scoreBoxX + 44,
        scoreBoxY + 322
      );

      // 6. Right Column: Category Domain Breakdown
      const rightX = 496;
      let curY = 180;

      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("Subject Competency Breakdown", rightX, curY);
      curY += 40;

      categoryStats.slice(0, 5).forEach((cat) => {
        // Label & Percentage
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(cat.name, rightX, curY);

        ctx.fillStyle = cat.percentage >= 80 ? "#34d399" : "#fb7185";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(`${cat.percentage}% (${cat.correct}/${cat.total})`, rightX + 500, curY);
        curY += 12;

        // Progress Bar Background
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(rightX, curY, 640, 14);

        // Progress Bar Fill
        const fillW = Math.max(4, (cat.percentage / 100) * 640);
        ctx.fillStyle = cat.percentage >= 80 ? "#10b981" : cat.percentage >= 60 ? "#f59e0b" : "#f43f5e";
        ctx.fillRect(rightX, curY, fillW, 14);

        curY += 42;
      });

      // 7. Watermark / Footer
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.fillText("Practice timed mock exams & category drills at govstudyx.com", 56, height - 42);

      const dateStr = new Date().toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      ctx.fillText(`Date: ${dateStr}`, width - 200, height - 42);

      // Trigger download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `GovStudyX-Diagnostic-Score-${score}pct.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate diagnostic card image:", err);
      alert("Could not generate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopySummary = () => {
    const summaryText = `📊 My GovStudyX Civil Service Exam Diagnostic Result:\n\n` +
      `🏆 Score: ${score}% (${correct}/${totalItems} items)\n` +
      `🎯 Status: ${isPassed ? "PASSED (80%+ Target Achieved) 🎉" : "In Progress (Preparing for 2026 CSE)"}\n\n` +
      categoryStats.map(c => `• ${c.name}: ${c.percentage}%`).join("\n") +
      `\n\nPractice timed mock exams for 2026 Civil Service Exam at https://govstudyx.com`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      ref={cardRef}
      className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-left"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Award className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Official Diagnostic Performance Card
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Subject Competency &amp; Readiness Breakdown
          </h2>
        </div>

        {/* Share & Download Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? "Generating PNG…" : "Download Card (PNG)"}</span>
          </button>
        </div>
      </div>

      {/* Grid: Big Gauge + Category Domain Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left summary column */}
        <div className="lg:col-span-4 bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 text-center space-y-4">
          <div className="text-5xl sm:text-6xl font-black text-white tracking-tight">
            {score}%
          </div>
          <div className="space-y-1">
            <span
              className={`inline-block px-3 py-1 text-xs font-black uppercase rounded-full border ${
                isPassed
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-300 border-rose-500/30"
              }`}
            >
              {isPassed ? "★ CSE PASS READY" : "▲ 80% TARGET BENCHMARK"}
            </span>
            <p className="text-xs text-slate-400">
              {correct} correct out of {totalItems} total exam items
            </p>
          </div>

          <div className="pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Incorrect</span>
              <span className="text-rose-400 font-bold text-sm">{incorrect}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Skipped</span>
              <span className="text-slate-400 font-bold text-sm">{skipped}</span>
            </div>
          </div>
        </div>

        {/* Right breakdown column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="space-y-3">
            {categoryStats.map((cat) => (
              <div key={cat.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">{cat.name}</span>
                  <span className="font-mono font-bold text-slate-300">
                    <span className={cat.percentage >= 80 ? "text-emerald-400" : "text-amber-400"}>
                      {cat.percentage}%
                    </span>{" "}
                    <span className="text-slate-500 text-[11px]">({cat.correct}/{cat.total})</span>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.percentage >= 80
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : cat.percentage >= 60
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                        : "bg-gradient-to-r from-rose-500 to-red-400"
                    }`}
                    style={{ width: `${Math.max(4, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-xs text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Study Tip:</strong> Download or share your diagnostic card to review groups. Focus your next daily drills on categories below 80% to maximize your general average rating.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
