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

    const draft = await prisma.examDraft.upsert({
      where: { userId: authenticatedUser.id },
      update: {
        category,
        answersJson,
        questionsJson,
        currentIndex,
        timeLeft,
      },
      create: {
        userId: authenticatedUser.id,
        category: category || "All",
        answersJson: answersJson || "{}",
        questionsJson: questionsJson || "[]",
        currentIndex: currentIndex || 0,
        timeLeft: timeLeft || 0,
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
