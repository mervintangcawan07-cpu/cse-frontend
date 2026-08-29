// Relative Path: src/app/api/admin/db-storage/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { checkDbStorageAndNotify } from "@/lib/dbStorageMonitor";

export async function GET() {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      authentication.session.user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const metrics = await checkDbStorageAndNotify();

    if (!metrics) {
      return NextResponse.json({ error: "Failed to query database metrics" }, { status: 500 });
    }

    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    console.error("[ADMIN_DB_STORAGE_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
