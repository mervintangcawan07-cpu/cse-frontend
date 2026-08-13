// Relative Path: src/app/api/social/presence/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserPresence } from "@/lib/social/presence";

const ALLOWED_PRESENCE_STATUSES = ["ONLINE", "AWAY", "BUSY", "OFFLINE"];

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
    let { presenceStatus, customStatusText, customStatusEmoji } = body;

    if (presenceStatus && !ALLOWED_PRESENCE_STATUSES.includes(presenceStatus)) {
      presenceStatus = "ONLINE";
    }

    if (customStatusText && typeof customStatusText === "string") {
      customStatusText = customStatusText.replace(/<[^>]*>?/gm, "").trim().slice(0, 60);
    } else {
      customStatusText = null;
    }

    if (customStatusEmoji && typeof customStatusEmoji === "string") {
      customStatusEmoji = customStatusEmoji.trim().slice(0, 10);
    } else {
      customStatusEmoji = null;
    }

    const now = new Date();

    // 1. Update user lastActiveAt heartbeat
    const user = await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: now },
      select: { id: true, lastActiveAt: true },
    });

    // 2. Update Study Together profile presence fields if profile exists
    const profile = await prisma.studyTogetherProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: "Examinee",
        presenceStatus: presenceStatus || "ONLINE",
        customStatusText,
        customStatusEmoji,
      },
      update: {
        presenceStatus: presenceStatus || "ONLINE",
        customStatusText,
        customStatusEmoji,
      },
    });

    const resolved = resolveUserPresence(user.lastActiveAt, profile);

    return NextResponse.json({
      success: true,
      presence: resolved,
    });
  } catch (error: any) {
    console.error("[PRESENCE_UPDATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update presence status", details: error?.message },
      { status: 500 }
    );
  }
}
