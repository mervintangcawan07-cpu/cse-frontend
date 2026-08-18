"use client";

import React, { useEffect, useState } from "react";
import { PresenceBadge } from "@/components/social/presence/PresenceBadge";

interface PublicProfileCardModalProps {
  userId: string | null;
  onClose: () => void;
  onSendMessage?: (userId: string) => void;
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

export const PublicProfileCardModal: React.FC<PublicProfileCardModalProps> = ({
  userId,
  onClose,
  onSendMessage,
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/social/profile/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
        }
      })
      .catch((err) => console.error("Failed to load public profile:", err))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  const avatarInfo = profile?.avatar && AVATAR_MAP[profile.avatar]
    ? AVATAR_MAP[profile.avatar]
    : { emoji: "🧑‍🎓", bg: "from-blue-600 to-indigo-500" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          ✕
        </button>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold animate-pulse space-y-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p>Loading study profile...</p>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* Identity Header */}
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarInfo.bg} flex items-center justify-center text-2xl shadow-sm text-white`}>
                  {avatarInfo.emoji}
                </div>
                {profile.presence && (
                  <span className="absolute -bottom-1 -right-1 border-2 border-white rounded-full">
                    <PresenceBadge presence={profile.presence} variant="dot-only" size="md" />
                  </span>
                )}
              </div>
              <div className="overflow-hidden space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900 truncate">
                    {profile.displayName}
                  </h3>
                  {profile.isPro && (
                    <span className="px-1.5 py-0.2 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black rounded">
                      PRO
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-blue-700 truncate">
                  {profile.studyGoal || "Civil Service Exam Review"}
                </p>
                <div className="pt-0.5">
                  <PresenceBadge presence={profile.presence} variant="full" size="sm" />
                </div>
              </div>
            </div>

            {/* Bio (Respects Privacy) */}
            {profile.bio && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 italic leading-relaxed">
                "{profile.bio}"
              </div>
            )}

            {/* Focus Subjects (Respects Privacy) */}
            {profile.studyInterests && profile.studyInterests.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Focus Topics
                </span>
                <div className="flex flex-wrap gap-1">
                  {profile.studyInterests.map((interest: string) => (
                    <span
                      key={interest}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-lg"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Availability (Respects Privacy) */}
            {profile.availability && profile.availability.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Study Schedule
                </span>
                <div className="flex flex-wrap gap-1">
                  {profile.availability.map((time: string) => (
                    <span
                      key={time}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Demographics (Respects Privacy) */}
            {(profile.ageRange || profile.gender) && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                {profile.ageRange && <span>Age: {profile.ageRange}</span>}
                {profile.ageRange && profile.gender && <span>•</span>}
                {profile.gender && <span>{profile.gender}</span>}
              </div>
            )}

            {/* General Meta */}
            <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-slate-100 text-slate-500">
              <div>
                <span className="text-slate-400 block">Level:</span>
                <span className="font-semibold text-slate-700">
                  {profile.experienceLevel?.split(" (")[0] || "Examinee"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Language:</span>
                <span className="font-semibold text-slate-700">
                  {profile.language || "English"}
                </span>
              </div>
            </div>

            {onSendMessage && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onSendMessage(userId);
                    onClose();
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                >
                  💬 Send Direct Message
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            Study profile not found.
          </div>
        )}
      </div>
    </div>
  );
};
