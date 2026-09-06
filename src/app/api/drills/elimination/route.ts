// Relative Path: src/app/api/drills/elimination/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeEliminationQuestionWhere } from "@/lib/contentEligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seenParam = searchParams.get("seenIds") || "";
    const seenIds = new Set(seenParam.split(",").filter(Boolean));
    const LIMIT = 10;

    const allDrillQuestions = await prisma.question.findMany({
      where: activeEliminationQuestionWhere(),
      orderBy: { createdAt: "desc" },
    });

    if (allDrillQuestions.length === 0) {
      return NextResponse.json({ success: true, drills: [], loopReset: false });
    }

    let candidatePool = allDrillQuestions.filter((q) => !seenIds.has(q.id));
    let loopReset = false;

    if (candidatePool.length < LIMIT) {
      candidatePool = [...allDrillQuestions];
      loopReset = true;
    }

    const categoryMap = new Map<string, typeof allDrillQuestions>();
    candidatePool.forEach((q) => {
      const cat = q.category || "General";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(q);
    });

    const categories = Array.from(categoryMap.keys());
    const selectedQuestions: typeof allDrillQuestions = [];
    const addedIds = new Set<string>();

    if (categories.length > 0) {
      const baseQuota = Math.floor(LIMIT / categories.length);
      let remainder = LIMIT % categories.length;

      for (const cat of categories) {
        const pool = categoryMap.get(cat)!.sort(() => Math.random() - 0.5);
        const quota = baseQuota + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;

        const picked = pool.slice(0, quota);
        picked.forEach((q) => {
          selectedQuestions.push(q);
          addedIds.add(q.id);
        });
      }

      if (selectedQuestions.length < LIMIT) {
        const remainingCandidates = candidatePool
          .filter((q) => !addedIds.has(q.id))
          .sort(() => Math.random() - 0.5);

        for (const q of remainingCandidates) {
          if (selectedQuestions.length >= LIMIT) break;
          selectedQuestions.push(q);
          addedIds.add(q.id);
        }
      }
    }

    const finalDrills = selectedQuestions.sort(() => Math.random() - 0.5).slice(0, LIMIT);

    return NextResponse.json({
      success: true,
      drills: finalDrills,
      loopReset,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Failed to fetch elimination drills:", err);
    return NextResponse.json(
      { error: "Failed to fetch elimination drills", details: err?.message },
      { status: 500 }
    );
  }
}
