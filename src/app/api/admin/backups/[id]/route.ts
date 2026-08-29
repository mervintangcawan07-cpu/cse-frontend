// Relative Path: src/app/api/admin/backups/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { backupStorage } from "@/lib/backup/backupStorage";
import { backupVerificationService } from "@/lib/backup/backupVerification";
import {
  P0_003_RESTORE_DISABLED_CODE,
  P0_003_RESTORE_DISABLED_MESSAGE,
} from "@/lib/backup/backupRestore";
import { getAuthenticatedUser } from "@/lib/serverAuth";

async function authenticateAdmin() {
  const user = await getAuthenticatedUser();
  return user?.role === "ADMIN" ? user : null;
}

// Helper to safely serialize BigInt fields for JSON response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeBackup(backup: any) {
  if (!backup) return backup;
  return {
    ...backup,
    sizeBytes: backup.sizeBytes ? backup.sizeBytes.toString() : "0",
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "verify") {
      const result = await backupVerificationService.verifyBackup(id, {
        actorEmail: admin.email,
      });
      return NextResponse.json({ success: true, verification: result });
    }

    if (action === "protect") {
      const backup = await prisma.backup.findUnique({ where: { id } });
      if (!backup) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      }

      const updated = await prisma.backup.update({
        where: { id },
        data: { protected: !backup.protected },
      });

      await prisma.backupAuditLog.create({
        data: {
          backupId: id,
          action: updated.protected ? "PROTECTED" : "UNPROTECTED",
          actorEmail: admin.email,
          details: `Backup '${backup.filename}' protection toggled to ${updated.protected}.`,
        },
      });

      return NextResponse.json({ success: true, backup: serializeBackup(updated) });
    }

    if (action === "restore") {
      return NextResponse.json(
        {
          success: false,
          code: P0_003_RESTORE_DISABLED_CODE,
          error: P0_003_RESTORE_DISABLED_MESSAGE,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await authenticateAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const backup = await prisma.backup.findUnique({ where: { id } });

    if (!backup) {
      return NextResponse.json({ error: "Backup record not found" }, { status: 404 });
    }

    if (backup.protected) {
      return NextResponse.json(
        { error: "Protected backup cannot be deleted. Unlock it first." },
        { status: 400 }
      );
    }

    // 1. Delete physical payload from storage vault
    await backupStorage.deleteBackup(backup.filename);

    // 2. Remove backup row from database
    await prisma.backup.delete({ where: { id } });

    // 3. Log audit event with backupId set to null (since record was removed)
    await prisma.backupAuditLog.create({
      data: {
        backupId: null,
        action: "DELETED",
        actorEmail: admin.email,
        details: `Deleted backup '${backup.filename}' (Type: ${backup.backupType}, Size: ${backup.sizeBytes} bytes).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Backup '${backup.filename}' deleted successfully.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
