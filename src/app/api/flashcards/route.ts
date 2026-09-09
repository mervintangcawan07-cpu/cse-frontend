import { NextResponse } from "next/server";
import { requireProAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { activeFlashcardWhere } from "@/lib/contentEligibility";
import { CACHE_PROFILES } from "@/lib/cache";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireProAuth(request);
    if (errorResponse) {
      const data = await errorResponse.json();
      return NextResponse.json(data, {
        status: errorResponse.status,
        headers: CACHE_PROFILES.PRIVATE,
      });
    }

    const flashcards = await prisma.flashcard.findMany({
      where: activeFlashcardWhere(),
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, flashcards }, { headers: CACHE_PROFILES.PRIVATE });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : undefined;
    console.error("[FLASHCARDS_FETCH_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load flashcards." },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}
