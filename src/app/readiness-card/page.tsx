"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CardMetrics {
  userName: string;
  memberSince: number;
  currentStreak: number;
  longestStreak: number;
  totalExams: number;
  totalQuestionsSolved: number;
  totalCorrect: number;
  averageScore: number;
  passReadiness: number;
  rankTitle: string;
  badgeTier: string;
}

type CardTheme = "GOLD" | "MIDNIGHT" | "SAPPHIRE";

export default function ReadinessCardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<CardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Customization States
  const [theme, setTheme] = useState<CardTheme>("GOLD");
  const [examLevel, setExamLevel] = useState("Professional Level");
  const [customName, setCustomName] = useState("");
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch("/api/user/readiness-card");
        const data = await res.json();

        if (res.ok && data.cardData) {
          setMetrics(data.cardData);
          setCustomName(data.cardData.userName);
        } else if (res.status === 401) {
          router.push("/login");
        }
      } catch (err) {
        console.error("Failed to load readiness card data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, [router]);

  // Client-Side Canvas Render Function for Crisp 1080x1080 Image Export
  const generateImage = (): string | null => {
    if (!metrics) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background Gradient based on Selected Theme
    if (theme === "GOLD") {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(0.5, "#1e1b4b");
      grad.addColorStop(1, "#020617");
      ctx.fillStyle = grad;
    } else if (theme === "MIDNIGHT") {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(1, "#111827");
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, "#030712");
      grad.addColorStop(0.5, "#075985");
      grad.addColorStop(1, "#030712");
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative Borders
    ctx.strokeStyle = theme === "GOLD" ? "#f59e0b" : theme === "SAPPHIRE" ? "#38bdf8" : "#3b82f6";
    ctx.lineWidth = 12;
    ctx.strokeRect(40, 40, 1000, 1000);

    // Header Badge
    ctx.fillStyle = theme === "GOLD" ? "#fbbf24" : "#38bdf8";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PHILIPPINES CIVIL SERVICE EXAM PREP", 540, 110);

    // Student Name & Level
    ctx.fillStyle = "#ffffff";
    ctx.font = "black 64px sans-serif";
    ctx.fillText(customName || metrics.userName, 540, 200);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(examLevel.toUpperCase(), 540, 250);

    // Score Circle Background
    ctx.beginPath();
    ctx.arc(540, 460, 140, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fill();
    ctx.strokeStyle = theme === "GOLD" ? "#f59e0b" : "#3b82f6";
    ctx.lineWidth = 16;
    ctx.stroke();

    // Pass Readiness Percentage Text
    ctx.fillStyle = theme === "GOLD" ? "#fbbf24" : "#38bdf8";
    ctx.font = "black 90px sans-serif";
    ctx.fillText(`${metrics.passReadiness}%`, 540, 475);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("PASS READINESS", 540, 530);

    // Rank Title Banner
    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
    ctx.fillRect(240, 620, 600, 70);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 620, 600, 70);

    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(metrics.rankTitle, 540, 668);

    // Stats Grid
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(`🔥 Study Streak: ${metrics.currentStreak} Days`, 320, 780);
    ctx.fillText(`📝 Solved: ${metrics.totalQuestionsSolved} Items`, 760, 780);

    ctx.fillText(`🎯 Avg Score: ${metrics.averageScore}%`, 320, 850);
    ctx.fillText(`⏱️ Mock Exams: ${metrics.totalExams}`, 760, 850);

    // Footer Branding
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Verified Progress • GovStudyX Platform", 540, 970);

    return canvas.toDataURL("image/png");
  };

  const handleDownload = () => {
    setExporting(true);
    setTimeout(() => {
      const dataUrl = generateImage();
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `CSE-Readiness-Card-${customName.replace(/\s+/g, "-")}.png`;
        a.click();
      }
      setExporting(false);
    }, 300);
  };

  const handleShare = async () => {
    const dataUrl = generateImage();
    if (!dataUrl) return;

    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "cse-readiness-card.png", { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "My Civil Service Exam Readiness Score",
          text: `I'm ${metrics?.passReadiness}% ready for the Civil Service Examination! 🇵🇭`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch (err) {
      console.error("Sharing failed:", err);
      handleDownload();
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center font-bold text-slate-400 animate-pulse">
        Generating your Eligibility Readiness Card...
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="w-full px-0 py-2 sm:px-3 sm:py-4 lg:px-6 text-slate-100 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-none border-x-0 sm:rounded-2xl sm:border lg:rounded-3xl shadow-xl overflow-hidden">
        {/* HEADER BANNER - Seamlessly integrated */}
        <div className="bg-slate-900 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Viral Progress Flex
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              Eligibility Readiness Card
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Customize and export your official study status card to share on Facebook, Instagram, or Messenger.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 shrink-0"
          >
            ← Dashboard
          </Link>
        </div>

        {/* UNIFIED CONTENT BODY */}
        <div className="p-3.5 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CUSTOMIZATION PANEL */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-5 h-fit">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              🎨 Card Customizer
            </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Display Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Exam Target Level</label>
            <select
              value={examLevel}
              onChange={(e) => setExamLevel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="Professional Level">Professional Level</option>
              <option value="Sub-Professional Level">Sub-Professional Level</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Visual Theme</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTheme("GOLD")}
                className={`py-2 rounded-xl text-xs font-black transition border ${
                  theme === "GOLD"
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                👑 Gold
              </button>
              <button
                onClick={() => setTheme("MIDNIGHT")}
                className={`py-2 rounded-xl text-xs font-black transition border ${
                  theme === "MIDNIGHT"
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                🌙 Dark
              </button>
              <button
                onClick={() => setTheme("SAPPHIRE")}
                className={`py-2 rounded-xl text-xs font-black transition border ${
                  theme === "SAPPHIRE"
                    ? "bg-sky-500/20 border-sky-500 text-sky-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                💎 Sapphire
              </button>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={handleShare}
              disabled={exporting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>📲 Share to Facebook / Story</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={exporting}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition border border-slate-700 flex items-center justify-center gap-2"
            >
              <span>💾 Download Image (1080x1080 PNG)</span>
            </button>
          </div>
        </div>

        {/* LIVE CARD PREVIEW CONTAINER */}
        <div className="lg:col-span-2 flex justify-center items-center">
          <div
            className={`w-full max-w-md aspect-square rounded-3xl p-6 sm:p-8 border-2 shadow-2xl flex flex-col justify-between transition-all ${
              theme === "GOLD"
                ? "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 border-amber-500/50"
                : theme === "MIDNIGHT"
                ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-blue-500/40"
                : "bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950 border-sky-500/50"
            }`}
          >
            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                PHILIPPINES CIVIL SERVICE EXAM PREP
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white truncate">
                {customName || metrics.userName}
              </h2>
              <span className="text-xs font-bold text-slate-400 block uppercase">
                {examLevel}
              </span>
            </div>

            {/* SCORE RING */}
            <div className="my-auto text-center py-4">
              <div className="inline-flex flex-col items-center justify-center w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-slate-950/80 border-4 border-amber-500 shadow-inner">
                <span className="text-4xl sm:text-5xl font-black text-amber-400">
                  {metrics.passReadiness}%
                </span>
                <span className="text-[10px] font-extrabold text-white tracking-wider uppercase mt-1">
                  Pass Readiness
                </span>
              </div>

              <div className="mt-4 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl inline-block">
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  {metrics.rankTitle}
                </span>
              </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 block">STUDY STREAK</span>
                <span className="text-sm font-black text-amber-400">🔥 {metrics.currentStreak} Days</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">QUESTIONS SOLVED</span>
                <span className="text-sm font-black text-white">📝 {metrics.totalQuestionsSolved} Items</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">AVERAGE SCORE</span>
                <span className="text-sm font-black text-emerald-400">🎯 {metrics.averageScore}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">EXAMS TAKEN</span>
                <span className="text-sm font-black text-sky-400">⏱️ {metrics.totalExams}</span>
              </div>
            </div>

            <span className="text-[10px] text-center text-slate-500 font-bold block">
              Verified Progress • GovStudyX Platform
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}