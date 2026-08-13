// Relative Path: src/components/social/ClassmatesSection.tsx
"use client";

import { useEffect, useState } from "react";
import { PublicProfileCardModal } from "@/components/social/profile/PublicProfileCardModal";
import { PresenceBadge } from "@/components/social/presence/PresenceBadge";

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

export default function ClassmatesSection() {
  const [loading, setLoading] = useState(true);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<any[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchClassmateData = async () => {
    try {
      const res = await fetch("/api/social/classmates");
      if (res.ok) {
        const data = await res.json();
        setClassmates(data.classmates || []);
        setPendingIncoming(data.pendingIncoming || []);
        setPendingOutgoing(data.pendingOutgoing || []);
        setSuggested(data.suggested || []);
      }
    } catch (err) {
      console.error("Failed to load classmate data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassmateData();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/social/classmates?type=search&query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      const res = await fetch("/api/social/classmates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        await fetchClassmateData();
        if (searchQuery.trim()) handleSearch();
      }
    } catch (err) {
      console.error("Failed to send request:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const respondRelation = async (relationId: string, action: "ACCEPT" | "REJECT" | "CANCEL" | "REMOVE" | "BLOCK") => {
    setActionLoadingId(relationId);
    try {
      const res = await fetch("/api/social/classmates/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationId, action }),
      });
      if (res.ok) {
        await fetchClassmateData();
        if (searchQuery.trim()) handleSearch();
      }
    } catch (err) {
      console.error("Failed to respond to relation:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderAvatar = (userObj: any) => {
    const avatarKey = userObj?.studyProfile?.avatar;
    const presence = userObj?.presence;

    return (
      <div className="relative shrink-0">
        {avatarKey && AVATAR_MAP[avatarKey] ? (
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${AVATAR_MAP[avatarKey].bg} flex items-center justify-center text-lg shadow-sm`}>
            {AVATAR_MAP[avatarKey].emoji}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-black text-blue-400 text-xs uppercase">
            {(userObj?.studyProfile?.displayName || userObj?.name || "U")[0]}
          </div>
        )}

        {/* Presence Dot Overlay */}
        {presence && (
          <span className="absolute -bottom-0.5 -right-0.5 border-2 border-slate-900 rounded-full">
            <PresenceBadge presence={presence} variant="dot-only" size="sm" />
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
        Loading classmates directory...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white">Find Classmates & Study Buddies</h3>
          <p className="text-xs text-slate-400">Search for examinees preparing for the same Civil Service Exam.</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by name or study handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {/* SEARCH RESULTS AREA */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Search Results ({searchResults.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((user) => {
              const displayName = user.studyProfile?.displayName || user.name || "Examinee";
              return (
                <div key={user.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div
                    onClick={() => setSelectedUserId(user.id)}
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  >
                    {renderAvatar(user)}
                    <div className="overflow-hidden flex-1 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate hover:text-blue-400 transition">{displayName}</p>
                      <PresenceBadge presence={user.presence} variant="pill" size="sm" />
                    </div>
                  </div>

                  <div>
                    {user.relationStatus === "ACCEPTED" ? (
                      <span className="text-[10px] font-bold text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">Classmate</span>
                    ) : user.relationStatus === "PENDING" ? (
                      <span className="text-[10px] font-bold text-amber-400 px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        {user.isSender ? "Sent" : "Pending"}
                      </span>
                    ) : (
                      <button
                        onClick={() => sendRequest(user.id)}
                        disabled={actionLoadingId === user.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PENDING REQUESTS SECTION */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <span>📩 Pending Invitations</span>
            <span className="px-2 py-0.5 bg-amber-500/20 rounded-full text-[10px] font-black">{pendingIncoming.length}</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingIncoming.map((req) => {
              const displayName = req.sender?.studyProfile?.displayName || req.sender?.name || "Examinee";
              return (
                <div key={req.relationId} className="bg-slate-900 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                  <div
                    onClick={() => setSelectedUserId(req.sender.id)}
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  >
                    {renderAvatar(req.sender)}
                    <div className="overflow-hidden flex-1 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate hover:text-blue-400 transition">{displayName}</p>
                      <PresenceBadge presence={req.sender?.presence} variant="pill" size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => respondRelation(req.relationId, "ACCEPT")}
                      disabled={actionLoadingId === req.relationId}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondRelation(req.relationId, "REJECT")}
                      disabled={actionLoadingId === req.relationId}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY CONNECTED CLASSMATES */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          My Classmates ({classmates.length})
        </h4>

        {classmates.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
            <span className="text-4xl block">🧑‍🎓</span>
            <h4 className="text-sm font-bold text-white">No Connected Classmates Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Connect with examinees below or search for partners preparing for the Civil Service Exam.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classmates.map((c) => {
              const displayName = c.user?.studyProfile?.displayName || c.user?.name || "Classmate";
              return (
                <div key={c.relationId} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div
                    onClick={() => setSelectedUserId(c.user.id)}
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  >
                    {renderAvatar(c.user)}
                    <div className="overflow-hidden flex-1 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate hover:text-blue-400 transition">{displayName}</p>
                      <PresenceBadge presence={c.user?.presence} variant="pill" size="sm" />
                    </div>
                  </div>

                  <button
                    onClick={() => respondRelation(c.relationId, "REMOVE")}
                    disabled={actionLoadingId === c.relationId}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-800 text-slate-400 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SUGGESTED CLASSMATES CAROUSEL / GRID */}
      {suggested.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>✨ Suggested Active Examinees</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggested.map((s) => {
              const displayName = s.studyProfile?.displayName || s.name || "Examinee";
              return (
                <div key={s.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition">
                  <div
                    onClick={() => setSelectedUserId(s.id)}
                    className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  >
                    {renderAvatar(s)}
                    <div className="overflow-hidden flex-1 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate hover:text-blue-400 transition">{displayName}</p>
                      <PresenceBadge presence={s.presence} variant="pill" size="sm" />
                    </div>
                  </div>

                  <button
                    onClick={() => sendRequest(s.id)}
                    disabled={actionLoadingId === s.id}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PUBLIC PROFILE CARD MODAL */}
      <PublicProfileCardModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}