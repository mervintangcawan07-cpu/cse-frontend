// Relative Path: src/app/api/admin/questions/export/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuestionsCSV } from "@/lib/csvParser";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId || session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const subtopic = searchParams.get("subtopic");

    const whereClause: any = {
      deletedAt: null,
    };

    if (category && category !== "All") {
      whereClause.category = { equals: category, mode: "insensitive" };
    }

    if (subtopic && subtopic !== "All") {
      whereClause.subtopic = { equals: subtopic, mode: "insensitive" };
    }

    const questions = await prisma.question.findMany({
      where: whereClause,
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    const csvData = generateQuestionsCSV(questions as any);

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cse_question_bank_export_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 });
  }
}
