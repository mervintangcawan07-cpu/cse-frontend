import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      maintenanceMode: false,
      allowedRoles: ["ADMIN"],
    });
  } catch (error) {
    console.error("[ADMIN_MAINTENANCE_ERROR]", error);
    return NextResponse.json(
      { maintenanceMode: false, allowedRoles: ["ADMIN"], error: "Failed to read maintenance configuration." },
      { status: 500 }
    );
  }
}
