// Relative Path: src/app/api/admin/flashcards/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { flashcards } = await req.json();
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json({ error: "No flashcards provided" }, { status: 400 });
    }

    const dataToInsert = flashcards
      .map((f: any) => ({
        category: (f.category || "General").trim(),
        topic: (f.topic || f.category || "General").trim(),
        front: (f.question || f.front || "").trim(),
        back: (f.answer || f.back || "").trim(),
        question: (f.question || f.front || "").trim(),
        answer: (f.answer || f.back || "").trim(),
        options: Array.isArray(f.options) ? f.options : [],
        explanation: (f.explanation || "").trim(),
        difficulty: (f.difficulty || "medium").toLowerCase(),
      }))
      .filter((f: any) => f.front && f.back);

    if (dataToInsert.length === 0) {
      return NextResponse.json({ error: "No valid flashcards found in payload." }, { status: 400 });
    }

    const result = await prisma.flashcard.createMany({
      data: dataToInsert,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[BULK_INSERT_FLASHCARDS_ERROR]", error);
    return NextResponse.json({ error: "Failed to insert flashcards" }, { status: 500 });
  }
}

export const DELETE = requireSudo(async (req: NextRequest) => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No flashcard IDs provided" }, { status: 400 });
    }

    const result = await prisma.flashcard.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: new Date(),
        deletedBy: String(session.userId),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("[BULK_DELETE_FLASHCARDS_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete flashcards" }, { status: 500 });
  }
});

