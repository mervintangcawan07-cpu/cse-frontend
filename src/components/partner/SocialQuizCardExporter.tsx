"use client";

import React, { useState, useRef } from "react";
import {
  Sparkles,
  Download,
  Video,
  Layers,
  CheckCircle2,
  Share2,
  ChevronRight,
  Eye,
  RefreshCw,
  Flame,
} from "lucide-react";

interface SampleQuiz {
  id: string;
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  prompt: string;
  options: string[];
  answerIndex: number;
  diskarteShortcut: string;
}

const CURATED_QUIZZES: SampleQuiz[] = [
  {
    id: "quiz-1",
    category: "Numerical Reasoning",
    difficulty: "HARD",
    prompt: "If 12 workers can build a wall in 15 days, how many days will it take 20 workers to build the same wall at the same rate?",
    options: ["A. 8 days", "B. 9 days", "C. 10 days", "D. 12 days"],
    answerIndex: 1,
    diskarteShortcut: "Inverse Proportion Shortcut:\n(Workers₁ × Days₁) = (Workers₂ × Days₂)\n12 × 15 = 180\nDays₂ = 180 ÷ 20 = 9 days! (Letter B)",
  },
  {
    id: "quiz-2",
    category: "Philippine Constitution (Gen Info)",
    difficulty: "MEDIUM",
    prompt: "Under Article II of the 1987 Constitution, civilian authority is, at all times, supreme over the military. What is the Armed Forces of the Philippines designated as?",
    options: [
      "A. The protector of the people and the State",
      "B. The guardian of the national territory",
      "C. The commander of national defense",
      "D. The enforcer of public order and safety",
    ],
    answerIndex: 0,
    diskarteShortcut: "Keyword Formula (1987 Const. Art II Sec 3):\nAFP = 'Protector of the people and the State'. PNP naman ang 'enforcer of public order'.\nAnswer is A!",
  },
  {
    id: "quiz-3",
    category: "Verbal Ability (Vocabulary)",
    difficulty: "HARD",
    prompt: "Choose the word most OPPOSITE in meaning to 'METICULOUS':",
    options: ["A. Scrupulous", "B. Fastidious", "C. Careless", "D. Punctual"],
    answerIndex: 2,
    diskarteShortcut: "Antonym Strategy:\n'Meticulous' means very careful and precise.\nA and B are synonyms. C ('Careless') is the direct antonym! Letter C!",
  },
  {
    id: "quiz-4",
    category: "Analytical Reasoning",
    difficulty: "HARD",
    prompt: "All civil servants are public servants. Some public servants are teachers. Which conclusion is DEFINITELY TRUE?",
    options: [
      "A. All teachers are civil servants",
      "B. Some public servants are civil servants",
      "C. No teachers are civil servants",
      "D. All public servants are teachers",
    ],
    answerIndex: 1,
    diskarteShortcut: "Venn Diagram Rule (Subsets):\nSince all A is in B, any element of A is also in B. Thus, 'Some public servants are civil servants' is 100% mathematically true! Letter B!",
  },
];

interface SocialQuizCardExporterProps {
  partnerName: string;
  partnerCode: string;
  partnerSlug?: string | null;
}

export default function SocialQuizCardExporter({
  partnerName,
  partnerCode,
  partnerSlug,
}: SocialQuizCardExporterProps) {
  const [selectedQuizIndex, setSelectedQuizIndex] = useState(0);
  const [activeSlide, setActiveSlide] = useState<1 | 2>(1);
  const [generatingPng, setGeneratingPng] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const quiz = CURATED_QUIZZES[selectedQuizIndex];
  const referralHandle = partnerSlug || partnerCode;
  const partnerUrl = `govstudyx.com/p/${referralHandle}`;

  // Helper function to wrap text onto canvas
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) => {
    const words = text.split(" ");
    let line = "";
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + " ";
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
    return curY + lineHeight;
  };

  // Render 9:16 Canvas (1080 x 1920)
  const drawCardCanvas = (slide: 1 | 2): HTMLCanvasElement => {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#090d16");
    bgGrad.addColorStop(0.3, "#0f172a");
    bgGrad.addColorStop(0.7, "#1e1b4b");
    bgGrad.addColorStop(1, "#020617");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Decorative Border & Glow
    ctx.strokeStyle = "rgba(124, 58, 237, 0.4)";
    ctx.lineWidth = 12;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // 3. Top Header Badge
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(80, 100, width - 160, 70);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PHILIPPINES CIVIL SERVICE EXAM 2026", width / 2, 145);

    // Category Tag
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`⚡ ${quiz.category.toUpperCase()} • 90% PASS RATE TRAP`, width / 2, 220);

    // 4. Question Container Box
    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.fillRect(80, 270, width - 160, 440);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 270, width - 160, 440);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "left";
    wrapText(ctx, quiz.prompt, 120, 360, width - 240, 56);

    // 5. Options A, B, C, D
    let optY = 760;
    quiz.options.forEach((opt, idx) => {
      const isCorrect = idx === quiz.answerIndex;
      const isSlide2 = slide === 2;

      // Box styling
      if (isSlide2 && isCorrect) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 6;
      } else {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
        ctx.lineWidth = 2;
      }

      ctx.fillRect(80, optY, width - 160, 110);
      ctx.strokeRect(80, optY, width - 160, 110);

      // Text styling
      ctx.fillStyle = isSlide2 && isCorrect ? "#34d399" : "#f1f5f9";
      ctx.font = isSlide2 && isCorrect ? "bold 34px sans-serif" : "bold 32px sans-serif";
      ctx.fillText(opt, 120, optY + 68);

      if (isSlide2 && isCorrect) {
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText("✓ CORRECT", width - 270, optY + 68);
      }

      optY += 135;
    });

    // 6. Bottom Slide Content
    if (slide === 1) {
      // Slide 1: Call to Action to Comment
      ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
      ctx.fillRect(80, 1340, width - 160, 180);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.strokeRect(80, 1340, width - 160, 180);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("👇 COMMENT YOUR ANSWER FIRST!", width / 2, 1410);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "28px sans-serif";
      ctx.fillText("Swipe right for the Diskarte Formula & Solution 👉", width / 2, 1465);
    } else {
      // Slide 2: Diskarte Solution Breakdown
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fillRect(80, 1320, width - 160, 240);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.strokeRect(80, 1320, width - 160, 240);

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("💡 DISKARTE & EXAM SHORTCUT:", 110, 1375);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "26px monospace";
      const lines = quiz.diskarteShortcut.split("\n");
      let lineY = 1425;
      lines.forEach((l) => {
        ctx.fillText(l, 110, lineY);
        lineY += 36;
      });
    }

    // 7. Watermark Footer with Partner Branding
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(80, 1600, width - 160, 200);
    ctx.strokeStyle = "rgba(124, 58, 237, 0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(80, 1600, width - 160, 200);

    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Presented by: ${partnerName}`, width / 2, 1660);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(`Practice 2,500+ Questions Free:`, width / 2, 1715);

    ctx.fillStyle = "#34d399";
    ctx.font = "bold 34px monospace";
    ctx.fillText(partnerUrl, width / 2, 1765);

    return canvas;
  };

  // Download Single Slide as PNG
  const handleDownloadSlide = (slide: 1 | 2) => {
    setGeneratingPng(true);
    try {
      const canvas = drawCardCanvas(slide);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.download = `TikTok-CSE-Quiz-${quiz.category.replace(/\s+/g, "_")}-Slide${slide}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error("Error generating quiz PNG:", err);
      alert("Failed to export card image.");
    } finally {
      setGeneratingPng(false);
    }
  };

  // Download Both Slides for Carousel
  const handleDownloadBoth = () => {
    handleDownloadSlide(1);
    setTimeout(() => {
      handleDownloadSlide(2);
    }, 400);
  };

  // Generate 15s Animated Countdown Clip via MediaRecorder (Client-side 100% free)
  const handleGenerateVideoClip = async () => {
    setGeneratingVideo(true);
    setVideoProgress(0);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize video canvas");

      const stream = canvas.captureStream(30); // 30 FPS
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `TikTok-CSE-15s-Quiz-${quiz.id}.webm`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
        setGeneratingVideo(false);
        setVideoProgress(100);
      };

      recorder.start();

      const totalDuration = 12; // 12 seconds total clip
      const startTime = performance.now();

      const renderFrame = (now: number) => {
        const elapsed = (now - startTime) / 1000;
        const progress = Math.min(1, elapsed / totalDuration);
        setVideoProgress(Math.round(progress * 100));

        const isRevealed = elapsed >= 7; // Reveal answer after 7 seconds

        // Draw background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1280);
        bgGrad.addColorStop(0, "#090d16");
        bgGrad.addColorStop(0.5, "#0f172a");
        bgGrad.addColorStop(1, "#020617");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 720, 1280);

        // Header
        ctx.fillStyle = "#7c3aed";
        ctx.fillRect(40, 60, 640, 48);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PHILIPPINES CIVIL SERVICE EXAM 2026", 360, 92);

        // Countdown Bar
        const barWidth = Math.max(0, 640 * (1 - Math.min(1, elapsed / 7)));
        ctx.fillStyle = isRevealed ? "#10b981" : "#f59e0b";
        ctx.fillRect(40, 120, isRevealed ? 640 : barWidth, 12);

        // Prompt
        ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
        ctx.fillRect(40, 160, 640, 280);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        wrapText(ctx, quiz.prompt, 70, 220, 580, 36);

        // Options
        let optY = 480;
        quiz.options.forEach((opt, idx) => {
          const isCorrect = idx === quiz.answerIndex;
          if (isRevealed && isCorrect) {
            ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 4;
          } else {
            ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
            ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
            ctx.lineWidth = 2;
          }
          ctx.fillRect(40, optY, 640, 75);
          ctx.strokeRect(40, optY, 640, 75);

          ctx.fillStyle = isRevealed && isCorrect ? "#34d399" : "#f1f5f9";
          ctx.font = "bold 20px sans-serif";
          ctx.fillText(opt, 70, optY + 46);

          if (isRevealed && isCorrect) {
            ctx.fillStyle = "#10b981";
            ctx.fillText("✓ CORRECT", 520, optY + 46);
          }

          optY += 92;
        });

        // Bottom CTA
        ctx.fillStyle = isRevealed ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)";
        ctx.fillRect(40, 880, 640, 140);
        ctx.fillStyle = isRevealed ? "#34d399" : "#fbbf24";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          isRevealed ? "🎉 Tap link in bio for full review pass!" : "⏳ Answer in the comments now!",
          360,
          940
        );

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "18px monospace";
        ctx.fillText(partnerUrl, 360, 980);

        if (elapsed < totalDuration) {
          requestAnimationFrame(renderFrame);
        } else {
          recorder.stop();
        }
      };

      requestAnimationFrame(renderFrame);
    } catch (err) {
      console.error("Video export error:", err);
      alert("Video recording not supported on this browser. Use the PNG Carousel export instead!");
      setGeneratingVideo(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-purple-400">
              TikTok &amp; Reels 9:16 Quiz Generator
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            1-Click Social Media Review Cards
          </h3>
          <p className="text-xs text-slate-400">
            Generate high-contrast, branded 9:16 vertical cards for TikTok photo carousels, Reels, and Facebook Stories.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadBoth}
            disabled={generatingPng || generatingVideo}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            <span>{generatingPng ? "Generating…" : "Download 2-Slide Carousel (PNG)"}</span>
          </button>

          <button
            onClick={handleGenerateVideoClip}
            disabled={generatingVideo || generatingPng}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            <span>
              {generatingVideo ? `Rendering Video (${videoProgress}%)…` : "Export 12s Video Clip"}
            </span>
          </button>
        </div>
      </div>

      {/* Quiz Question Selector */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase text-slate-400">
          Select Topic &amp; Question:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {CURATED_QUIZZES.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => {
                setSelectedQuizIndex(idx);
                setActiveSlide(1);
              }}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                selectedQuizIndex === idx
                  ? "bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-950/50"
                  : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-purple-400 block font-mono">
                  {q.category}
                </span>
                <p className="text-xs font-semibold text-slate-200 line-clamp-2">{q.prompt}</p>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 block font-mono">
                Difficulty: {q.difficulty}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 9:16 Live Preview Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
        {/* Left: 9:16 Scaled Phone Frame Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          {/* Slide Switcher */}
          <div className="flex items-center gap-2 mb-3 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSlide(1)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                activeSlide === 1
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Slide 1: Question
            </button>
            <button
              onClick={() => setActiveSlide(2)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                activeSlide === 2
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Slide 2: Answer &amp; Diskarte
            </button>
          </div>

          {/* Phone Canvas Container */}
          <div className="w-[300px] h-[533px] bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 rounded-3xl border-4 border-purple-500/40 p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden text-center text-white">
            <div className="space-y-2">
              <div className="bg-purple-600 py-1 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider">
                Philippine Civil Service Exam 2026
              </div>
              <div className="text-[10px] font-bold text-sky-400 uppercase">
                ⚡ {quiz.category}
              </div>
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 text-left text-xs font-bold leading-snug">
                {quiz.prompt}
              </div>
            </div>

            <div className="space-y-1.5 text-left text-[11px] font-semibold">
              {quiz.options.map((opt, idx) => {
                const isCorrect = idx === quiz.answerIndex;
                const isSlide2 = activeSlide === 2;
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border flex items-center justify-between ${
                      isSlide2 && isCorrect
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold"
                        : "bg-slate-950/70 border-slate-800 text-slate-300"
                    }`}
                  >
                    <span>{opt}</span>
                    {isSlide2 && isCorrect && (
                      <span className="text-[9px] font-black text-emerald-400">✓ CORRECT</span>
                    )}
                  </div>
                );
              })}
            </div>

            {activeSlide === 1 ? (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] text-amber-300 font-bold">
                👇 Comment your answer before swiping!
              </div>
            ) : (
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[9px] font-mono text-emerald-300 text-left whitespace-pre-line leading-tight">
                {quiz.diskarteShortcut}
              </div>
            )}

            <div className="pt-2 border-t border-purple-500/30 text-[9px] text-slate-400 font-mono">
              <span className="text-purple-300 font-bold">{partnerName}</span> • {partnerUrl}
            </div>
          </div>
        </div>

        {/* Right: Quick Instructions & Direct Download */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>How to Post on TikTok &amp; Facebook for Maximum Reach</span>
            </h4>
            <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
              <li>
                Click <strong className="text-purple-300">Download 2-Slide Carousel</strong>.
              </li>
              <li>
                Upload both images to <strong>TikTok Photo Mode</strong> or as a <strong>Facebook Carousel</strong>.
              </li>
              <li>
                Add caption: <em>"Subukan niyo sagutan bago mag-swipe! Link in bio para sa 2,500+ practice questions 🔥"</em>
              </li>
              <li>
                Add your promo code <strong className="text-emerald-400 font-mono">{partnerCode}</strong> for 10% student discount.
              </li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDownloadSlide(1)}
              disabled={generatingPng}
              className="p-4 bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-2xl text-left transition cursor-pointer space-y-1 group"
            >
              <span className="text-[10px] font-black uppercase text-purple-400 block">Slide 1 Only</span>
              <span className="text-xs font-bold text-white group-hover:text-purple-300 transition flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download Question
              </span>
            </button>

            <button
              onClick={() => handleDownloadSlide(2)}
              disabled={generatingPng}
              className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-2xl text-left transition cursor-pointer space-y-1 group"
            >
              <span className="text-[10px] font-black uppercase text-emerald-400 block">Slide 2 Only</span>
              <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download Answer
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
