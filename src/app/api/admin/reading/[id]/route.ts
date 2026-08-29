import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/serverAuth";

async function checkAdminSession() {
  const user = await getAuthenticatedUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, category, content, isPremium } = body;

    const updated = await (prisma as any).readingMaterial.update({
      where: { id },
      data: {
        title,
        category,
        content,
        isPremium: Boolean(isPremium),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    await (prisma as any).readingMaterial.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete module" }, { status: 500 });
  }
}
