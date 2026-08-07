// Relative Path: src/app/api/admin/elimination-drills/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSudo } from "@/middleware/requireSudo";
import { softDeleteRecord } from "@/lib/recovery/softDelete";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifyJWT(token);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const drills = await prisma.eliminationDrill.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(drills);
  } catch (error) {
    console.error("[ELIMINATION_DRILLS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch drills" }, { status: 500 });
  }
}

export const DELETE = requireSudo(async (req: NextRequest) => {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Drill ID is required" }, { status: 400 });

    await softDeleteRecord("eliminationDrill", id, "admin");

    return NextResponse.json({ success: true, message: "Drill soft-deleted successfully." });
  } catch (error) {
    console.error("[ELIMINATION_DRILLS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to delete drill" }, { status: 500 });
  }
});