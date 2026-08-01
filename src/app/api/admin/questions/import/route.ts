import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

interface ImportedQuestion {
  category: string;
  subtopic: string;
  prompt: string;
  options: string[];
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  answerIndex: number;
  explanation?: string | null;
  imageUrl?: string | null;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    const userId = session?.userId || session?.id;

    if (!userId || session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let rawQuestions: any[] = [];

    // Parse incoming CSV text, Multipart Form Data, or JSON payloads
    if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      const csvText = await request.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      rawQuestions = parsed.data;
    } else {
      const body = await request.json();
      if (typeof body.csvText === "string") {
        const parsed = Papa.parse(body.csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        });
        rawQuestions = parsed.data;
      } else if (Array.isArray(body)) {
        rawQuestions = body;
      } else if (body.questions && Array.isArray(body.questions)) {
        rawQuestions = body.questions;
      } else {
        rawQuestions = [body];
      }
    }

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      return NextResponse.json({ error: "No valid questions array provided" }, { status: 400 });
    }

    // Helper function to extract field values regardless of header casing or whitespace
    const getFieldValue = (item: Record<string, any>, possibleKeys: string[]): string => {
      const itemKeys = Object.keys(item);
      for (const targetKey of possibleKeys) {
        const matchedKey = itemKeys.find(
          (k) => k.trim().toLowerCase() === targetKey.toLowerCase()
        );
        if (matchedKey && item[matchedKey] !== undefined && item[matchedKey] !== null) {
          const val = String(item[matchedKey]).trim();
          if (val !== "") return val;
        }
      }
      return "";
    };

    // Validate and format structure of imported items
    const validQuestions: ImportedQuestion[] = [];
    for (const q of rawQuestions) {
      const category = getFieldValue(q, ["category", "subject"]) || "General";
      const subtopic = getFieldValue(q, ["subtopic", "sub_topic", "subTopic", "topic"]) || "General";
      const prompt = getFieldValue(q, ["prompt", "question"]);
      const explanation = getFieldValue(q, ["explanation", "solution"]) || null;
      const imageUrl = getFieldValue(q, ["imageUrl", "image_url", "image"]) || null;

      const optA = getFieldValue(q, ["optionA", "option_a", "choiceA", "a"]);
      const optB = getFieldValue(q, ["optionB", "option_b", "choiceB", "b"]);
      const optC = getFieldValue(q, ["optionC", "option_c", "choiceC", "c"]);
      const optD = getFieldValue(q, ["optionD", "option_d", "choiceD", "d"]);

      let options: string[] = [];
      if (Array.isArray(q.options) && q.options.length > 0) {
        options = q.options.map((opt: unknown) => String(opt).trim());
      } else {
        options = [optA, optB, optC, optD].filter(Boolean);
      }

      let answerIndex = 0;
      const rawAns = getFieldValue(q, ["answerIndex", "correctAnswer", "answer_index", "correct_answer"]);
      if (rawAns !== "") {
        const parsed = parseInt(rawAns, 10);
        answerIndex = isNaN(parsed) ? 0 : parsed;
      }

      if (prompt && category && options.length >= 2) {
        validQuestions.push({
          category,
          subtopic,
          prompt,
          options,
          optionA: optA || (options[0] ?? null),
          optionB: optB || (options[1] ?? null),
          optionC: optC || (options[2] ?? null),
          optionD: optD || (options[3] ?? null),
          answerIndex,
          explanation,
          imageUrl,
        });
      }
    }

    if (validQuestions.length === 0) {
      return NextResponse.json({ error: "No questions passed validation rules" }, { status: 400 });
    }

    // Bulk create questions inside database
    const created = await prisma.question.createMany({
      data: validQuestions as any,
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