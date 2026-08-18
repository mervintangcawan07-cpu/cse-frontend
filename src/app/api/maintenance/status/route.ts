import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cachedJsonResponse, CACHE_PROFILES } from "@/lib/cache";

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" },
    });

    const isMaintenance = setting?.value === "true";

    const messageSetting = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MESSAGE" },
    });

    return cachedJsonResponse(
      {
        isMaintenance,
        message: messageSetting?.value || "System is undergoing scheduled updates.",
      },
      "PUBLIC_FEED"
    );
  } catch (error) {
    console.error("[MAINTENANCE_STATUS_ERROR]", error);
    return NextResponse.json(
      { isMaintenance: false },
      { status: 500, headers: CACHE_PROFILES.PRIVATE }
    );
  }
}