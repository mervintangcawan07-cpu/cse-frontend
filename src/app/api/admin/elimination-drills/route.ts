import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface IncomingQuestionPayload {
  prompt?: string;
  category?: string;
  subtopic?: string;
  options?: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  answerIndex?: number | string;
  correctAnswer?: string;
  explanation?: string;
  imageUrl?: string;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session || (session.role !== "ADMIN" && session.email !== "mervintangcawan07@gmail.com")) {
      return NextResponse.json({ error: "Access denied. Admin privileges required." }, { status: 403 });
    }

    const drills = await prisma.question.findMany({
      where: {
        OR: [
          { category: "Elimination Drill" },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, drills });
  } catch (error: any) {
    console.error("[ADMIN_DRILL_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch drill questions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session || (session.role !== "ADMIN" && session.email !== "mervintangcawan07@gmail.com")) {
      return NextResponse.json({ error: "Access denied. Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { questions } = body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Invalid payload: 'questions' must be a non-empty array." }, { status: 400 });
    }

    const formattedToInsert: any[] = [];
    const validationErrors: string[] = [];

    questions.forEach((q: IncomingQuestionPayload, idx: number) => {
      if (!q.prompt || typeof q.prompt !== "string" || !q.prompt.trim()) {
        validationErrors.push(`Row #${idx + 1}: Missing question text/prompt.`);
        return;
      }

      const rawOptions: string[] =
        Array.isArray(q.options) && q.options.length >= 2
          ? (q.options as string[]).map((o: string) => String(o).trim()).filter(Boolean)
          : ([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean) as string[]);

      if (rawOptions.length < 2) {
        validationErrors.push(`Row #${idx + 1}: Question must have at least 2 options.`);
        return;
      }

      // Robust Answer Index Resolver
      let resolvedAnswerIdx = 0;
      if (typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < rawOptions.length) {
        resolvedAnswerIdx = q.answerIndex;
      } else if (typeof q.answerIndex === "string" && !isNaN(parseInt(q.answerIndex, 10))) {
        const parsed = parseInt(q.answerIndex, 10);
        if (parsed >= 0 && parsed < rawOptions.length) resolvedAnswerIdx = parsed;
      } else if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
        const ansStr = q.correctAnswer.trim();
        if (ansStr.toUpperCase() === "A") resolvedAnswerIdx = 0;
        else if (ansStr.toUpperCase() === "B") resolvedAnswerIdx = 1;
        else if (ansStr.toUpperCase() === "C") resolvedAnswerIdx = 2;
        else if (ansStr.toUpperCase() === "D") resolvedAnswerIdx = 3;
        else {
          const foundIdx = rawOptions.findIndex(
            (opt) => opt.toLowerCase() === ansStr.toLowerCase()
          );
          if (foundIdx !== -1) resolvedAnswerIdx = foundIdx;
        }
      }

      // Tag subtopic so queries can consistently identify Elimination Drill items
      const rawCategory = q.category?.trim() || "Elimination Drill";
      const rawSubtopic = q.subtopic?.trim() || "Speed Drill";
      const subtopicTagged = rawSubtopic.toLowerCase().includes("elimination drill")
        ? rawSubtopic
        : `${rawSubtopic} (Elimination Drill)`;

      formattedToInsert.push({
        prompt: q.prompt.trim(),
        category: rawCategory,
        subtopic: subtopicTagged,
        options: rawOptions,
        optionA: rawOptions[0] || null,
        optionB: rawOptions[1] || null,
        optionC: rawOptions[2] || null,
        optionD: rawOptions[3] || null,
        answerIndex: resolvedAnswerIdx,
        explanation: q.explanation?.trim() || null,
        imageUrl: q.imageUrl?.trim() || null,
      });
    });

    if (formattedToInsert.length === 0) {
      return NextResponse.json(
        { error: "No valid questions were parsed.", details: validationErrors },
        { status: 400 }
      );
    }

    const result = await prisma.question.createMany({
      data: formattedToInsert,
    });

    return NextResponse.json({
      success: true,
      insertedCount: result.count,
      errors: validationErrors,
    });
  } catch (error: any) {
    console.error("[ADMIN_DRILL_BULK_UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to save questions to database.", details: error?.message },
      { status: 500 }
    );
  }
}
