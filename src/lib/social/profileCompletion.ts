// Relative Path: src/lib/social/profileCompletion.ts

export interface ProfileItemCheck {
  id: string;
  label: string;
  category: "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
  weight: number; // Percentage contribution towards 100%
  isCompleted: boolean;
  hint: string;
  icon: string;
}

export interface ProfileCompletionResult {
  percentage: number;
  isFullyComplete: boolean;
  statusLabel: string;
  statusColor: string;
  completedItems: ProfileItemCheck[];
  missingRecommended: ProfileItemCheck[];
  missingOptional: ProfileItemCheck[];
  totalScore: number;
}

export function calculateProfileCompletion(profile: any): ProfileCompletionResult {
  if (!profile) {
    return {
      percentage: 0,
      isFullyComplete: false,
      statusLabel: "Not Started",
      statusColor: "text-slate-500",
      completedItems: [],
      missingRecommended: [
        { id: "displayName", label: "Display Name", category: "REQUIRED", weight: 20, isCompleted: false, hint: "Set a unique study nickname", icon: "🏷️" },
        { id: "avatar", label: "Mascot Avatar", category: "RECOMMENDED", weight: 15, isCompleted: false, hint: "Choose a study mascot icon", icon: "🦉" },
        { id: "studyGoal", label: "Study Goal", category: "RECOMMENDED", weight: 15, isCompleted: false, hint: "Select your target exam level", icon: "🎯" },
        { id: "studyInterests", label: "Focus Subjects", category: "RECOMMENDED", weight: 15, isCompleted: false, hint: "Pick at least one subject of focus", icon: "📚" },
        { id: "bio", label: "Short Bio", category: "RECOMMENDED", weight: 15, isCompleted: false, hint: "Write a brief note to study buddies", icon: "✍️" },
        { id: "studyPreferences", label: "Study Activities", category: "OPTIONAL", weight: 10, isCompleted: false, hint: "Add preferred study formats", icon: "💡" },
        { id: "availability", label: "Preferred Schedule", category: "OPTIONAL", weight: 10, isCompleted: false, hint: "Indicate when you study best", icon: "⏰" },
      ],
      missingOptional: [],
      totalScore: 0,
    };
  }

  const hasDisplayName = Boolean(profile.displayName && String(profile.displayName).trim().length >= 3);
  const hasAvatar = Boolean(profile.avatar && String(profile.avatar).trim().length > 0);
  const hasStudyGoal = Boolean(profile.studyGoal && String(profile.studyGoal).trim().length > 0);
  const hasInterests = Boolean(Array.isArray(profile.studyInterests) && profile.studyInterests.length > 0);
  const hasBio = Boolean(profile.bio && String(profile.bio).trim().length > 0);
  const hasPreferences = Boolean(Array.isArray(profile.studyPreferences) && profile.studyPreferences.length > 0);
  const hasAvailability = Boolean(Array.isArray(profile.availability) && profile.availability.length > 0);

  const allItems: ProfileItemCheck[] = [
    {
      id: "displayName",
      label: "Display Name",
      category: "REQUIRED",
      weight: 20,
      isCompleted: hasDisplayName,
      hint: "Your public study nickname",
      icon: "🏷️",
    },
    {
      id: "avatar",
      label: "Mascot Avatar",
      category: "RECOMMENDED",
      weight: 15,
      isCompleted: hasAvatar,
      hint: "Helps study partners identify you",
      icon: "🦉",
    },
    {
      id: "studyGoal",
      label: "Target Exam Goal",
      category: "RECOMMENDED",
      weight: 15,
      isCompleted: hasStudyGoal,
      hint: "Target CSE level (Prof / Sub-Prof)",
      icon: "🎯",
    },
    {
      id: "studyInterests",
      label: "Focus Subjects",
      category: "RECOMMENDED",
      weight: 15,
      isCompleted: hasInterests,
      hint: "Select your priority review topics",
      icon: "📚",
    },
    {
      id: "bio",
      label: "Study Introduction / Bio",
      category: "RECOMMENDED",
      weight: 15,
      isCompleted: hasBio,
      hint: "A brief message to classmates",
      icon: "✍️",
    },
    {
      id: "studyPreferences",
      label: "Study Activity Preferences",
      category: "OPTIONAL",
      weight: 10,
      isCompleted: hasPreferences,
      hint: "Drills, flashcards, or mock exams",
      icon: "💡",
    },
    {
      id: "availability",
      label: "Study Schedule Availability",
      category: "OPTIONAL",
      weight: 10,
      isCompleted: hasAvailability,
      hint: "Morning, evening, or weekend sessions",
      icon: "⏰",
    },
  ];

  const totalScore = allItems.reduce((acc, item) => acc + (item.isCompleted ? item.weight : 0), 0);
  const percentage = Math.min(100, Math.max(0, totalScore));

  const completedItems = allItems.filter((i) => i.isCompleted);
  const missingRecommended = allItems.filter((i) => !i.isCompleted && (i.category === "REQUIRED" || i.category === "RECOMMENDED"));
  const missingOptional = allItems.filter((i) => !i.isCompleted && i.category === "OPTIONAL");

  let statusLabel = "Getting Started";
  let statusColor = "text-amber-400";

  if (percentage === 100) {
    statusLabel = "Complete Study Identity";
    statusColor = "text-emerald-400";
  } else if (percentage >= 80) {
    statusLabel = "Almost Complete";
    statusColor = "text-blue-400";
  } else if (percentage >= 50) {
    statusLabel = "Good Progress";
    statusColor = "text-indigo-400";
  }

  return {
    percentage,
    isFullyComplete: percentage === 100,
    statusLabel,
    statusColor,
    completedItems,
    missingRecommended,
    missingOptional,
    totalScore,
  };
}
