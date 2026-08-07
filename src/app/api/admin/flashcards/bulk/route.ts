// Relative Path: src/app/api/admin/flashcards/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";

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
