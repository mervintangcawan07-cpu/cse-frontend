import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ draft: null }, { status: 401 });

    const draft = await prisma.examDraft.findUnique({
      where: { userId: authenticatedUser.id },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Fetch draft error:", error);
    return NextResponse.json({ draft: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { category, answersJson, questionsJson, currentIndex, timeLeft } = body;

    const safeCategory = typeof category === "string" ? category.trim() : "All";
    if (safeCategory.length > 100) {
      return NextResponse.json({ error: "Category must not exceed 100 characters" }, { status: 400 });
    }

    const safeCurrentIndex = currentIndex !== undefined ? Number(currentIndex) : 0;
    if (!Number.isInteger(safeCurrentIndex) || safeCurrentIndex < 0 || safeCurrentIndex > 500) {
      return NextResponse.json({ error: "Current index must be an integer between 0 and 500" }, { status: 400 });
    }

    const safeTimeLeft = timeLeft !== undefined ? Number(timeLeft) : 0;
    if (!Number.isInteger(safeTimeLeft) || safeTimeLeft < 0 || safeTimeLeft > 86400) {
      return NextResponse.json({ error: "Time left must be an integer between 0 and 86400 seconds" }, { status: 400 });
    }

    const rawAnswers = answersJson !== undefined ? String(answersJson) : "{}";
    if (rawAnswers.length > 100 * 1024) {
      return NextResponse.json({ error: "Answers JSON payload exceeds 100KB limit" }, { status: 400 });
    }
    try {
      const parsedAnswers = JSON.parse(rawAnswers);
      if (typeof parsedAnswers !== "object" || parsedAnswers === null || Array.isArray(parsedAnswers)) {
        return NextResponse.json({ error: "Answers JSON must be a valid JSON object" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Answers JSON is malformed" }, { status: 400 });
    }

    const rawQuestions = questionsJson !== undefined ? String(questionsJson) : "[]";
    if (rawQuestions.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Questions JSON payload exceeds 2MB limit" }, { status: 400 });
    }
    try {
      const parsedQuestions = JSON.parse(rawQuestions);
      if (!Array.isArray(parsedQuestions)) {
        return NextResponse.json({ error: "Questions JSON must be a valid JSON array" }, { status: 400 });
      }
      if (parsedQuestions.length > 500) {
        return NextResponse.json({ error: "Draft questions must not exceed 500 items" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Questions JSON is malformed" }, { status: 400 });
    }

    const draft = await prisma.examDraft.upsert({
      where: { userId: authenticatedUser.id },
      update: {
        category: safeCategory,
        answersJson: rawAnswers,
        questionsJson: rawQuestions,
        currentIndex: safeCurrentIndex,
        timeLeft: safeTimeLeft,
      },
      create: {
        userId: authenticatedUser.id,
        category: safeCategory,
        answersJson: rawAnswers,
        questionsJson: rawQuestions,
        currentIndex: safeCurrentIndex,
        timeLeft: safeTimeLeft,
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error("Save draft error:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.examDraft.delete({
      where: { userId: authenticatedUser.id },
    }).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear draft error:", error);
    return NextResponse.json({ error: "Failed to clear draft" }, { status: 500 });
  }
}
