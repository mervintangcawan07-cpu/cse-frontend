// Relative Path: src/app/api/admin/flags/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyAdmin(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;
  const session = await verifyJWT(token).catch(() => null);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: String(session.userId || session.id || "") },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// GET: Paginated list of flagged questions
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const admin = await verifyAdmin(cookieStore);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    // Aggregate flags grouped by questionId
    const flagsGrouped = await prisma.questionFlag.groupBy({
      by: ["questionId"],
      where: { status },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      skip,
      take: limit,
    });

    const total = await prisma.questionFlag.groupBy({
      by: ["questionId"],
      where: { status },
    });

    const questionIds = flagsGrouped.map((g) => g.questionId);

    // Fetch full question details
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        category: true,
        subtopic: true,
        prompt: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        options: true,
        answerIndex: true,
        explanation: true,
        deletedAt: true,
        flags: {
          where: { status },
          select: {
            id: true,
            reason: true,
            notes: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const result = flagsGrouped.map((g) => ({
      questionId: g.questionId,
      flagCount: g._count.id,
      question: questionMap.get(g.questionId) || null,
    }));

    return NextResponse.json({
      success: true,
      flags: result,
      totalGroups: total.length,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[ADMIN_FLAGS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch flags", details: error?.message }, { status: 500 });
  }
}

// PATCH: Dismiss or resolve a flag group for a question
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const admin = await verifyAdmin(cookieStore);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { questionId, action } = body; // action: "DISMISS" | "RESOLVE" | "DELETE_QUESTION"

    if (!questionId || !action) {
      return NextResponse.json({ error: "Missing questionId or action" }, { status: 400 });
    }

    if (action === "DISMISS") {
      await prisma.questionFlag.updateMany({
        where: { questionId, status: "PENDING" },
        data: { status: "DISMISSED" },
      });
      return NextResponse.json({ success: true, message: "Flags dismissed." });
    }

    if (action === "RESOLVE") {
      await prisma.questionFlag.updateMany({
        where: { questionId, status: "PENDING" },
        data: { status: "RESOLVED" },
      });
      return NextResponse.json({ success: true, message: "Flags marked as resolved." });
    }

    if (action === "DELETE_QUESTION") {
      // Soft-delete the question and resolve all its flags
      await prisma.question.update({
        where: { id: questionId },
        data: { deletedAt: new Date(), deletedBy: admin.id },
      });
      await prisma.questionFlag.updateMany({
        where: { questionId },
        data: { status: "RESOLVED" },
      });
      return NextResponse.json({ success: true, message: "Question soft-deleted and flags resolved." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN_FLAGS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to process flag action", details: error?.message }, { status: 500 });
  }
}
