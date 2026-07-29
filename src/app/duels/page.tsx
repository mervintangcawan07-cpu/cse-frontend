"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Question {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

interface MatchState {
  id: string;
  player1Id: string;
  player1Name: string;
  player2Id?: string | null;
  player2Name?: string | null;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED";
  questions: Question[];
  p1Score: number;
  p2Score: number;
  p1Current: number;
  p2Current: number;
  winnerId?: string | null;
}

export default function DuelsArenaPage() {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [playerRole, setPlayerRole] = useState<"P1" | "P2">("P1");
  const [searching, setSearching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answeredRound, setAnsweredRound] = useState(false);
  const [roundTimeLeft, setRoundTimeLeft] = useState(10); // 10 seconds per round

  // 1. Join Matchmaking
  const handleStartMatchmaking = async () => {
    setSearching(true);
    try {
      const res = await fetch("/api/duels/matchmake", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.match) {
        setMatch(data.match);
        setPlayerRole(data.playerRole);
        setCurrentIndex(0);
        setSelectedOption(null);
        setAnsweredRound(false);
        setRoundTimeLeft(10);
      } else {
        alert(data.error || "Matchmaking failed. Try again.");
        setSearching(false);
      }
    } catch (err) {
      console.error(err);
      alert("Connection error during matchmaking.");
      setSearching(false);
    }
  };

  // 2. Poll Match State Every 1.5s
  useEffect(() => {
    if (!match?.id || match.status === "FINISHED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/duels/${match.id}`);
        const data = await res.json();
        if (res.ok && data.match) {
          setMatch(data.match);
          if (data.match.status === "IN_PROGRESS" && searching) {
            setSearching(false);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [match?.id, match?.status, searching]);

  // 3. Round Countdown Timer (10 Seconds per Question)
  useEffect(() => {
    if (!match || match.status !== "IN_PROGRESS" || answeredRound) return;

    if (roundTimeLeft > 0) {
      const timer = setTimeout(() => setRoundTimeLeft((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (roundTimeLeft === 0) {
      // Auto-submit missed round
      handleSelectOption(-1);
    }
  }, [match, roundTimeLeft, answeredRound]);

  // 4. Submit Option Answer
  const handleSelectOption = async (optionIdx: number) => {
    if (answeredRound || !match) return;

    setSelectedOption(optionIdx);
    setAnsweredRound(true);

    try {
      const res = await fetch(`/api/duels/${match.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: currentIndex,
          selectedIndex: optionIdx,
        }),
      });

      const data = await res.json();
      if (res.ok && data.match) {
        setMatch(data.match);
      }
    } catch (err) {
      console.error("Error submitting duel answer:", err);
    }

    // Auto advance to next question after 1.5s delay
    setTimeout(() => {
      if (currentIndex < 4) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
        setAnsweredRound(false);
        setRoundTimeLeft(10);
      }
    }, 1500);
  };

  // UI STATE 1: LOBBY & MATCHMAKING RADAR
  if (!match || searching) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center font-sans space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6">
          <span className="text-4xl block animate-bounce">⚔️</span>
          <div>
            <span className="text-xs font-black uppercase px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
              Live Battle Arena
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-3">
              1v1 Study Duels
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Challenge fellow Civil Service reviewees in a 5-round rapid speed quiz. 10 seconds per item!
            </p>
          </div>

          {searching ? (
            <div className="space-y-4 py-6">
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-amber-400 animate-pulse">
                Searching for online opponent...
              </p>
            </div>
          ) : (
            <button
              onClick={handleStartMatchmaking}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base rounded-2xl shadow-xl transition transform hover:scale-105"
            >
              ⚔️ Find Match Now
            </button>
          )}

          <div className="pt-2">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-400 hover:text-white transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // UI STATE 2: FINISHED RESULTS SCREEN
  if (match.status === "FINISHED") {
    const isP1 = playerRole === "P1";
    const myScore = isP1 ? match.p1Score : match.p2Score;
    const oppScore = isP1 ? match.p2Score : match.p1Score;
    const myName = isP1 ? match.player1Name : match.player2Name || "You";
    const oppName = isP1 ? match.player2Name || "Opponent" : match.player1Name;

    const isWinner = myScore > oppScore;
    const isDraw = myScore === oppScore;

    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center font-sans space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <span className="text-5xl block">
            {isWinner ? "🏆" : isDraw ? "🤝" : "💀"}
          </span>

          <div>
            <h1 className="text-3xl font-black text-white">
              {isWinner ? "VICTORY!" : isDraw ? "DRAW MATCH!" : "DEFEAT"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isWinner
                ? "Awesome speed and accuracy! You earned +50 XP and 1 Streak Shield!"
                : "Good effort! Keep practicing to climb the leaderboard."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-400">{myName}</span>
              <p className="text-3xl font-black text-white">{myScore} pts</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-rose-400">{oppName}</span>
              <p className="text-3xl font-black text-white">{oppScore} pts</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setMatch(null)}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
            >
              ⚔️ Play Again
            </button>
            <Link
              href="/dashboard"
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition border border-slate-700"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // UI STATE 3: LIVE BATTLE ARENA
  const currentQ = match.questions[currentIndex];
  const isP1 = playerRole === "P1";
  const myScore = isP1 ? match.p1Score : match.p2Score;
  const oppScore = isP1 ? match.p2Score : match.p1Score;
  const myName = isP1 ? match.player1Name : match.player2Name || "You";
  const oppName = isP1 ? match.player2Name || "Waiting..." : match.player1Name;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 font-sans space-y-6 text-slate-100">
      {/* ARENA SCOREBOARD HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-400">{myName}</span>
            <span className="text-white font-black text-sm">({myScore} pts)</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full">
            <span>⏱</span>
            <span className="font-black">{roundTimeLeft}s</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm">({oppScore} pts)</span>
            <span className="text-rose-400">{oppName}</span>
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
          </div>
        </div>

        {/* PROGRESS BARS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(myScore / 100) * 100}%` }}
            />
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(oppScore / 100) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* QUESTION CARD */}
      {currentQ && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="text-xs font-black uppercase text-amber-400">
              Round {currentIndex + 1} of 5 • {currentQ.category}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              +20 pts per correct answer
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {currentQ.prompt}
          </h2>

          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === currentQ.answerIndex;

              let style = "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700";

              if (answeredRound) {
                if (isCorrect) {
                  style = "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold";
                } else if (isSelected) {
                  style = "bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={answeredRound}
                  className={`w-full text-left p-4 rounded-2xl border text-xs sm:text-sm transition flex justify-between items-center ${style}`}
                >
                  <span>
                    <strong className="mr-2 uppercase">
                      {String.fromCharCode(65 + idx)}.
                    </strong>
                    {opt}
                  </span>
                  {answeredRound && isCorrect && (
                    <span className="text-emerald-400 text-xs font-black">✓ Correct</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}