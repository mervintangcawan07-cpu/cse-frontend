// Relative Path: src/app/api/social/profile/[userId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserPresence } from "@/lib/social/presence";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
) {
  try {
    const resolvedParams = await params;
    const targetUserId = String(resolvedParams.userId);

    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        isPaid: true,
        lastActiveAt: true,
        studyProfile: {
          select: {
            displayName: true,
            avatar: true,
            bio: true,
            studyGoal: true,
            studyInterests: true,
            experienceLevel: true,
            studyPreferences: true,
            availability: true,
            language: true,
            ageRange: true,
            gender: true,
            showAgeRange: true,
            showGender: true,
            showBio: true,
            showStudyGoal: true,
            showInterests: true,
            showPreferences: true,
            showAvailability: true,
            showActivity: true,
            presenceStatus: true,
            customStatusText: true,
            customStatusEmoji: true,
            createdAt: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sp = targetUser.studyProfile;
    const presence = resolveUserPresence(targetUser.lastActiveAt, sp);

    // 🔒 PRIVACY-ENFORCED PUBLIC STUDY CARD:
    // Respects user's privacy visibility preferences while hiding all sensitive account details
    const publicProfile = {
      id: targetUser.id,
      displayName: sp?.displayName || targetUser.name || "Examinee",
      avatar: sp?.avatar || null,
      bio: sp?.showBio ? (sp?.bio || null) : null,
      studyGoal: sp?.showStudyGoal ? (sp?.studyGoal || "Civil Service Exam Review") : null,
      studyInterests: sp?.showInterests ? (sp?.studyInterests || []) : [],
      experienceLevel: sp?.experienceLevel || "Examinee",
      studyPreferences: sp?.showPreferences ? (sp?.studyPreferences || []) : [],
      availability: sp?.showAvailability ? (sp?.availability || []) : [],
      language: sp?.language || "English",
      ageRange: sp?.showAgeRange ? (sp?.ageRange || null) : null,
      gender: sp?.showGender ? (sp?.gender || null) : null,
      isPro: targetUser.isPaid,
      joinedAt: sp?.createdAt,
      presence,
      isOnline: presence.isOnline,
    };

    return NextResponse.json({
      success: true,
      profile: publicProfile,
    });
  } catch (error: any) {
    console.error("[PUBLIC_STUDY_PROFILE_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch study profile", details: error?.message },
      { status: 500 }
    );
  }
}
