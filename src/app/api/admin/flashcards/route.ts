import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// 1. GET ALL FLASHCARDS (Admin)
export async function GET() {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const flashcards = await (prisma as any).flashcard.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, flashcards });
  } catch (error: any) {
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
    const { category, topic, front, back } = body;

    if (!category || !topic || !front || !back) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const newCard = await (prisma as any).flashcard.create({
      data: {
        category: category.trim(),
        topic: topic.trim(),
        front: front.trim(),
        back: back.trim(),
      },
    });

    return NextResponse.json({ success: true, flashcard: newCard });
  } catch (error: any) {
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
    const { id, category, topic, front, back } = body;

    if (!id || !category || !topic || !front || !back) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const updatedCard = await (prisma as any).flashcard.update({
      where: { id },
      data: {
        category: category.trim(),
        topic: topic.trim(),
        front: front.trim(),
        back: back.trim(),
      },
    });

    return NextResponse.json({ success: true, flashcard: updatedCard });
  } catch (error: any) {
    console.error("[ADMIN_FLASHCARDS_PUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to update flashcard." }, { status: 500 });
  }
}

// 4. DELETE FLASHCARD
export async function DELETE(request: Request) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Card ID is required." }, { status: 400 });
    }

    await (prisma as any).flashcard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Flashcard deleted successfully." });
  } catch (error: any) {
    console.error("[ADMIN_FLASHCARDS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete flashcard." }, { status: 500 });
  }
}