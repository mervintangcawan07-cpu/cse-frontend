// Relative Path: src/components/social/rooms/StudyRoomStage.tsx
"use client";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import LiveWhiteboard, { DrawDelta } from "@/components/social/whiteboard/LiveWhiteboard";

interface StudyRoomStageProps {
  roomId: string;
  roomName: string;
  isHost?: boolean;
}

function RealtimeStageContent({ roomId, roomName, isHost = false }: StudyRoomStageProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "WHITEBOARD" | "SCREEN_SHARE">("OVERVIEW");
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Whiteboard & Host permission states
  const [allowMembersToDraw, setAllowMembersToDraw] = useState(false);
  const [incomingDelta, setIncomingDelta] = useState<DrawDelta | null>(null);
  const [incomingClearSignal, setIncomingClearSignal] = useState<number>(0);

  // Determine drawing permission
  const canDraw = isHost || allowMembersToDraw;

  // Listen for LiveKit Data Channel messages
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);

        if (data.type === "WHITEBOARD_DRAW") {
          setIncomingDelta(data.delta);
        } else if (data.type === "WHITEBOARD_CLEAR") {
          setIncomingClearSignal(Date.now());
        } else if (data.type === "WHITEBOARD_PERMISSIONS") {
          setAllowMembersToDraw(Boolean(data.allowMembersToDraw));
        }
      } catch (err) {
        console.error("Failed to parse DataChannel message:", err);
      }
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room]);

  // Host toggle for drawing permissions
  const toggleDrawingPermissions = () => {
    if (!isHost || !room || !localParticipant) return;
    const nextState = !allowMembersToDraw;
    setAllowMembersToDraw(nextState);

    try {
      const payload = JSON.stringify({
        type: "WHITEBOARD_PERMISSIONS",
        allowMembersToDraw: nextState,
      });
      const encoded = new TextEncoder().encode(payload);
      localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      console.error("Failed to broadcast permissions:", err);
    }
  };

  // Broadcast drawing strokes
  const handleDrawDelta = (delta: DrawDelta) => {
    if (!canDraw || !room || !localParticipant) return;
    try {
      const payload = JSON.stringify({ type: "WHITEBOARD_DRAW", delta });
      const encoded = new TextEncoder().encode(payload);
      localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      console.error("Failed to publish stroke delta:", err);
    }
  };

  // Broadcast clear board event
  const handleClearBoard = () => {
    if (!canDraw || !room || !localParticipant) return;
    try {
      const payload = JSON.stringify({ type: "WHITEBOARD_CLEAR" });
      const encoded = new TextEncoder().encode(payload);
      localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      console.error("Failed to publish clear signal:", err);
    }
  };

  // Toggle Microphones
  const toggleMic = async () => {
    if (!localParticipant) return;
    const nextState = !isMuted;
    try {
      await localParticipant.setMicrophoneEnabled(!nextState);
      setIsMuted(nextState);
    } catch (err) {
      console.error("Failed to toggle microphone:", err);
    }
  };

  // Toggle Raise Hand
  const toggleRaiseHand = () => {
    setIsHandRaised(!isHandRaised);
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    try {
      if (!isScreenSharing) {
        await localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
        setActiveTab("SCREEN_SHARE");
      } else {
        await localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        setActiveTab("OVERVIEW");
      }
    } catch (err) {
      console.error("Screen sharing error:", err);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <RoomAudioRenderer />

      {/* STAGE HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 px-2.5 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            Interactive Study Stage
          </span>
          <h2 className="text-lg font-black text-white mt-1">{roomName}</h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("OVERVIEW")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            📊 Study Area
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("WHITEBOARD")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "WHITEBOARD" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Live Whiteboard
          </button>
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === "SCREEN_SHARE" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            🖥️ {isScreenSharing ? "Screen Active" : "Share Screen"}
          </button>
        </div>
      </div>

      {/* DISPLAY STAGE */}
      <div className="flex-1 min-h-[420px] bg-slate-900 border border-slate-800 rounded-3xl p-4 relative overflow-hidden flex flex-col">
        {activeTab === "OVERVIEW" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
              🎧
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-base font-bold text-white">Voice Study Session Active</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You are connected to the LiveKit voice server. Unmute your microphone below to speak.
              </p>
            </div>
          </div>
        )}

        {activeTab === "WHITEBOARD" && (
          <LiveWhiteboard
            isHost={isHost}
            canDraw={canDraw}
            onDrawDelta={handleDrawDelta}
            onClearBoard={handleClearBoard}
            incomingDelta={incomingDelta}
            incomingClearSignal={incomingClearSignal}
          />
        )}

        {activeTab === "SCREEN_SHARE" && (
          <div className="flex-1 bg-black rounded-2xl flex items-center justify-center text-center p-6 border border-slate-800">
            <div className="space-y-2">
              <span className="text-3xl">🖥️</span>
              <p className="text-xs font-bold text-slate-300">Screen Sharing Active</p>
              <p className="text-[10px] text-slate-500">Your screen stream is live and visible to room members.</p>
            </div>
          </div>
        )}
      </div>

      {/* CONTROLS & HOST MODERATION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
              isMuted
                ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30"
                : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
            }`}
          >
            <span>{isMuted ? "🎤❌" : "🎤"}</span>
            <span>{isMuted ? "Unmute Mic" : "Microphone On"}</span>
          </button>

          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDrawingPermissions}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                allowMembersToDraw
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              <span>{allowMembersToDraw ? "✏️" : "🔒"}</span>
              <span>{allowMembersToDraw ? "Board: Everyone Can Draw" : "Board: Host Only"}</span>
            </button>

            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full hidden sm:inline-block">
              👑 Host Controls
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyRoomStage({ roomId, roomName, isHost = false }: StudyRoomStageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/social/rooms/${roomId}/voice-token`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.token) setToken(data.token);
        }
      } catch (err) {
        console.error("Voice token error:", err);
      } finally {
        if (isMounted) setLoadingToken(false);
      }
    };
    fetchToken();
    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (loadingToken) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 font-bold animate-pulse text-xs">
        ⚡ Connecting to Real-Time Voice Stage...
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-rose-400 font-bold text-xs space-y-1">
        <p>⚠️ Real-Time Stage Disconnected</p>
        <p className="text-[10px] text-slate-500 font-normal">Check LIVEKIT credentials in environment variables.</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      className="w-full"
    >
      <RealtimeStageContent roomId={roomId} roomName={roomName} isHost={isHost} />
    </LiveKitRoom>
  );
}