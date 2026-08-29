import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { parseCSVToQuestions } from "@/lib/csvParser";

export async function POST(request: Request) {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    const userId = authentication.session.user.id;

    const contentType = request.headers.get("content-type") || "";
    let validQuestions: any[] = [];

    // Parse incoming CSV text, Multipart Form Data, or JSON payloads
    if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      const csvText = await request.text();
      validQuestions = parseCSVToQuestions(csvText);
    } else {
      const body = await request.json();
      if (typeof body.csvText === "string") {
        validQuestions = parseCSVToQuestions(body.csvText);
      } else if (Array.isArray(body)) {
        validQuestions = parseCSVToQuestions(Papa.unparse(body));
      } else if (body.questions && Array.isArray(body.questions)) {
        validQuestions = parseCSVToQuestions(Papa.unparse(body.questions));
      } else {
        validQuestions = parseCSVToQuestions(Papa.unparse([body]));
      }
    }

    if (!Array.isArray(validQuestions) || validQuestions.length === 0) {
      return NextResponse.json({ error: "No valid questions passed validation rules" }, { status: 400 });
    }

    // Format for Prisma insert
    const insertData = validQuestions.map((q) => {
      let stepByStepStr: string | null = null;
      if (Array.isArray(q.stepByStep)) {
        stepByStepStr = q.stepByStep.map((s: any) => `${s.step}: ${s.detail}`).join("|");
      } else if (q.stepByStep) {
        stepByStepStr = String(q.stepByStep);
      }

      const tagsArr = Array.isArray(q.tags)
        ? q.tags
        : typeof q.tags === "string"
        ? q.tags.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean)
        : [];

      return {
        category: q.category || "General",
        subtopic: q.subtopic || "General",
        prompt: q.prompt,
        options: q.options,
        optionA: q.optionA || (q.options[0] ?? null),
        optionB: q.optionB || (q.options[1] ?? null),
        optionC: q.optionC || (q.options[2] ?? null),
        optionD: q.optionD || (q.options[3] ?? null),
        answerIndex: q.answerIndex ?? 0,
        explanation: q.explanation || null,
        imageUrl: q.imageUrl || null,
        stepByStep: stepByStepStr,
        whyA: q.whyA || null,
        whyB: q.whyB || null,
        whyC: q.whyC || null,
        whyD: q.whyD || null,
        eliminationStrategy: q.eliminationStrategy || null,
        commonTrap: q.commonTrap || null,
        examTip: q.examTip || null,
        difficulty: q.difficulty || "MEDIUM",
        tags: tagsArr,
        skillTested: q.skillTested || null,
      };
    });

    // Bulk create questions inside database
    const created = await prisma.question.createMany({
      data: insertData,
    });

    // Log admin bulk activity
    await prisma.activityLog.create({
      data: {
        userId: String(userId),
        action: "BULK_QUESTIONS_IMPORTED",
        metadata: JSON.stringify({ count: created.count }),
      },
    });

    return NextResponse.json({
      success: true,
      importedCount: created.count,
      count: created.count,
    });
  } catch (error) {
    console.error("Bulk import questions error:", error);
    return NextResponse.json({ error: "Failed to process question import" }, { status: 500 });
  }
}
