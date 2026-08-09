// Relative Path: src/app/api/admin/elimination-drills/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { softDeleteRecord } from "@/lib/recovery/softDelete";

interface IncomingQuestionPayload {
  prompt?: string;
  question?: string;
  category?: string;
  subtopic?: string;
  tags?: string;
  options?: string[];
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  answerIndex?: number | string;
  correctAnswer?: string;
  explanation?: string;
  eliminationA?: string;
  eliminationB?: string;
  eliminationC?: string;
  eliminationD?: string;
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

    let drills = await prisma.question.findMany({
      where: {
        deletedAt: null,
        OR: [
          { category: "Elimination Drill" },
          { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    let isFallback = false;
      if (drills.length === 0) {
        drills = await prisma.question.findMany({
          where: { deletedAt: null },
          take: 50,
          orderBy: { createdAt: "desc" },
        });
        isFallback = true;
      }

      return NextResponse.json({ success: true, drills, isFallback });
  } catch (error: unknown) {
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

    const formattedToInsert: Array<{
      prompt: string;
      category: string;
      subtopic: string;
      options: string[];
      optionA: string | null;
      optionB: string | null;
      optionC: string | null;
      optionD: string | null;
      answerIndex: number;
      explanation: string | null;
      imageUrl: string | null;
    }> = [];
    const validationErrors: string[] = [];

    questions.forEach((q: IncomingQuestionPayload, idx: number) => {
      const promptText = (q.prompt || q.question || "").trim();
      if (!promptText) {
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

      let resolvedAnswerIdx = 0;
      if (typeof q.answerIndex === "number" && q.answerIndex >= 0 && q.answerIndex < rawOptions.length) {
        resolvedAnswerIdx = q.answerIndex;
      } else if (typeof q.answerIndex === "string" && !isNaN(parseInt(q.answerIndex, 10))) {
        const parsed = parseInt(q.answerIndex, 10);
        if (parsed >= 0 && parsed < rawOptions.length) resolvedAnswerIdx = parsed;
      } else if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) {
        const ansStr = q.correctAnswer.trim().toUpperCase();
        if (ansStr === "A" || ansStr === "0") resolvedAnswerIdx = 0;
        else if (ansStr === "B" || ansStr === "1") resolvedAnswerIdx = 1;
        else if (ansStr === "C" || ansStr === "2") resolvedAnswerIdx = 2;
        else if (ansStr === "D" || ansStr === "3") resolvedAnswerIdx = 3;
        else {
          const foundIdx = rawOptions.findIndex(
            (opt) => opt.toLowerCase() === ansStr.toLowerCase()
          );
          if (foundIdx !== -1) resolvedAnswerIdx = foundIdx;
        }
      }

      const baseExplanation = (q.explanation || "").trim();
      const elimParts: string[] = [];
      if (q.eliminationA?.trim()) elimParts.push(`• A: ${q.eliminationA.trim()}`);
      if (q.eliminationB?.trim()) elimParts.push(`• B: ${q.eliminationB.trim()}`);
      if (q.eliminationC?.trim()) elimParts.push(`• C: ${q.eliminationC.trim()}`);
      if (q.eliminationD?.trim()) elimParts.push(`• D: ${q.eliminationD.trim()}`);

      let finalExplanation: string | null = baseExplanation || null;
      if (elimParts.length > 0) {
        const breakdownStr = `Elimination Strategy Breakdown:\n${elimParts.join("\n")}`;
        finalExplanation = baseExplanation ? `${baseExplanation}\n\n${breakdownStr}` : breakdownStr;
      }

      const rawCategory = q.category?.trim() || "Elimination Drill";
      const rawSubtopic = (q.subtopic || q.tags || "Speed Drill").trim();
      const subtopicTagged = rawSubtopic.toLowerCase().includes("elimination drill")
        ? rawSubtopic
        : `${rawSubtopic} (Elimination Drill)`;

      formattedToInsert.push({
        prompt: promptText,
        category: rawCategory,
        subtopic: subtopicTagged,
        options: rawOptions,
        optionA: rawOptions[0] || null,
        optionB: rawOptions[1] || null,
        optionC: rawOptions[2] || null,
        optionD: rawOptions[3] || null,
        answerIndex: resolvedAnswerIdx,
        explanation: finalExplanation,
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[ADMIN_DRILL_BULK_UPLOAD_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to save questions to database.", details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      const allDrillQuestions = await prisma.question.findMany({
        where: {
          deletedAt: null,
          OR: [
            { category: "Elimination Drill" },
            { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      for (const q of allDrillQuestions) {
        await softDeleteRecord("question", q.id, String(session.userId));
      }

      return NextResponse.json({
        success: true,
        deletedCount: allDrillQuestions.length,
        message: `Soft-deleted all ${allDrillQuestions.length} elimination drill questions.`,
      });
    }

    let idsToDelete: string[] = [];
    if (queryId) {
      idsToDelete = [queryId];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body.ids)) idsToDelete = body.ids;
        else if (body.id) idsToDelete = [body.id];
      } catch {
        // No body provided
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "No question ID(s) provided for deletion." }, { status: 400 });
    }

    for (const id of idsToDelete) {
      await softDeleteRecord("question", id, String(session.userId));
    }

    return NextResponse.json({
      success: true,
      deletedCount: idsToDelete.length,
      message: `Successfully soft-deleted ${idsToDelete.length} drill question(s).`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[ADMIN_DRILL_DELETE_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to delete drill questions.", details: err?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
    const { id, prompt, category, subtopic, options, answerIndex, explanation } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing question ID for update." }, { status: 400 });
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        ...(prompt !== undefined && { prompt }),
        ...(category !== undefined && { category }),
        ...(subtopic !== undefined && { subtopic }),
        ...(options !== undefined && { options }),
        ...(answerIndex !== undefined && { answerIndex: Number(answerIndex) }),
        ...(explanation !== undefined && { explanation }),
      },
    });

    return NextResponse.json({ success: true, question: updated });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[ADMIN_DRILL_PUT_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to update question.", details: err?.message },
      { status: 500 }
    );
  }
}
