// Relative Path: src/app/api/admin/questions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { softDeleteRecord } from "@/lib/recovery/softDelete";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where: Prisma.QuestionWhereInput = {
      deletedAt: null,
      NOT: [
        { category: "Elimination Drill" },
        { subtopic: { contains: "Elimination Drill", mode: "insensitive" } },
      ],
    };

    if (category && category !== "All") {
      where.category = category;
    }

    const questions = await prisma.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[QUESTIONS_GET_ERROR]", err);
    return NextResponse.json(
      { error: "Failed to fetch questions.", details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse || !user) {
      return errorResponse ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get("id");

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
      await softDeleteRecord("question", id, user.id);
    }

    return NextResponse.json({
      success: true,
      deletedCount: idsToDelete.length,
      message: `Successfully moved ${idsToDelete.length} question(s) to Trash Bin.`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[QUESTIONS_DELETE_ERROR]", err);
    return NextResponse.json({ error: "Failed to soft-delete question(s).", details: err?.message }, { status: 500 });
  }
}