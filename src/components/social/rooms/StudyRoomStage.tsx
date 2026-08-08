// Relative Path: src/components/social/rooms/StudyRoomStage.tsx
"use client";

import { useState } from "react";
import LiveWhiteboard from "@/components/social/whiteboard/LiveWhiteboard";

interface StudyRoomStageProps {
  roomId: string;
  roomName: string;
  isHost?: boolean;
}

export default function StudyRoomStage({ roomId, roomName, isHost = false }: StudyRoomStageProps) {
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "WHITEBOARD" | "SCREEN_SHARE">("OVERVIEW");
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleMic = () => {
    setIsMuted(!isMuted);
  };

  const toggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setIsScreenSharing(true);
        setActiveTab("SCREEN_SHARE");
      } catch (err) {
        console.error("Screen sharing canceled or failed:", err);
      }
    } else {
      setIsScreenSharing(false);
      setActiveTab("OVERVIEW");
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 px-2.5 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            Interactive Study Stage
          </span>
          <h2 className="text-lg font-black text-white mt-1">{roomName}</h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📊 Study Area
          </button>
          <button
            onClick={() => setActiveTab("WHITEBOARD")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "WHITEBOARD" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Live Whiteboard
          </button>
          <button
            onClick={toggleScreenShare}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "SCREEN_SHARE" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            🖥️ {isScreenSharing ? "Screen Active" : "Share Screen"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[420px] bg-slate-900 border border-slate-800 rounded-3xl p-4 relative overflow-hidden flex flex-col">
        {activeTab === "OVERVIEW" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
              🎧
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-white">Voice Study Session Active</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You are connected to the voice room. Use the controls below to unmute your mic, share your screen, or raise your hand to speak.
              </p>
            </div>
          </div>
        )}

        {activeTab === "WHITEBOARD" && <LiveWhiteboard isHost={isHost} />}

        {activeTab === "SCREEN_SHARE" && (
          <div className="flex-1 bg-black rounded-2xl flex items-center justify-center text-center p-6 border border-slate-800">
            <div className="space-y-2">
              <span className="text-3xl">🖥️</span>
              <p className="text-xs font-bold text-slate-300">Screen Sharing Active</p>
              <p className="text-[10px] text-slate-500">All room participants can see your shared screen in real-time.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              isMuted
                ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30"
                : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
            }`}
          >
            <span>{isMuted ? "🎤❌" : "🎤"}</span>
            <span>{isMuted ? "Unmute Mic" : "Muted"}</span>
          </button>

          <button
            onClick={toggleRaiseHand}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 ${
              isHandRaised
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }`}
          >
            <span>✋</span>
            <span>{isHandRaised ? "Hand Raised" : "Raise Hand"}</span>
          </button>
        </div>

        {isHost && (
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            👑 Room Host Controls Enabled
          </span>
        )}
      </div>
    </div>
  );
}