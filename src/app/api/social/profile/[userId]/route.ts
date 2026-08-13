// Relative Path: src/app/api/social/profile/[userId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
            createdAt: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 🔒 PRIVACY ENFORCEMENT: Never expose email, password, payment details, exact age, or gender
    const publicProfile = {
      id: targetUser.id,
      displayName: targetUser.studyProfile?.displayName || targetUser.name || "Examinee",
      avatar: targetUser.studyProfile?.avatar || null,
      bio: targetUser.studyProfile?.bio || "Preparing for the Civil Service Exam.",
      studyGoal: targetUser.studyProfile?.studyGoal || "Civil Service Exam",
      studyInterests: targetUser.studyProfile?.studyInterests || [],
      experienceLevel: targetUser.studyProfile?.experienceLevel || "Examinee",
      studyPreferences: targetUser.studyProfile?.studyPreferences || [],
      availability: targetUser.studyProfile?.availability || [],
      language: targetUser.studyProfile?.language || "English",
      isPro: targetUser.isPaid,
      joinedAt: targetUser.studyProfile?.createdAt,
      isOnline: targetUser.lastActiveAt
        ? new Date().getTime() - new Date(targetUser.lastActiveAt).getTime() < 1000 * 60 * 5
        : false,
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
