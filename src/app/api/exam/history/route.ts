import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const history = await prisma.examResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ history }, { status: 200 });
  } catch (error) {
    console.error("Error fetching exam history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}