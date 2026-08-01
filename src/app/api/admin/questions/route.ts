import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;

  const session = await verifyJWT(token);
  const userId = session?.userId || session?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true, role: true },
  });

  if (user?.role !== "ADMIN") return null;
  return user;
}

// 1. GET QUESTIONS FOR ADMIN TABLE (SUPPORTING CATEGORY & SUBTOPIC FILTERS)
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const subtopic = searchParams.get("subtopic");

    const whereClause: any = {};
    if (category && category !== "All") {
      whereClause.category = { equals: category, mode: "insensitive" };
    }
    if (subtopic && subtopic !== "All") {
      whereClause.subtopic = { equals: subtopic, mode: "insensitive" };
    }

    const questions = await prisma.question.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("[ADMIN_QUESTIONS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 2. CREATE NEW QUESTION OR PROCESS BULK CSV/JSON (ROBUST FIELD DISCOVERY)
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const contentType = req.headers.get("content-type") || "";
    let rawQuestions: any[] = [];

    if (contentType.includes("text/csv") || contentType.includes("multipart/form-data")) {
      const csvText = await req.text();
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      rawQuestions = parsed.data;
    } else {
      const body = await req.json();
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

    if (!rawQuestions || rawQuestions.length === 0) {
      return NextResponse.json({ error: "Missing required question fields" }, { status: 400 });
    }

    // Helper function to extract field values regardless of header casing or trailing spaces
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

    // Format fields cleanly
    const formattedData = rawQuestions
      .map((item: any) => {
        const category = getFieldValue(item, ["category", "subject"]) || "General";
        const subtopic = getFieldValue(item, ["subtopic", "sub_topic", "subTopic", "topic"]) || "General";
        const prompt = getFieldValue(item, ["prompt", "question"]);
        const explanation = getFieldValue(item, ["explanation", "solution"]) || null;
        const imageUrl = getFieldValue(item, ["imageUrl", "image_url", "image"]) || null;

        const optA = getFieldValue(item, ["optionA", "option_a", "choiceA", "a"]);
        const optB = getFieldValue(item, ["optionB", "option_b", "choiceB", "b"]);
        const optC = getFieldValue(item, ["optionC", "option_c", "choiceC", "c"]);
        const optD = getFieldValue(item, ["optionD", "option_d", "choiceD", "d"]);

        let options: string[] = [];
        if (Array.isArray(item.options) && item.options.length > 0) {
          options = item.options.map((o: any) => String(o).trim());
        } else {
          options = [optA, optB, optC, optD].filter(Boolean);
        }

        let answerIndex = 0;
        const rawAns = getFieldValue(item, ["answerIndex", "correctAnswer", "answer_index", "correct_answer"]);
        if (rawAns !== "") {
          const parsed = parseInt(rawAns, 10);
          answerIndex = isNaN(parsed) ? 0 : parsed;
        }

        return {
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
        };
      })
      .filter((q) => q.prompt && q.category && q.options.length >= 2);

    if (formattedData.length === 0) {
      return NextResponse.json({ error: "No valid questions passed validation" }, { status: 400 });
    }

    if (formattedData.length === 1) {
      const single = await prisma.question.create({
        data: formattedData[0] as any,
      });
      return NextResponse.json({ question: single }, { status: 201 });
    }

    const created = await prisma.question.createMany({
      data: formattedData as any,
    });

    return NextResponse.json({ success: true, count: created.count }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_QUESTIONS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 3. UPDATE AN EXISTING QUESTION BY ID
export async function PUT(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { id, category, subtopic, prompt, options, answerIndex, explanation, imageUrl } = body;

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    if (!prompt || !category) {
      return NextResponse.json({ error: "Prompt and category are required" }, { status: 400 });
    }

    const optA = String(body.optionA || body.option_a || (options && options[0]) || "").trim();
    const optB = String(body.optionB || body.option_b || (options && options[1]) || "").trim();
    const optC = String(body.optionC || body.option_c || (options && options[2]) || "").trim();
    const optD = String(body.optionD || body.option_d || (options && options[3]) || "").trim();

    let finalOptions: string[] = [];
    if (Array.isArray(options) && options.length > 0) {
      finalOptions = options.map((o: any) => String(o).trim());
    } else {
      finalOptions = [optA, optB, optC, optD].filter(Boolean);
    }

    if (finalOptions.length < 2) {
      return NextResponse.json({ error: "At least 2 choices/options are required" }, { status: 400 });
    }

    let parsedAnswerIndex = 0;
    if (typeof answerIndex === "number") {
      parsedAnswerIndex = answerIndex;
    } else if (typeof answerIndex === "string") {
      parsedAnswerIndex = parseInt(answerIndex, 10) || 0;
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: String(id) },
      data: {
        category: String(category).trim(),
        subtopic: String(subtopic || "General").trim(),
        prompt: String(prompt).trim(),
        options: finalOptions,
        optionA: optA || (finalOptions[0] ?? null),
        optionB: optB || (finalOptions[1] ?? null),
        optionC: optC || (finalOptions[2] ?? null),
        optionD: optD || (finalOptions[3] ?? null),
        answerIndex: parsedAnswerIndex,
        explanation: explanation ? String(explanation).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
      },
    });

    return NextResponse.json({ success: true, question: updatedQuestion });
  } catch (error) {
    console.error("[ADMIN_QUESTIONS_PUT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 4. DELETE A QUESTION BY ID
export async function DELETE(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    await prisma.question.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    console.error("[ADMIN_QUESTIONS_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}