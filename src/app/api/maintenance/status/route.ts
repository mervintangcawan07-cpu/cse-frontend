import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" },
    });

    const isMaintenance = setting?.value === "true";

    const messageSetting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MESSAGE" },
    });

    return NextResponse.json({
      isMaintenance,
      message: messageSetting?.value || "System is undergoing scheduled updates.",
    });
  } catch (error) {
    console.error("[MAINTENANCE_STATUS_ERROR]", error);
    return NextResponse.json({ isMaintenance: false });
  }
}