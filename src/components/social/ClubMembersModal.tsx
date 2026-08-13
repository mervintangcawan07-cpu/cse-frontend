// Relative Path: src/components/social/ClubMembersModal.tsx
"use client";

import React, { useState, useEffect } from "react";

interface MemberItem {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | string;
  name: string;
  displayName: string;
  avatar?: string | null;
  joinedAt: string;
}

interface ClubMembersModalProps {
  isOpen: boolean;
  clubId: string;
  clubName: string;
  currentUserId: string;
  onClose: () => void;
  onRosterUpdated?: () => void;
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

export const ClubMembersModal: React.FC<ClubMembersModalProps> = ({
  isOpen,
  clubId,
  clubName,
  currentUserId,
  onClose,
  onRosterUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("MEMBER");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/social/clubs/${clubId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        if (data.currentUserRole) setCurrentUserRole(data.currentUserRole);
      } else {
        setErrorMsg("Failed to load club members.");
      }
    } catch (err) {
      console.error("Failed to load members:", err);
      setErrorMsg("Failed to load club members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !clubId) return;
    setLoading(true);
    setErrorMsg("");
    fetchMembers();
  }, [isOpen, clubId]);

  if (!isOpen) return null;

  const isOwner = currentUserRole === "OWNER";
  const isModerator = currentUserRole === "ADMIN";
  const canModerate = isOwner || isModerator;

  const handleRoleChange = async (targetUserId: string, newRole: "ADMIN" | "MEMBER") => {
    setActionLoadingId(targetUserId);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/social/clubs/${clubId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, role: newRole }),
      });

      if (res.ok) {
        await fetchMembers();
        if (onRosterUpdated) onRosterUpdated();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update member role.");
      }
    } catch (err) {
      console.error("Role update error:", err);
      setErrorMsg("Network error updating role.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from "${clubName}"?`)) {
      return;
    }

    setActionLoadingId(targetUserId);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/social/clubs/${clubId}/members?targetUserId=${targetUserId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchMembers();
        if (onRosterUpdated) onRosterUpdated();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to remove member.");
      }
    } catch (err) {
      console.error("Remove member error:", err);
      setErrorMsg("Network error removing member.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderAvatar = (avatarKey?: string | null, name?: string) => {
    if (avatarKey && AVATAR_MAP[avatarKey]) {
      return (
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_MAP[avatarKey].bg} flex items-center justify-center text-base shadow-sm shrink-0`}>
          {AVATAR_MAP[avatarKey].emoji}
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-black text-blue-400 text-xs uppercase shrink-0">
        {(name || "U")[0]}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-base">
              🏛️
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {clubName} Roster
              </h3>
              <p className="text-[11px] text-slate-400">
                {members.length} {members.length === 1 ? "Examinee Member" : "Examinee Members"}
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
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2 shrink-0">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Member List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold animate-pulse space-y-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Loading club members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No members found in this club.
            </div>
          ) : (
            members.map((m) => {
              const isTargetOwner = m.role === "OWNER";
              const isTargetAdmin = m.role === "ADMIN";
              const isSelf = m.userId === currentUserId;
              const isActingOnThis = actionLoadingId === m.userId;

              // Determine if caller can remove this member
              let canRemoveTarget = false;
              if (canModerate && !isSelf && !isTargetOwner) {
                if (isOwner) {
                  canRemoveTarget = true; // Owner can remove any non-owner
                } else if (isModerator && !isTargetAdmin) {
                  canRemoveTarget = true; // Moderator can remove regular members only
                }
              }

              return (
                <div
                  key={m.id}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {renderAvatar(m.avatar, m.displayName || m.name)}
                    <div className="overflow-hidden space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white truncate">
                          {m.displayName || m.name}
                        </p>
                        {isSelf && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        {isTargetOwner ? (
                          <span className="font-extrabold text-amber-300 flex items-center gap-1">
                            <span>👑</span> Owner
                          </span>
                        ) : isTargetAdmin ? (
                          <span className="font-extrabold text-indigo-300 flex items-center gap-1">
                            <span>🛡️</span> Moderator
                          </span>
                        ) : (
                          <span className="text-slate-400">🧑‍🎓 Member</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Owner & Moderator Controls) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Owner can promote / demote moderators */}
                    {isOwner && !isSelf && !isTargetOwner && (
                      <>
                        {isTargetAdmin ? (
                          <button
                            type="button"
                            disabled={isActingOnThis}
                            onClick={() => handleRoleChange(m.userId, "MEMBER")}
                            className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
                            title="Demote to Regular Member"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isActingOnThis}
                            onClick={() => handleRoleChange(m.userId, "ADMIN")}
                            className="px-2 py-1 text-[10px] font-bold text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition cursor-pointer disabled:opacity-50"
                            title="Promote to Club Moderator"
                          >
                            + Mod
                          </button>
                        )}
                      </>
                    )}

                    {/* Authorized removal button */}
                    {canRemoveTarget && (
                      <button
                        type="button"
                        disabled={isActingOnThis}
                        onClick={() => handleRemoveMember(m.userId, m.displayName || m.name)}
                        className="px-2.5 py-1 text-[10px] font-black text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        title="Remove member from club"
                      >
                        {isActingOnThis ? "..." : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-400 shrink-0">
          <span>
            {isOwner
              ? "👑 You have full club management authority."
              : isModerator
              ? "🛡️ You can moderate and remove regular members."
              : "🧑‍🎓 Viewing club members roster."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
