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
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { id: true, role: true },
  });

  if (user?.role !== "ADMIN") return null;
  return user;
}

// 1. GET ALL QUESTIONS FOR ADMIN TABLE
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const questions = await prisma.question.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("[ADMIN_QUESTIONS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 2. CREATE NEW QUESTION OR PROCESS BULK CSV/JSON
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
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      rawQuestions = parsed.data;
    } else {
      const body = await req.json();
      if (typeof body.csvText === "string") {
        const parsed = Papa.parse(body.csvText, { header: true, skipEmptyLines: true });
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

    // Format fields cleanly
    const formattedData = rawQuestions
      .map((item: any) => {
        const category = String(item.category || item.subject || "").trim();
        const prompt = String(item.prompt || item.question || "").trim();
        const explanation = item.explanation ? String(item.explanation).trim() : null;
        const imageUrl = (item.imageUrl || item.image_url || item.image || "").trim() || null;

        let options: string[] = [];
        if (Array.isArray(item.options)) {
          options = item.options.map((o: any) => String(o).trim());
        } else {
          options = [
            item.optionA || item.option_a || "",
            item.optionB || item.option_b || "",
            item.optionC || item.option_c || "",
            item.optionD || item.option_d || "",
          ]
            .map((o) => String(o).trim())
            .filter(Boolean);
        }

        let answerIndex = 0;
        if (typeof item.answerIndex === "number") {
          answerIndex = item.answerIndex;
        } else if (typeof item.answerIndex === "string") {
          answerIndex = parseInt(item.answerIndex, 10) || 0;
        }

        return {
          category,
          prompt,
          options,
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

// 3. DELETE A QUESTION BY ID
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