// Relative Path: src/components/social/OwnerLeaveClubModal.tsx
"use client";

import React, { useState, useEffect } from "react";

interface MemberItem {
  id: string;
  userId: string;
  role: string;
  name: string;
  displayName: string;
  avatar?: string | null;
}

interface OwnerLeaveClubModalProps {
  isOpen: boolean;
  clubId: string;
  clubName: string;
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteClubRequest: () => void;
}

const AVATAR_MAP: Record<string, { emoji: string; bg: string }> = {
  "avatar-owl": { emoji: "🦉", bg: "from-amber-600 to-yellow-500" },
  "avatar-scholar": { emoji: "📚", bg: "from-blue-600 to-indigo-500" },
  "avatar-grad": { emoji: "🧑‍🎓", bg: "from-emerald-600 to-teal-500" },
  "avatar-brain": { emoji: "🧠", bg: "from-purple-600 to-pink-500" },
  "avatar-rocket": { emoji: "🚀", bg: "from-rose-600 to-orange-500" },
  "avatar-target": { emoji: "🎯", bg: "from-cyan-600 to-blue-500" },
  "avatar-fox": { emoji: "🦊", bg: "from-orange-600 to-amber-500" },
  "avatar-star": { emoji: "⭐", bg: "from-yellow-600 to-amber-400" },
};

export const OwnerLeaveClubModal: React.FC<OwnerLeaveClubModalProps> = ({
  isOpen,
  clubId,
  clubName,
  currentUserId,
  onClose,
  onSuccess,
  onDeleteClubRequest,
}) => {
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [eligibleMembers, setEligibleMembers] = useState<MemberItem[]>([]);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !clubId) return;

    setLoadingMembers(true);
    setErrorMsg("");
    setSelectedNewOwnerId("");

    fetch(`/api/social/clubs/${clubId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.club?.members) {
          const others = data.club.members.filter(
            (m: MemberItem) => m.userId !== currentUserId
          );
          setEligibleMembers(others);
          if (others.length > 0) {
            setSelectedNewOwnerId(others[0].userId);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load club members:", err);
        setErrorMsg("Failed to load club members.");
      })
      .finally(() => setLoadingMembers(false));
  }, [isOpen, clubId, currentUserId]);

  if (!isOpen) return null;

  const handleTransferAndLeave = async () => {
    if (!selectedNewOwnerId) {
      setErrorMsg("Please select a member to transfer ownership to.");
      return;
    }

    setTransferring(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/social/clubs/${clubId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newOwnerId: selectedNewOwnerId,
          andLeave: true,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to transfer ownership.");
      }
    } catch (err) {
      console.error("Transfer ownership error:", err);
      setErrorMsg("Network error. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  const renderAvatar = (avatarKey?: string | null, name?: string) => {
    if (avatarKey && AVATAR_MAP[avatarKey]) {
      return (
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${AVATAR_MAP[avatarKey].bg} flex items-center justify-center text-sm shadow-sm shrink-0`}>
          {AVATAR_MAP[avatarKey].emoji}
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs uppercase shrink-0">
        {(name || "U")[0]}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-base">
              👑
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                Leave Study Club: {clubName}
              </h3>
              <p className="text-[11px] text-slate-400">
                You are the Founder & Owner of this club community.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {loadingMembers ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold animate-pulse space-y-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading member roster...</p>
          </div>
        ) : eligibleMembers.length === 0 ? (
          /* Case 1: Owner is the sole member */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span> Sole Member Notice
              </p>
              <p className="text-amber-400/90 leading-relaxed text-[11px]">
                You are currently the only member in <strong>"{clubName}"</strong>. Because there are no other members to take over ownership, leaving the club will permanently disband and delete it.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteClubRequest();
                }}
                className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                Disband & Delete Club
              </button>
            </div>
          </div>
        ) : (
          /* Case 2: Other members exist -> Option to transfer ownership & leave, or delete club */
          <div className="space-y-5">
            <p className="text-xs text-slate-300 leading-relaxed">
              To leave <strong>"{clubName}"</strong>, please choose an option below. Owners cannot leave without designating a new owner or disbanding the club.
            </p>

            {/* Option A: Transfer & Leave */}
            <div className="p-4 bg-slate-950/70 border border-blue-500/30 rounded-2xl space-y-3 shadow-lg shadow-blue-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>🔄</span> Option 1: Transfer Ownership & Leave
                </span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Select an active member who will take over leadership and administrative control of the club:
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {eligibleMembers.map((m) => {
                  const isSelected = selectedNewOwnerId === m.userId;
                  return (
                    <div
                      key={m.userId}
                      onClick={() => setSelectedNewOwnerId(m.userId)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 text-white shadow-md"
                          : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {renderAvatar(m.avatar, m.displayName || m.name)}
                        <span className="text-xs font-bold truncate">
                          {m.displayName || m.name}
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        isSelected
                          ? "bg-blue-500 text-white border-blue-400"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}>
                        {isSelected ? "✓ New Owner" : "Select"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={transferring || !selectedNewOwnerId}
                onClick={handleTransferAndLeave}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transferring ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Transferring & Leaving...</span>
                  </>
                ) : (
                  "Transfer Ownership & Leave Club"
                )}
              </button>
            </div>

            {/* Option B: Delete Club */}
            <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-300 block">
                  Option 2: Disband Study Club
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Permanently delete this club for all {eligibleMembers.length + 1} members.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteClubRequest();
                }}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
              >
                Delete Club
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
