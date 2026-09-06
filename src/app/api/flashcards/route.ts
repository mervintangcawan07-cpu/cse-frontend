import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { activeFlashcardWhere } from "@/lib/contentEligibility";

export async function GET() {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized: Please log in." }, { status: 401 });
    }

    if (!authentication.authenticated) {
      return NextResponse.json({ error: "Unauthorized: Session invalid." }, { status: 401 });
    }

    const flashcards = await prisma.flashcard.findMany({
      where: activeFlashcardWhere(),
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, flashcards });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : undefined;
    console.error("[FLASHCARDS_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load flashcards.", details: message },
      { status: 500 }
    );
  }
}
