import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: "asc" },
    });
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[FEATURE_FLAGS_GET]", error);
    return NextResponse.json({ error: "Failed to load flags" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key, name, description, isEnabled } = await request.json();

    const flag = await prisma.featureFlag.upsert({
      where: { key },
      update: { isEnabled, name, description },
      create: { key, name, description, isEnabled },
    });

    return NextResponse.json({ success: true, flag });
  } catch (error) {
    console.error("[FEATURE_FLAGS_POST]", error);
    return NextResponse.json({ error: "Failed to update feature flag" }, { status: 500 });
  }
}
