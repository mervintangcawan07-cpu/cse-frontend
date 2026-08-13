// Relative Path: src/app/api/questions/flag/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const userId = session?.userId ? String(session.userId) : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { questionId, reason, notes } = body;

    if (!questionId || !reason) {
      return NextResponse.json({ error: "Missing questionId or reason" }, { status: 400 });
    }

    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Upsert: update existing flag or create new one
    const flag = await prisma.questionFlag.upsert({
      where: {
        userId_questionId: { userId, questionId },
      },
      create: {
        userId,
        questionId,
        reason,
        notes: notes || null,
        status: "PENDING",
      },
      update: {
        reason,
        notes: notes || null,
        status: "PENDING",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, flag });
  } catch (error: any) {
    console.error("[FLAG_QUESTION_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit flag", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    const userId = session?.userId ? String(session.userId) : null;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");

    if (!questionId) {
      return NextResponse.json({ error: "Missing questionId" }, { status: 400 });
    }

    await prisma.questionFlag.deleteMany({
      where: { userId, questionId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[FLAG_QUESTION_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to retract flag", details: error?.message }, { status: 500 });
  }
}
