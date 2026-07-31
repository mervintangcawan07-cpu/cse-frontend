import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const modeSetting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" },
    });
    const msgSetting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MESSAGE" },
    });

    return NextResponse.json({
      enabled: modeSetting?.value === "true",
      message: msgSetting?.value || "System maintenance in progress. We'll be back shorty!",
    });
  } catch (error) {
    console.error("[ADMIN_MAINTENANCE_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { enabled, message } = await request.json();

    await prisma.systemSetting.upsert({
      where: { key: "MAINTENANCE_MODE" },
      update: { value: enabled ? "true" : "false" },
      create: { key: "MAINTENANCE_MODE", value: enabled ? "true" : "false" },
    });

    if (message !== undefined) {
      await prisma.systemSetting.upsert({
        where: { key: "MAINTENANCE_MESSAGE" },
        update: { value: message },
        create: { key: "MAINTENANCE_MESSAGE", value: message },
      });
    }

    return NextResponse.json({
      success: true,
      enabled,
      message: "Maintenance mode updated successfully.",
    });
  } catch (error) {
    console.error("[ADMIN_MAINTENANCE_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to update maintenance mode" }, { status: 500 });
  }
}