// Relative Path: src/app/api/admin/trash/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { getTrashBinItems, restoreRecord, purgeExpiredRecords } from "@/lib/recovery/softDelete";
import { SupportedEntityType } from "@/types/recovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session || (session.role !== "ADMIN" && session.email !== "mervintangcawan07@gmail.com")) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const items = await getTrashBinItems();
    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[TRASH_GET_ERROR]", err);
    return NextResponse.json({ error: "Failed to fetch trash bin items", details: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session || (session.role !== "ADMIN" && session.email !== "mervintangcawan07@gmail.com")) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const { action, entityType, entityId } = body;

    if (action === "RESTORE" && entityType && entityId) {
      const result = await restoreRecord(entityType as SupportedEntityType, entityId, String(session.email));
      return NextResponse.json(result);
    }

    if (action === "PURGE") {
      const purgeResults = await purgeExpiredRecords(30);
      return NextResponse.json({ success: true, purgeResults });
    }

    return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[TRASH_POST_ERROR]", err);
    return NextResponse.json({ error: "Failed to process trash action", details: err?.message }, { status: 500 });
  }
}