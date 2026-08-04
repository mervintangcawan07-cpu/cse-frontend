import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seenParam = searchParams.get("seenIds") || "";
    const seenIds = new Set(seenParam.split(",").filter(Boolean));
    const LIMIT = 10;

    // 1. Fetch all Elimination Drill questions from Database
    const allDrillQuestions = await prisma.question.findMany({
      where: {
        OR: [
          { category: "Elimination Drill" },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (allDrillQuestions.length === 0) {
      return NextResponse.json({ success: true, drills: [], loopReset: false });
    }

    // 2. Filter out questions already seen in past sessions
    let candidatePool = allDrillQuestions.filter((q) => !seenIds.has(q.id));
    let loopReset = false;

    // 3. LOOP RESET: If unseen pool has fewer than 10 items, reset candidates to full DB pool
    if (candidatePool.length < LIMIT) {
      candidatePool = [...allDrillQuestions];
      loopReset = true;
    }

    // 4. Group candidate questions by category
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

    // 5. Divide 10 items EQUALLY across available categories
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

      // Catch-all: Top up to 10 if any category had fewer items than allocated quota
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

    // 6. Shuffle final 10 items to intermix categories
    const finalDrills = selectedQuestions.sort(() => Math.random() - 0.5).slice(0, LIMIT);

    return NextResponse.json({
      success: true,
      drills: finalDrills,
      loopReset,
    });
  } catch (error: any) {
    console.error("Failed to fetch elimination drills:", error);
    return NextResponse.json(
      { error: "Failed to fetch elimination drills", details: error?.message },
      { status: 500 }
    );
  }
}