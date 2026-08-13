"use client";

import React, { useState, useEffect } from "react";

interface EditStudyProfileModalProps {
  isOpen: boolean;
  initialProfile: any;
  onClose: () => void;
  onProfileUpdated: () => void;
}

const AVATAR_PRESETS = [
  { id: "avatar-owl", emoji: "🦉", label: "Wise Owl", bg: "from-amber-600 to-yellow-500" },
  { id: "avatar-scholar", emoji: "📚", label: "Scholar", bg: "from-blue-600 to-indigo-500" },
  { id: "avatar-grad", emoji: "🧑‍🎓", label: "Graduate", bg: "from-emerald-600 to-teal-500" },
  { id: "avatar-brain", emoji: "🧠", label: "Strategist", bg: "from-purple-600 to-pink-500" },
  { id: "avatar-rocket", emoji: "🚀", label: "Topnotcher", bg: "from-rose-600 to-orange-500" },
  { id: "avatar-target", emoji: "🎯", label: "Goal Getter", bg: "from-cyan-600 to-blue-500" },
  { id: "avatar-fox", emoji: "🦊", label: "Quick Thinker", bg: "from-orange-600 to-amber-500" },
  { id: "avatar-star", emoji: "⭐", label: "Star Reviewer", bg: "from-yellow-600 to-amber-400" },
];

const AGE_RANGES = [
  "Prefer not to say",
  "Under 18",
  "18–20",
  "21–25",
  "26–30",
  "31–40",
  "41–50",
  "51+",
];

const GENDERS = [
  "Prefer not to say",
  "Male",
  "Female",
  "Non-binary",
  "Self-describe",
];

const EXAM_GOALS = [
  "Civil Service Exam — Professional Level",
  "Civil Service Exam — Sub-Professional Level",
  "General Civil Service Review",
  "First-time CSE Taker",
  "Retaker Aiming for Top 10",
];

const SUBJECT_OPTIONS = [
  "Numerical Reasoning",
  "Verbal Ability",
  "Analytical Reasoning",
  "General Information",
  "Philippine Constitution",
  "Reading Comprehension",
  "Grammar & Usage",
  "Vocabulary",
  "Logic & Analysis",
  "Word Problems",
  "Current Affairs",
];

const EXPERIENCE_LEVELS = [
  "Beginner (Just Starting Review)",
  "Intermediate (Practicing Daily)",
  "Advanced (Refining Weak Areas)",
  "Prefer not to say",
];

const STUDY_PREFERENCES = [
  "Practice questions",
  "Mock exams",
  "Flashcards",
  "Group discussion",
  "Quiet study",
  "Problem solving",
  "Teaching others",
  "Review sessions",
];

const AVAILABILITY_OPTIONS = [
  "Morning (6 AM – 12 PM)",
  "Afternoon (12 PM – 6 PM)",
  "Evening (6 PM – 10 PM)",
  "Late Night (10 PM – 2 AM)",
  "Weekends Only",
  "Flexible / Anytime",
];

const LANGUAGES = [
  "English",
  "Filipino",
  "Taglish",
  "Cebuano",
  "Bilingual",
];

export const EditStudyProfileModal: React.FC<EditStudyProfileModalProps> = ({
  isOpen,
  initialProfile,
  onClose,
  onProfileUpdated,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("avatar-scholar");
  const [ageRange, setAgeRange] = useState("Prefer not to say");
  const [gender, setGender] = useState("Prefer not to say");
  const [bio, setBio] = useState("");
  const [studyGoal, setStudyGoal] = useState(EXAM_GOALS[0]);
  const [studyInterests, setStudyInterests] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState(EXPERIENCE_LEVELS[1]);
  const [studyPreferences, setStudyPreferences] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [language, setLanguage] = useState("English");

  // Privacy & Visibility Toggles
  const [showAgeRange, setShowAgeRange] = useState(false);
  const [showGender, setShowGender] = useState(false);
  const [showBio, setShowBio] = useState(true);
  const [showStudyGoal, setShowStudyGoal] = useState(true);
  const [showInterests, setShowInterests] = useState(true);
  const [showPreferences, setShowPreferences] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialProfile) {
      setDisplayName(initialProfile.displayName || "");
      setAvatar(initialProfile.avatar || "avatar-scholar");
      setAgeRange(initialProfile.ageRange || "Prefer not to say");
      setGender(initialProfile.gender || "Prefer not to say");
      setBio(initialProfile.bio || "");
      setStudyGoal(initialProfile.studyGoal || EXAM_GOALS[0]);
      setStudyInterests(initialProfile.studyInterests || []);
      setExperienceLevel(initialProfile.experienceLevel || EXPERIENCE_LEVELS[1]);
      setStudyPreferences(initialProfile.studyPreferences || []);
      setAvailability(initialProfile.availability || []);
      setLanguage(initialProfile.language || "English");

      setShowAgeRange(initialProfile.showAgeRange ?? false);
      setShowGender(initialProfile.showGender ?? false);
      setShowBio(initialProfile.showBio ?? true);
      setShowStudyGoal(initialProfile.showStudyGoal ?? true);
      setShowInterests(initialProfile.showInterests ?? true);
      setShowPreferences(initialProfile.showPreferences ?? true);
      setShowAvailability(initialProfile.showAvailability ?? true);
      setShowActivity(initialProfile.showActivity ?? true);
    }
  }, [initialProfile, isOpen]);

  if (!isOpen) return null;

  const toggleArrayItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 30) {
      setErrorMsg("Display name must be between 3 and 30 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/social/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmed,
          avatar,
          ageRange,
          gender,
          bio: bio.trim(),
          studyGoal,
          studyInterests,
          experienceLevel,
          studyPreferences,
          availability,
          language,
          profileCompleted: true,
          showAgeRange,
          showGender,
          showBio,
          showStudyGoal,
          showInterests,
          showPreferences,
          showAvailability,
          showActivity,
        }),
      });

      if (res.ok) {
        onProfileUpdated();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update study profile.");
      }
    } catch (err) {
      console.error("Profile update error:", err);
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl my-8 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>✏️</span> Edit Study Together Profile & Identity
            </h3>
            <p className="text-xs text-slate-400">
              Customize how classmates recognize you and control your privacy preferences.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
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

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECTION 1: REQUIRED ACCOUNT INFO */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🏷️</span> Required Identity
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
                Required
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-300">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] text-slate-500">{displayName.length}/30</span>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                🔒 Shown in study rooms and group chats instead of your real name/email.
              </p>
            </div>
          </div>

          {/* SECTION 2: RECOMMENDED STUDY INFO */}
          <div className="space-y-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🎯</span> Recommended Study Profile
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                Recommended
              </span>
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Mascot Avatar</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATAR_PRESETS.map((a) => {
                  const isSelected = avatar === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatar(a.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer border ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 shadow-md scale-105"
                          : "bg-slate-900 border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <span className="text-xl block">{a.emoji}</span>
                      <span className="text-[8px] font-bold text-slate-300 truncate w-full text-center mt-0.5">
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-300">Short Introduction / Bio</label>
                <span className="text-[10px] text-slate-500">{bio.length}/160</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                placeholder="Share your exam review focus..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 h-16"
              />
            </div>

            {/* Target Goal & Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Target Exam Goal</label>
                <select
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {EXAM_GOALS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Focus Subjects */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Focus Subjects</label>
              <div className="flex flex-wrap gap-1.5">
                {SUBJECT_OPTIONS.map((subj) => {
                  const isSelected = studyInterests.includes(subj);
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => toggleArrayItem(studyInterests, setStudyInterests, subj)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}{subj}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3: OPTIONAL STUDY PREFERENCES */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>💡</span> Optional Study Preferences
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                Optional
              </span>
            </div>

            {/* Study Activities */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Preferred Study Activities</label>
              <div className="flex flex-wrap gap-1.5">
                {STUDY_PREFERENCES.map((pref) => {
                  const isSelected = studyPreferences.includes(pref);
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => toggleArrayItem(studyPreferences, setStudyPreferences, pref)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                        isSelected
                          ? "bg-purple-600 text-white border-purple-500"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}{pref}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Study Availability */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Preferred Schedule</label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABILITY_OPTIONS.map((time) => {
                  const isSelected = availability.includes(time);
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => toggleArrayItem(availability, setAvailability, time)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}{time}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Demographic and Language Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Age Range</label>
                <select
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {AGE_RANGES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: PRIVACY & VISIBILITY CONTROLS */}
          <div className="space-y-3 bg-slate-950/80 p-4 rounded-2xl border border-blue-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>🔒</span> Privacy & Visibility Controls
              </span>
              <span className="text-[10px] text-blue-400 font-bold">
                Choose what study partners see
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showBio}
                  onChange={(e) => setShowBio(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Bio on Study Card</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showInterests}
                  onChange={(e) => setShowInterests(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Focus Subjects</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showPreferences}
                  onChange={(e) => setShowPreferences(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Study Preferences</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showAvailability}
                  onChange={(e) => setShowAvailability(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Study Schedule</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showAgeRange}
                  onChange={(e) => setShowAgeRange(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Age Range (Hidden by default)</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={showGender}
                  onChange={(e) => setShowGender(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-slate-300 text-[11px]">Show Gender (Hidden by default)</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
