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
import { RoomRoleBadge } from "@/components/social/rooms/RoomRoleBadge";
import { ChooseTopicModal } from "@/components/social/rooms/ChooseTopicModal";
import { ActiveTopicCard } from "@/components/social/rooms/ActiveTopicCard";

interface StudyRoomStageProps {
  roomId: string;
  roomName: string;
  isHost?: boolean;
  userRole?: "HOST" | "MODERATOR" | "MEMBER";
  allowMemberWhiteboard?: boolean;
  allowMemberScreenShare?: boolean;
  canUserDraw?: boolean;
  canUserShare?: boolean;
  isUserForceMuted?: boolean;
  activeTopicType?: "QUESTION" | "IMAGE" | null;
  activeQuestionId?: string | null;
  activeTopicImage?: string | null;
  activeTopicMeta?: any;
  onOpenSettings?: () => void;
  onTopicChanged?: () => void;
}

function RealtimeStageContent({
  roomId,
  roomName,
  isHost = false,
  userRole = "MEMBER",
  allowMemberWhiteboard = true,
  allowMemberScreenShare = true,
  canUserDraw = true,
  canUserShare = true,
  isUserForceMuted = false,
  activeTopicType = null,
  activeQuestionId = null,
  activeTopicImage = null,
  activeTopicMeta = null,
  onOpenSettings,
  onTopicChanged,
}: StudyRoomStageProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "WHITEBOARD" | "SCREEN_SHARE">("OVERVIEW");
  const [isMuted, setIsMuted] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Active Study Topic state (synced with DB & DataChannel)
  const [currentTopicType, setCurrentTopicType] = useState<"QUESTION" | "IMAGE" | null>(activeTopicType);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(activeQuestionId);
  const [currentTopicImage, setCurrentTopicImage] = useState<string | null>(activeTopicImage);
  const [currentTopicMeta, setCurrentTopicMeta] = useState<any>(activeTopicMeta);
  const [showChooseTopicModal, setShowChooseTopicModal] = useState(false);

  // Sync with incoming props from parent API poll
  useEffect(() => {
    setCurrentTopicType(activeTopicType);
    setCurrentQuestionId(activeQuestionId);
    setCurrentTopicImage(activeTopicImage);
    setCurrentTopicMeta(activeTopicMeta);
  }, [activeTopicType, activeQuestionId, activeTopicImage, activeTopicMeta]);

  // Live Whiteboard sync states
  const [incomingDelta, setIncomingDelta] = useState<DrawDelta | null>(null);
  const [incomingClearSignal, setIncomingClearSignal] = useState<number>(0);
  const [handRaiseAlerts, setHandRaiseAlerts] = useState<string[]>([]);

  const isModerator = userRole === "MODERATOR";
  const isHostOrMod = isHost || isModerator;

  // Determine drawing and screen share permissions
  const canDraw = isHostOrMod || (allowMemberWhiteboard && canUserDraw);
  const canShare = isHostOrMod || (allowMemberScreenShare && canUserShare);

  // Handle force-mute from Host/Mod
  useEffect(() => {
    if (isUserForceMuted && localParticipant) {
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
      setIsMuted(true);
    }
  }, [isUserForceMuted, localParticipant]);

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
        } else if (data.type === "HAND_RAISE") {
          if (data.userName) {
            setHandRaiseAlerts((prev) => [...prev.slice(-4), data.userName]);
          }
        } else if (data.type === "STUDY_TOPIC_SET") {
          if (data.topic) {
            setCurrentTopicType(data.topic.activeTopicType);
            setCurrentQuestionId(data.topic.activeQuestionId || null);
            setCurrentTopicImage(data.topic.activeTopicImage || null);
            setCurrentTopicMeta(data.topic.activeTopicMeta || null);
            setActiveTab("OVERVIEW");
          }
        } else if (data.type === "STUDY_TOPIC_CLEAR") {
          setCurrentTopicType(null);
          setCurrentQuestionId(null);
          setCurrentTopicImage(null);
          setCurrentTopicMeta(null);
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

  // Broadcast topic set event to all room participants
  const broadcastTopicSet = (topic: any) => {
    if (!room || !localParticipant) return;
    try {
      const payload = JSON.stringify({ type: "STUDY_TOPIC_SET", topic });
      const encoded = new TextEncoder().encode(payload);
      localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      console.error("Failed to broadcast topic set:", err);
    }
  };

  // Broadcast topic clear event to all room participants
  const broadcastTopicClear = () => {
    if (!room || !localParticipant) return;
    try {
      const payload = JSON.stringify({ type: "STUDY_TOPIC_CLEAR" });
      const encoded = new TextEncoder().encode(payload);
      localParticipant.publishData(encoded, { reliable: true });
    } catch (err) {
      console.error("Failed to broadcast topic clear:", err);
    }
  };

  // Host removes topic
  const handleRemoveTopic = async () => {
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/topic`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCurrentTopicType(null);
        setCurrentQuestionId(null);
        setCurrentTopicImage(null);
        setCurrentTopicMeta(null);
        broadcastTopicClear();
        onTopicChanged?.();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to remove topic");
      }
    } catch (err) {
      console.error("Failed to delete topic:", err);
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
    if (isUserForceMuted) {
      alert("You have been muted by a host or moderator.");
      return;
    }
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
    const nextRaised = !isHandRaised;
    setIsHandRaised(nextRaised);

    if (nextRaised && room && localParticipant) {
      try {
        const payload = JSON.stringify({
          type: "HAND_RAISE",
          userName: localParticipant.name || "A member",
        });
        const encoded = new TextEncoder().encode(payload);
        localParticipant.publishData(encoded, { reliable: true });
      } catch (err) {
        console.error("Failed to broadcast hand raise:", err);
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    if (!canShare) {
      alert("Screen sharing is restricted to hosts and moderators in this room.");
      return;
    }

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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 px-2.5 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              Interactive Study Stage
            </span>
            <RoomRoleBadge role={userRole} size="sm" />
          </div>
          <h2 className="text-lg font-black text-white">{roomName}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* TAB BUTTONS */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("OVERVIEW")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "OVERVIEW" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📊</span>
              <span>Overview</span>
              {currentTopicType && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active Study Topic" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("WHITEBOARD")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "WHITEBOARD" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-400 hover:text-white"
              }`}
            >
              ✏️ Whiteboard
            </button>
            <button
              type="button"
              onClick={toggleScreenShare}
              disabled={!canShare && !isScreenSharing}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-40 ${
                activeTab === "SCREEN_SHARE"
                  ? "bg-blue-600 text-white shadow-md font-black"
                  : canShare
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 cursor-not-allowed"
              }`}
              title={!canShare ? "Screen sharing disabled by room policy" : undefined}
            >
              🖥️ {isScreenSharing ? "Screen Active" : "Share Screen"}
            </button>
          </div>

          {/* Host Choose Study Topic Button */}
          {isHost && (
            <button
              type="button"
              onClick={() => setShowChooseTopicModal(true)}
              className="px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Select a question or upload an image to present to participants"
            >
              <span>📖</span>
              <span>{currentTopicType ? "Change Study Topic" : "Choose Study Topic"}</span>
            </button>
          )}

          {/* Host Room Policy Settings Button */}
          {isHost && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Manage Room Permissions & Policies"
            >
              <span>👑</span>
              <span className="hidden sm:inline">Room Policies</span>
            </button>
          )}
        </div>
      </div>

      {/* HAND RAISED ALERTS FOR HOST/MOD */}
      {isHostOrMod && handRaiseAlerts.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs text-amber-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✋</span>
            <span>
              <strong>{handRaiseAlerts[handRaiseAlerts.length - 1]}</strong> raised their hand to speak or share!
            </span>
          </div>
          <button
            onClick={() => setHandRaiseAlerts([])}
            className="text-[10px] font-bold text-amber-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DISPLAY STAGE */}
      <div className="flex-1 min-h-[420px] bg-slate-900 border border-slate-800 rounded-3xl p-4 relative overflow-hidden flex flex-col">
        {activeTab === "OVERVIEW" && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            {currentTopicType ? (
              <ActiveTopicCard
                topicType={currentTopicType}
                questionMeta={currentTopicMeta}
                topicImage={currentTopicImage}
                topicMeta={currentTopicMeta}
                isHost={isHost}
                onChangeTopic={() => setShowChooseTopicModal(true)}
                onRemoveTopic={handleRemoveTopic}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
                  🎧
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-base font-bold text-white">Voice Study Session Active</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You are connected to the LiveKit voice server. Unmute your microphone below to collaborate.
                  </p>
                  {isHost && (
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => setShowChooseTopicModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
                      >
                        <span>📖</span>
                        <span>Choose Question or Upload Topic</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "WHITEBOARD" && (
          <div className="flex-1 flex flex-col">
            {!canDraw && (
              <div className="mb-2 p-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <span>🔒</span>
                <span>Whiteboard drawing is currently restricted by the host. (View only)</span>
              </div>
            )}
            <LiveWhiteboard
              isHost={isHostOrMod}
              canDraw={canDraw}
              onDrawDelta={handleDrawDelta}
              onClearBoard={handleClearBoard}
              incomingDelta={incomingDelta}
              incomingClearSignal={incomingClearSignal}
            />
          </div>
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

      {/* CONTROLS & VOICE TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={isUserForceMuted}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isUserForceMuted
                ? "bg-slate-800 text-rose-400 border border-rose-500/20 cursor-not-allowed"
                : isMuted
                ? "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30"
                : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
            }`}
          >
            <span>{isUserForceMuted ? "🔇 Force Muted" : isMuted ? "🎤❌" : "🎤"}</span>
            <span>{isUserForceMuted ? "Muted by Host" : isMuted ? "Unmute Mic" : "Microphone On"}</span>
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

        <div className="flex items-center gap-2 text-xs">
          {isHost ? (
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              👑 Room Host
            </span>
          ) : isModerator ? (
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
              🛡️ Moderator
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400">
              {canDraw ? "✏️ Drawing Enabled" : "🔒 View Only"}
            </span>
          )}
        </div>
      </div>

      {/* CHOOSE STUDY TOPIC MODAL (HOST ONLY) */}
      {isHost && (
        <ChooseTopicModal
          isOpen={showChooseTopicModal}
          roomId={roomId}
          onClose={() => setShowChooseTopicModal(false)}
          onTopicUpdated={(newTopic) => {
            setCurrentTopicType(newTopic.activeTopicType);
            setCurrentQuestionId(newTopic.activeQuestionId || null);
            setCurrentTopicImage(newTopic.activeTopicImage || null);
            setCurrentTopicMeta(newTopic.activeTopicMeta || null);
            broadcastTopicSet(newTopic);
            onTopicChanged?.();
            setActiveTab("OVERVIEW");
          }}
        />
      )}
    </div>
  );
}

export default function StudyRoomStage(props: StudyRoomStageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/social/rooms/${props.roomId}/voice-token`);
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
  }, [props.roomId]);

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
      <RealtimeStageContent {...props} />
    </LiveKitRoom>
  );
}