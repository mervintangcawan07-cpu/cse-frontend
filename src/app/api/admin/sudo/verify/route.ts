// Relative Path: src/app/api/admin/sudo/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { handleSudoElevation } from "@/routes/admin/criticalActions";

export async function POST(req: NextRequest) {
  return handleSudoElevation(req);
}