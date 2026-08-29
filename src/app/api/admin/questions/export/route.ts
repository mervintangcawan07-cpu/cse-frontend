// Relative Path: src/app/api/admin/questions/export/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { generateQuestionsCSV } from "@/lib/csvParser";

export async function GET(request: Request) {
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
