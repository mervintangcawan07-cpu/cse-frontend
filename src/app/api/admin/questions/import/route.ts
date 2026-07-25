import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ImportedQuestion {
  category: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string | null;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "No valid questions array provided" }, { status: 400 });
    }

    // Validate structure of imported items
    const validQuestions: ImportedQuestion[] = [];
    for (const q of questions) {
      if (
        q.prompt &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.answerIndex === "number" &&
        q.category
      ) {
        validQuestions.push({
          category: String(q.category).trim(),
          prompt: String(q.prompt).trim(),
          options: q.options.map((opt: unknown) => String(opt).trim()),
          answerIndex: Number(q.answerIndex),
          explanation: q.explanation ? String(q.explanation).trim() : null,
        });
      }
    }

    if (validQuestions.length === 0) {
      return NextResponse.json({ error: "No questions passed validation rules" }, { status: 400 });
    }

    // Bulk create questions inside database
    const created = await prisma.question.createMany({
      data: validQuestions,
    });

    // Log admin bulk activity
    await prisma.activityLog.create({
      data: {
        userId: String(session.userId),
        action: "BULK_QUESTIONS_IMPORTED",
        metadata: JSON.stringify({ count: created.count }),
      },
    });

    return NextResponse.json({
      success: true,
      importedCount: created.count,
    });
  } catch (error) {
    console.error("Bulk import questions error:", error);
    return NextResponse.json({ error: "Failed to process question import" }, { status: 500 });
  }
}