import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/auth";

async function checkAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;
  const session = await verifyJWT(token);
  return session?.role === "ADMIN" ? session : null;
}

export async function GET() {
  const session = await checkAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const modules = await (prisma as any).readingMaterial.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(modules, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reading modules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await checkAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { title, category, content, isPremium } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newModule = await (prisma as any).readingMaterial.create({
      data: {
        title,
        category,
        content,
        isPremium: Boolean(isPremium),
      },
    });

    return NextResponse.json(newModule, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 });
  }
}