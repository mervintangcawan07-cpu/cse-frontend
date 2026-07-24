import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper function to check if the requester is an ADMIN
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

// 1. GET ALL QUESTIONS
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

// 2. CREATE A NEW QUESTION
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { category, prompt, options, answerIndex, explanation } = body;

    if (!category || !prompt || !options || options.length < 2 || answerIndex === undefined) {
      return NextResponse.json({ error: "Missing required question fields" }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: {
        category,
        prompt,
        options,
        answerIndex: Number(answerIndex),
        explanation: explanation || null,
      },
    });

    return NextResponse.json({ question }, { status: 201 });
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