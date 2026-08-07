// Relative Path: src/app/api/admin/flashcards/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { softDeleteRecord } from "@/lib/recovery/softDelete";

async function checkAdminAuth() {
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

// 1. GET ALL ACTIVE FLASHCARDS (Admin)
export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const flashcards = await prisma.flashcard.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, flashcards });
  } catch (error: unknown) {
    console.error("[ADMIN_FLASHCARDS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch flashcards." }, { status: 500 });
  }
}

// 2. CREATE NEW FLASHCARD
export async function POST(request: Request) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { category, topic, front, back, question, answer, options, difficulty, explanation } = body;

    const cardCategory = category || topic || "General";
    const cardFront = question || front;
    const cardBack = answer || back;

    if (!cardFront || !cardBack) {
      return NextResponse.json({ error: "Question/Front and Answer/Back are required." }, { status: 400 });
    }

    const newCard = await prisma.flashcard.create({
      data: {
        category: cardCategory.trim(),
        topic: topic ? topic.trim() : cardCategory.trim(),
        front: cardFront.trim(),
        back: cardBack.trim(),
        ...(question && { question: question.trim() }),
        ...(answer && { answer: answer.trim() }),
        ...(options && { options }),
        ...(difficulty && { difficulty }),
        ...(explanation && { explanation }),
      },
    });

    revalidatePath("/flashcards");
    revalidatePath("/admin/flashcards");
    revalidatePath("/api/flashcards");

    return NextResponse.json({ success: true, flashcard: newCard });
  } catch (error: unknown) {
    console.error("[ADMIN_FLASHCARDS_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to create flashcard." }, { status: 500 });
  }
}

// 3. UPDATE EXISTING FLASHCARD
export async function PUT(request: Request) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { id, category, topic, front, back, question, answer, options, difficulty, explanation } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required flashcard ID." }, { status: 400 });
    }

    const updatedCard = await prisma.flashcard.update({
      where: { id },
      data: {
        ...(category && { category: category.trim() }),
        ...(topic && { topic: topic.trim() }),
        ...(front && { front: front.trim() }),
        ...(back && { back: back.trim() }),
        ...(question && { question: question.trim() }),
        ...(answer && { answer: answer.trim() }),
        ...(options && { options }),
        ...(difficulty && { difficulty }),
        ...(explanation && { explanation }),
      },
    });

    revalidatePath("/flashcards");
    revalidatePath("/admin/flashcards");
    revalidatePath("/api/flashcards");

    return NextResponse.json({ success: true, flashcard: updatedCard });
  } catch (error: unknown) {
    console.error("[ADMIN_FLASHCARDS_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to update flashcard." }, { status: 500 });
  }
}

// 4. SOFT DELETE FLASHCARD (Single or Bulk Delete All)
export async function DELETE(request: Request) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true" || searchParams.get("deleteAll") === "true";

    // Soft Delete ALL Flashcards
    if (deleteAll) {
      const result = await prisma.flashcard.updateMany({
        where: { deletedAt: null },
        data: {
          deletedAt: new Date(),
          deletedBy: String(admin.id),
        },
      });

      revalidatePath("/flashcards");
      revalidatePath("/admin/flashcards");
      revalidatePath("/api/flashcards");

      return NextResponse.json({
        success: true,
        message: `Successfully soft-deleted ${result.count} flashcard(s).`,
        count: result.count,
      });
    }

    // Soft Delete Single Flashcard
    if (!id) {
      return NextResponse.json({ error: "Card ID or delete parameters required." }, { status: 400 });
    }

    await softDeleteRecord("flashcard", id, String(admin.id));

    revalidatePath("/flashcards");
    revalidatePath("/admin/flashcards");
    revalidatePath("/api/flashcards");

    return NextResponse.json({ success: true, message: "Flashcard soft-deleted successfully." });
  } catch (error: unknown) {
    console.error("[ADMIN_FLASHCARDS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete flashcard." }, { status: 500 });
  }
}