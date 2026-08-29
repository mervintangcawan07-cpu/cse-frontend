import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/serverAuth";

async function checkAdminSession() {
  const user = await getAuthenticatedUser();
  return user?.role === "ADMIN" ? user : null;
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
