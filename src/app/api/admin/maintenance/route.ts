import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAdminAuth(request);
  if (errorResponse) return errorResponse;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    status: "operational",
    maintenance: false,
    maintenanceMode: false,
    allowedRoles: ["ADMIN"],
  });
}
