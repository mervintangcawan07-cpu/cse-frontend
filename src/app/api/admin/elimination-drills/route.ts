import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  eliminationNotes?: Record<number, string> | string;
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

      // Answer Index Resolution (Supports A/B/C/D letter or 0/1/2/3 numeric index)
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

      // Construct Distractor Elimination Notes
      let elimNotesObj: Record<string, string> = {};
      if (q.eliminationNotes && typeof q.eliminationNotes === "object") {
        elimNotesObj = q.eliminationNotes as any;
      } else {
        if (q.eliminationA) elimNotesObj[0] = q.eliminationA.trim();
        if (q.eliminationB) elimNotesObj[1] = q.eliminationB.trim();
        if (q.eliminationC) elimNotesObj[2] = q.eliminationC.trim();
        if (q.eliminationD) elimNotesObj[3] = q.eliminationD.trim();
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
        explanation: q.explanation?.trim() || null,
        eliminationNotes: Object.keys(elimNotesObj).length > 0 ? elimNotesObj : null,
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

    let idsToDelete: string[] = [];

    if (queryId) {
      idsToDelete = [queryId];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body.ids)) {
          idsToDelete = body.ids;
        } else if (body.id) {
          idsToDelete = [body.id];
        }
      } catch (e) {
        // No body provided
      }
    }

    if (deleteAll) {
      const deletedAll = await prisma.question.deleteMany({
        where: {
          OR: [
            { category: "Elimination Drill" },
            { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
          ],
        },
      });
      return NextResponse.json({
        success: true,
        deletedCount: deletedAll.count,
        message: `Deleted all ${deletedAll.count} elimination drill questions.`,
      });
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: "No question ID(s) provided for deletion." }, { status: 400 });
    }

    const result = await prisma.question.deleteMany({
      where: {
        id: { in: idsToDelete },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} drill question(s).`,
    });
  } catch (error: any) {
    console.error("[ADMIN_DRILL_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete drill questions.", details: error?.message },
      { status: 500 }
    );
  }
}