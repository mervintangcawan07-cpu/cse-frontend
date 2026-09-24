import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAdminAuth(request);
  if (errorResponse) return errorResponse;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const modules = await prisma.readingMaterial.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(modules, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch reading modules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAdminAuth(request);
  if (errorResponse) return errorResponse;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { title, category, content, isPremium } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newModule = await prisma.readingMaterial.create({
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
