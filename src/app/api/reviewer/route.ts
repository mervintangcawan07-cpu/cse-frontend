import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return false;
  const session = await verifyJWT(token);
  if (!session?.userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { role: true },
  });

  return user?.role === "ADMIN";
}

export async function GET() {
  try {
    const notes = await prisma.studyNote.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch study notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { category, title, summary, content, tips } = await req.json();
    const note = await prisma.studyNote.create({
      data: {
        category,
        title,
        summary,
        content: Array.isArray(content) ? content : [content],
        tips,
      },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.studyNote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}