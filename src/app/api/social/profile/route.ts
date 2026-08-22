// Relative Path: src/app/api/social/profile/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateProfileCompletion } from "@/lib/social/profileCompletion";
import { resolveUserPresence } from "@/lib/social/presence";

// Whitelists for privacy and data integrity
const ALLOWED_AGE_RANGES = [
  "Under 18",
  "18–20",
  "21–25",
  "26–30",
  "31–40",
  "41–50",
  "51+",
  "Prefer not to say",
];

const ALLOWED_GENDERS = [
  "Male",
  "Female",
  "Non-binary",
  "Self-describe",
  "Prefer not to say",
];

const ALLOWED_EXPERIENCE_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Prefer not to say",
];

const ALLOWED_LANGUAGES = [
  "English",
  "Filipino",
  "Taglish",
  "Cebuano",
  "Ilocano",
  "Bilingual",
  "Other",
];

const ALLOWED_SUBJECTS = [
  "Verbal Ability",
  "Numerical Reasoning",
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

const ALLOWED_PREFERENCES = [
  "Quiet study",
  "Group discussion",
  "Practice questions",
  "Mock exams",
  "Flashcards",
  "Problem solving",
  "Teaching others",
  "Review sessions",
];

const ALLOWED_AVAILABILITY = [
  "Morning",
  "Afternoon",
  "Evening",
  "Late Night",
  "Weekends",
  "Flexible",
];

const ALLOWED_PRESENCE_STATUSES = ["ONLINE", "AWAY", "BUSY", "OFFLINE"];

function sanitizeString(str: string): string {
  return str
    .replace(/<[^>]*>?/gm, "") // Remove HTML tags
    .trim();
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const profile = await prisma.studyTogetherProfile.findUnique({
      where: { userId },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, isPaid: true, lastActiveAt: true },
    });

    const completionData = calculateProfileCompletion(profile);
    const presence = resolveUserPresence(user?.lastActiveAt, profile);

    return NextResponse.json({
      success: true,
      profile: profile || null,
      profileCompleted: profile?.profileCompleted || false,
      userDefaultName: user?.name || "Examinee",
      completion: completionData,
      presence,
    });
  } catch (error: any) {
    console.error("[STUDY_PROFILE_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch study profile", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const rawUserId = session?.userId || session?.id;
    if (!rawUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = String(rawUserId);

    const body = await request.json();
    const {
      profileCompleted = true,
      // Privacy & Visibility Toggles
      showAgeRange = false,
      showGender = false,
      showBio = true,
      showStudyGoal = true,
      showInterests = true,
      showPreferences = true,
      showAvailability = true,
      showActivity = true,
    } = body;

    let {
      displayName,
      avatar,
      ageRange,
      gender,
      bio,
      studyGoal,
      studyInterests,
      experienceLevel,
      studyPreferences,
      availability,
      language,
      // Presence Settings
      presenceStatus = "ONLINE",
      customStatusText = null,
      customStatusEmoji = null,
    } = body;

    // 1. Validate Display Name (Required: 3–30 characters)
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "Display name is required." },
        { status: 400 }
      );
    }

    displayName = sanitizeString(displayName);
    if (displayName.length < 3 || displayName.length > 30) {
      return NextResponse.json(
        { error: "Display name must be between 3 and 30 characters long." },
        { status: 400 }
      );
    }

    // Check for excessive repetitive characters (e.g. "aaaaaa...")
    if (/([a-zA-Z0-9])\1{5,}/.test(displayName)) {
      return NextResponse.json(
        { error: "Display name contains excessive repeated characters." },
        { status: 400 }
      );
    }

    // 2. Validate Bio (Optional: Max 160 characters)
    if (bio && typeof bio === "string") {
      bio = sanitizeString(bio).slice(0, 160);
    } else {
      bio = null;
    }

    // 3. Validate Age Range
    if (ageRange && !ALLOWED_AGE_RANGES.includes(ageRange)) {
      ageRange = "Prefer not to say";
    }

    // 4. Validate Gender
    if (gender && !ALLOWED_GENDERS.includes(gender)) {
      gender = "Prefer not to say";
    }

    // 5. Validate Experience Level
    if (experienceLevel && !ALLOWED_EXPERIENCE_LEVELS.includes(experienceLevel)) {
      experienceLevel = "Beginner";
    }

    // 6. Validate Study Goal
    if (studyGoal && typeof studyGoal === "string") {
      studyGoal = sanitizeString(studyGoal).slice(0, 80);
    }

    // 7. Validate Array Fields
    if (Array.isArray(studyInterests)) {
      studyInterests = studyInterests
        .map((s: string) => sanitizeString(String(s)))
        .filter((s: string) => ALLOWED_SUBJECTS.includes(s) || s.length <= 40);
    } else {
      studyInterests = [];
    }

    if (Array.isArray(studyPreferences)) {
      studyPreferences = studyPreferences
        .map((p: string) => sanitizeString(String(p)))
        .filter((p: string) => ALLOWED_PREFERENCES.includes(p) || p.length <= 40);
    } else {
      studyPreferences = [];
    }

    if (Array.isArray(availability)) {
      availability = availability
        .map((a: string) => sanitizeString(String(a)))
        .filter((a: string) => ALLOWED_AVAILABILITY.includes(a) || a.length <= 30);
    } else {
      availability = [];
    }

    if (language && !ALLOWED_LANGUAGES.includes(language)) {
      language = "English";
    }

    if (avatar && typeof avatar === "string") {
      avatar = sanitizeString(avatar).slice(0, 50);
    }

    if (presenceStatus && !ALLOWED_PRESENCE_STATUSES.includes(presenceStatus)) {
      presenceStatus = "ONLINE";
    }

    if (customStatusText && typeof customStatusText === "string") {
      customStatusText = sanitizeString(customStatusText).slice(0, 60);
    } else {
      customStatusText = null;
    }

    if (customStatusEmoji && typeof customStatusEmoji === "string") {
      customStatusEmoji = customStatusEmoji.trim().slice(0, 10);
    } else {
      customStatusEmoji = null;
    }

    // 8. Upsert Study Together Profile in database
    const profile = await prisma.studyTogetherProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName,
        avatar: avatar || null,
        ageRange: ageRange || null,
        gender: gender || null,
        bio: bio || null,
        studyGoal: studyGoal || "Civil Service Exam Preparation",
        studyInterests,
        experienceLevel: experienceLevel || null,
        studyPreferences,
        availability,
        language: language || "English",
        profileCompleted: Boolean(profileCompleted),
        showAgeRange: Boolean(showAgeRange),
        showGender: Boolean(showGender),
        showBio: Boolean(showBio),
        showStudyGoal: Boolean(showStudyGoal),
        showInterests: Boolean(showInterests),
        showPreferences: Boolean(showPreferences),
        showAvailability: Boolean(showAvailability),
        showActivity: Boolean(showActivity),
        presenceStatus: presenceStatus || "ONLINE",
        customStatusText,
        customStatusEmoji,
      },
      update: {
        displayName,
        avatar: avatar || null,
        ageRange: ageRange || null,
        gender: gender || null,
        bio: bio || null,
        studyGoal: studyGoal || "Civil Service Exam Preparation",
        studyInterests,
        experienceLevel: experienceLevel || null,
        studyPreferences,
        availability,
        language: language || "English",
        profileCompleted: Boolean(profileCompleted),
        showAgeRange: Boolean(showAgeRange),
        showGender: Boolean(showGender),
        showBio: Boolean(showBio),
        showStudyGoal: Boolean(showStudyGoal),
        showInterests: Boolean(showInterests),
        showPreferences: Boolean(showPreferences),
        showAvailability: Boolean(showAvailability),
        showActivity: Boolean(showActivity),
        presenceStatus: presenceStatus || "ONLINE",
        customStatusText,
        customStatusEmoji,
      },
    });

    const completionData = calculateProfileCompletion(profile);

    return NextResponse.json({
      success: true,
      message: "Study Together profile saved successfully!",
      profile,
      completion: completionData,
    });
  } catch (error: any) {
    console.error("[STUDY_PROFILE_SAVE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to save study profile", details: error?.message },
      { status: 500 }
    );
  }
}
