// Relative Path: src/components/social/StudyClubsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { DeleteClubModal } from "@/components/social/DeleteClubModal";

export default function StudyClubsSection() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clubToDelete, setClubToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingClub, setDeletingClub] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Professional Level");
  const [creating, setCreating] = useState(false);

  const categories = [
    "Professional Level",
    "Sub-Professional Level",
    "Math & Numerical Squad",
    "Philippine Constitution Club",
    "Grammar & Verbal Excellence",
    "Weekend Intensive Reviewers",
  ];

  const fetchClubs = async () => {
    try {
      const res = await fetch(`/api/social/clubs?filter=${filter}&query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setClubs(data.clubs || []);
      }
    } catch (err) {
      console.error("Failed to fetch clubs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClubs();
  };

  const toggleMembership = async (clubId: string, isMember: boolean) => {
    try {
      const res = await fetch("/api/social/clubs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId, action: isMember ? "LEAVE" : "JOIN" }),
      });
      if (res.ok) {
        await fetchClubs();
      }
    } catch (err) {
      console.error("Failed to toggle club membership:", err);
    }
  };

  const confirmDeleteClub = async () => {
    if (!clubToDelete?.id || deletingClub) return;

    setDeletingClub(true);
    try {
      const res = await fetch(`/api/social/clubs/${clubToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setClubToDelete(null);
        await fetchClubs();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete study club");
      }
    } catch (err) {
      console.error("Failed to delete club:", err);
    } finally {
      setDeletingClub(false);
    }
  };

  const createClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/social/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, category }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        setDescription("");
        await fetchClubs();
      }
    } catch (err) {
      console.error("Failed to create club:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white">Study Communities & Clubs</h3>
          <p className="text-xs text-slate-400">Join specialized examinee clubs based on exam level, subject, or study schedule.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Search
            </button>
          </form>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
          >
            + Create Club
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "all" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Public Clubs
        </button>
        <button
          onClick={() => setFilter("mine")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "mine" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          My Joined Clubs
        </button>
      </div>

      {/* CLUBS DIRECTORY GRID */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
          Loading study clubs...
        </div>
      ) : clubs.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl block">🏛️</span>
          <h4 className="text-sm font-bold text-white">No Study Clubs Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Create a community club to gather examinees targeting the same civil service exam category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clubs.map((club) => (
            <div key={club.id} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 hover:border-slate-700 transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                    {club.category}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    👥 {club.memberCount} Members
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white truncate">{club.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                    {club.description || "Dedicated study community sharing tips and exam strategies."}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-semibold truncate">
                  Founder: {club.owner?.name || "Examinee"}
                </span>

                {club.isOwner ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-extrabold text-amber-400 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      👑 Owner
                    </span>
                    <button
                      onClick={() => setClubToDelete({ id: club.id, name: club.name })}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition cursor-pointer text-xs"
                      title="Delete Study Club"
                    >
                      🗑️
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleMembership(club.id, club.isMember)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                      club.isMember
                        ? "bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-700 text-slate-300"
                        : "bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-md"
                    }`}
                  >
                    {club.isMember ? "Leave Club" : "Join Club"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE CLUB MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create Study Club</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={createClub} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Club Name *</label>
                <input
                  type="text"
                  placeholder="e.g., 2026 Civil Service Topnotchers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Club Objective & Description</label>
                <textarea
                  placeholder="What is the goal of this study club?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 h-24"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Launch Club"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CLUB CONFIRMATION MODAL */}
      <DeleteClubModal
        isOpen={!!clubToDelete}
        clubName={clubToDelete?.name || ""}
        isDeleting={deletingClub}
        onConfirm={confirmDeleteClub}
        onCancel={() => setClubToDelete(null)}
      />
    </div>
  );
}