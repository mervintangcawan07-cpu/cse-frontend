"use client";

import React, { useState } from "react";

interface StudyTogetherOnboardingProps {
  initialDisplayName?: string;
  onComplete: () => void;
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

export default function StudyTogetherOnboarding({
  initialDisplayName = "",
  onComplete,
}: StudyTogetherOnboardingProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Profile Form States
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [avatar, setAvatar] = useState("avatar-scholar");
  const [ageRange, setAgeRange] = useState("Prefer not to say");
  const [gender, setGender] = useState("Prefer not to say");
  const [bio, setBio] = useState("");
  const [studyGoal, setStudyGoal] = useState(EXAM_GOALS[0]);
  const [studyInterests, setStudyInterests] = useState<string[]>([
    "Numerical Reasoning",
    "Verbal Ability",
  ]);
  const [experienceLevel, setExperienceLevel] = useState("Intermediate (Practicing Daily)");
  const [studyPreferences, setStudyPreferences] = useState<string[]>([
    "Practice questions",
    "Mock exams",
  ]);
  const [availability, setAvailability] = useState<string[]>(["Flexible / Anytime"]);
  const [language, setLanguage] = useState("English");

  // Multi-select toggle helper
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

  // Step 1 Validation
  const handleNextFromStep1 = () => {
    setErrorMsg("");
    const trimmed = displayName.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a display name for Study Together.");
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 30) {
      setErrorMsg("Display name must be between 3 and 30 characters.");
      return;
    }
    setStep(2);
  };

  // Submit and Complete Onboarding
  const handleSubmitProfile = async () => {
    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/social/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
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
        }),
      });

      if (res.ok) {
        onComplete();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to save profile. Please try again.");
      }
    } catch (err: any) {
      console.error("Profile save error:", err);
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const selectedAvatarObj = AVATAR_PRESETS.find((a) => a.id === avatar) || AVATAR_PRESETS[1];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        {/* HEADER */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            <span>✨</span> First-Time Setup
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Welcome to Study Together!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Create your Study Together profile so classmates can recognize you in study rooms, group chats, and collaborative drills.
          </p>
        </div>

        {/* PROGRESS BAR & STEP PILLS */}
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { num: 1, label: "Identity" },
              { num: 2, label: "About" },
              { num: 3, label: "Goals" },
              { num: 4, label: "Preferences" },
              { num: 5, label: "Ready" },
            ].map((s) => (
              <div
                key={s.num}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition ${
                  step === s.num
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : step > s.num
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-950 text-slate-500 border border-slate-800"
                }`}
              >
                {step > s.num ? "✓" : s.num}. {s.label}
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-blue-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* ERROR BANNER */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2 animate-shake">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ================= STEP 1: IDENTITY ================= */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Step 1: Your Study Identity</h3>
              <p className="text-xs text-slate-400">
                Choose the name and avatar that will represent you to fellow examinees.
              </p>
            </div>

            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Display Name <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {displayName.length}/30 chars
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g., Merv, Juan D., StudyBuddy26"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  🔒 Your private account email or real full name is never exposed.
                </p>
              </div>

              {/* Avatar Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Select Your Study Mascot / Avatar
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {AVATAR_PRESETS.map((a) => {
                    const isSelected = avatar === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAvatar(a.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl transition cursor-pointer border ${
                          isSelected
                            ? "bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20 scale-105"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <span className="text-2xl block mb-1">{a.emoji}</span>
                        <span className="text-[9px] font-bold text-slate-300 truncate w-full text-center">
                          {a.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                Continue to About You &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: ABOUT YOU (PRIVACY PRESERVING) ================= */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Step 2: About You</h3>
              <p className="text-xs text-slate-400">
                Optional demographic and personal details. Kept private and privacy-conscious.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Age Range */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Age Range (Optional)
                  </label>
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {AGE_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Exact birthdates are never collected.</p>
                </div>

                {/* Gender */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Gender (Optional)
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">Private by default.</p>
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Short Bio / Introduction (Optional)
                  </label>
                  <span className="text-[10px] text-slate-500">{bio.length}/160 chars</span>
                </div>
                <textarea
                  placeholder="Share a quick note with study partners (e.g., Target: March 2026 CSE. Focusing on Numerical & Analytical reasoning!)."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 h-20"
                />

                {/* Bio Quick Suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 font-bold self-center">Quick tags:</span>
                  {[
                    "Preparing for 2026 CSE.",
                    "Focusing on Numerical Reasoning.",
                    "Looking for daily study buddies!",
                    "Targeting Top 10 in Professional Level.",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBio((prev) => (prev ? `${prev} ${tag}` : tag).slice(0, 160))}
                      className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-slate-200 rounded-lg transition cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                Continue to Study Goals &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: STUDY GOALS ================= */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Step 3: Your Study Goals</h3>
              <p className="text-xs text-slate-400">
                Help match with examinees preparing for the same topics and exam categories.
              </p>
            </div>

            <div className="space-y-4">
              {/* Exam Goal */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Target Exam Objective
                </label>
                <select
                  value={studyGoal}
                  onChange={(e) => setStudyGoal(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {EXAM_GOALS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Study Subjects (Multi-select) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Focus Subjects / Review Interests (Choose all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((subj) => {
                    const isSelected = studyInterests.includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleArrayItem(studyInterests, setStudyInterests, subj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {subj}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Current Review Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                Continue to Preferences &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: STUDY PREFERENCES ================= */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-1 border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Step 4: Study Preferences</h3>
              <p className="text-xs text-slate-400">
                Let others know your preferred study format, time slots, and language.
              </p>
            </div>

            <div className="space-y-4">
              {/* Preferred Study Activities */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Preferred Study Activities
                </label>
                <div className="flex flex-wrap gap-2">
                  {STUDY_PREFERENCES.map((pref) => {
                    const isSelected = studyPreferences.includes(pref);
                    return (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => toggleArrayItem(studyPreferences, setStudyPreferences, pref)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          isSelected
                            ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {pref}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Study Availability */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Preferred Study Time & Schedule
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABILITY_OPTIONS.map((time) => {
                    const isSelected = availability.includes(time);
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => toggleArrayItem(availability, setAvailability, time)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {isSelected ? "✓ " : "+ "}
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Preference */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Language Preference
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                Preview Profile &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 5: PREVIEW & CONFIRMATION ================= */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-1 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white">🎉 You're Ready to Study Together!</h3>
              <p className="text-xs text-slate-400">
                Here is how your study card will look to other examinees across rooms, clubs, and group chats:
              </p>
            </div>

            {/* LIVE PROFILE CARD PREVIEW */}
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-blue-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-w-md mx-auto relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-blue-600/30 text-blue-400 border-b border-l border-blue-500/30 text-[10px] font-black rounded-bl-2xl">
                STUDY TOGETHER
              </div>

              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${selectedAvatarObj.bg} flex items-center justify-center text-3xl shadow-lg shrink-0`}>
                  {selectedAvatarObj.emoji}
                </div>
                <div>
                  <h4 className="text-base font-black text-white">{displayName || "Examinee"}</h4>
                  <p className="text-[11px] font-bold text-blue-400">{studyGoal}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-0.5">
                    ● Active Study Partner
                  </span>
                </div>
              </div>

              {bio && (
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-300 italic leading-relaxed">
                  "{bio}"
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Focus Subjects
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {studyInterests.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-lg"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] text-slate-400 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500 block">Level:</span>
                  <span className="font-semibold text-slate-300">{experienceLevel.split(" (")[0]}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Language:</span>
                  <span className="font-semibold text-slate-300">{language}</span>
                </div>
              </div>
            </div>

            {/* Navigation / Action */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={saving}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                &larr; Edit Details
              </button>

              <button
                type="button"
                onClick={handleSubmitProfile}
                disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-xl shadow-blue-600/30 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <span>🚀 Enter Study Together Hub</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
