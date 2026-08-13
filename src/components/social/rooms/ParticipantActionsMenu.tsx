// Relative Path: src/components/social/rooms/ParticipantActionsMenu.tsx
"use client";

import React, { useState } from "react";

interface ParticipantActionsMenuProps {
  roomId: string;
  currentUserRole: "HOST" | "MODERATOR" | "MEMBER";
  currentUserId: string;
  participant: {
    id: string;
    userId: string;
    role: "HOST" | "MODERATOR" | "MEMBER";
    name: string;
    canDraw?: boolean;
    canShare?: boolean;
    isMuted?: boolean;
  };
  onActionComplete: () => void;
}

export const ParticipantActionsMenu: React.FC<ParticipantActionsMenuProps> = ({
  roomId,
  currentUserRole,
  currentUserId,
  participant,
  onActionComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Self cannot be managed via this menu
  if (participant.userId === currentUserId) return null;

  // Regular members cannot manage anyone
  if (currentUserRole === "MEMBER") return null;

  // Moderators cannot manage the host or other moderators
  if (currentUserRole === "MODERATOR" && (participant.role === "HOST" || participant.role === "MODERATOR")) {
    return null;
  }

  const isHost = currentUserRole === "HOST";

  const handleUpdateParticipant = async (updates: {
    role?: "MODERATOR" | "MEMBER";
    canDraw?: boolean;
    canShare?: boolean;
    isMuted?: boolean;
  }) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: participant.userId,
          ...updates,
        }),
      });

      if (res.ok) {
        setIsOpen(false);
        onActionComplete();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update participant");
      }
    } catch (err) {
      console.error("Failed to update participant:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKickParticipant = async () => {
    if (!confirm(`Remove ${participant.name} from the study room?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/participants?targetUserId=${participant.userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setIsOpen(false);
        onActionComplete();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to remove participant");
      }
    } catch (err) {
      console.error("Failed to remove participant:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs"
        title="Participant Controls"
      >
        ⚙️
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-fade-in text-xs">
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/80">
              Manage {participant.name}
            </div>

            {/* Host Only: Role Promotion / Demotion */}
            {isHost && (
              <>
                {participant.role === "MEMBER" ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleUpdateParticipant({ role: "MODERATOR" })}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-indigo-300 flex items-center gap-2 text-left cursor-pointer transition"
                  >
                    <span>🛡️</span>
                    <span className="font-bold">Promote to Moderator</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleUpdateParticipant({ role: "MEMBER" })}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center gap-2 text-left cursor-pointer transition"
                  >
                    <span>🧑‍🎓</span>
                    <span className="font-bold">Demote to Member</span>
                  </button>
                )}
              </>
            )}

            {/* Whiteboard Permission Toggle */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleUpdateParticipant({ canDraw: !participant.canDraw })}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center justify-between text-left cursor-pointer transition"
            >
              <div className="flex items-center gap-2">
                <span>✏️</span>
                <span>Whiteboard Draw</span>
              </div>
              <span className={`text-[10px] font-black ${participant.canDraw !== false ? "text-emerald-400" : "text-rose-400"}`}>
                {participant.canDraw !== false ? "Allowed" : "Blocked"}
              </span>
            </button>

            {/* Screen Share Permission Toggle */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleUpdateParticipant({ canShare: !participant.canShare })}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center justify-between text-left cursor-pointer transition"
            >
              <div className="flex items-center gap-2">
                <span>🖥️</span>
                <span>Screen Share</span>
              </div>
              <span className={`text-[10px] font-black ${participant.canShare !== false ? "text-emerald-400" : "text-rose-400"}`}>
                {participant.canShare !== false ? "Allowed" : "Blocked"}
              </span>
            </button>

            {/* Force Mute / Audio Toggle */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleUpdateParticipant({ isMuted: !participant.isMuted })}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-slate-900 text-slate-300 flex items-center justify-between text-left cursor-pointer transition"
            >
              <div className="flex items-center gap-2">
                <span>🎙️</span>
                <span>Microphone</span>
              </div>
              <span className={`text-[10px] font-black ${participant.isMuted ? "text-rose-400" : "text-emerald-400"}`}>
                {participant.isMuted ? "Muted" : "Active"}
              </span>
            </button>

            {/* Kick / Remove from Room */}
            <div className="pt-1 border-t border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={handleKickParticipant}
                className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 flex items-center gap-2 text-left cursor-pointer transition font-bold"
              >
                <span>🚫</span>
                <span>Remove from Room</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
