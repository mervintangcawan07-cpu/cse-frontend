// Relative Path: src/app/api/user/badges/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { evaluateAndAwardBadges, BADGE_MAP, BADGE_CATALOGUE } from "@/lib/badges";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    // Optionally re-evaluate on load (lightweight re-check)
    await evaluateAndAwardBadges(userId).catch(() => null);

    const earned = await prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
    });

    const earnedSet = new Set(earned.map((b) => b.badgeId));
    const earnedWithMeta = earned.map((b) => ({
      ...b,
      badge: BADGE_MAP.get(b.badgeId) || null,
    }));

    const allBadges = BADGE_CATALOGUE.map((def) => ({
      ...def,
      earned: earnedSet.has(def.id),
      earnedAt: earned.find((e) => e.badgeId === def.id)?.earnedAt || null,
    }));

    return NextResponse.json({
      success: true,
      totalEarned: earnedSet.size,
      totalAvailable: BADGE_CATALOGUE.length,
      earned: earnedWithMeta,
      all: allBadges,
    });
  } catch (error: any) {
    console.error("[BADGES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = user.id;

    const newBadges = await evaluateAndAwardBadges(userId);

    return NextResponse.json({
      success: true,
      newlyAwarded: newBadges,
      newBadgeDetails: newBadges.map((id) => BADGE_MAP.get(id)).filter(Boolean),
    });
  } catch (error: any) {
    console.error("[BADGES_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to evaluate badges" }, { status: 500 });
  }
}
