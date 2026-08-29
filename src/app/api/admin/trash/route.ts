// Relative Path: src/app/api/admin/trash/route.ts
import { NextResponse } from "next/server";
import { getAuthenticatedSessionResult } from "@/lib/serverAuth";
import { getTrashBinItems, restoreRecord, purgeExpiredRecords } from "@/lib/recovery/softDelete";
import { SupportedEntityType } from "@/types/recovery";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      (authentication.session.user.role !== "ADMIN" &&
        authentication.session.user.email !== "mervintangcawan07@gmail.com")
    ) {
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
    const authentication = await getAuthenticatedSessionResult();
    if (!authentication.authenticated && authentication.code === "NO_TOKEN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !authentication.authenticated ||
      (authentication.session.user.role !== "ADMIN" &&
        authentication.session.user.email !== "mervintangcawan07@gmail.com")
    ) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await request.json();
    const { action, entityType, entityId } = body;

    if (action === "RESTORE" && entityType && entityId) {
      const result = await restoreRecord(
        entityType as SupportedEntityType,
        entityId,
        authentication.session.user.email
      );
      return NextResponse.json(result);
    }

    if (action === "PURGE") {
      const purgeResults = await purgeExpiredRecords(30);
      const userPurgeResult = purgeResults.find((result) => result.entityType === "user");

      return NextResponse.json({
        success: true,
        userHardPurgeDisabled: userPurgeResult?.disabled === true,
        code: userPurgeResult?.code,
        message:
          "Expired non-User records were processed. Physical User purge is disabled.",
        purgeResults,
      });
    }

    return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[TRASH_POST_ERROR]", err);
    return NextResponse.json({ error: "Failed to process trash action", details: err?.message }, { status: 500 });
  }
}
