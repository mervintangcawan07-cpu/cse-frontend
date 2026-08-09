// Relative Path: src/app/api/admin/backups/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backupVerificationService } from "@/lib/backup/backupVerification";
import { backupRestoreService } from "@/lib/backup/backupRestore";
import { backupStorage } from "@/lib/backup/backupStorage";

async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("cse_session")?.value;
  if (!token) return null;

  const session = await verifyJWT(token);
  if (!session?.userId) return null;

  const adminUser = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { id: true, email: true, role: true },
  });

  if (adminUser?.role !== "ADMIN") return null;
  return adminUser;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const action = body?.action; // "verify" | "restore" | "protect"

    if (action === "verify") {
      const verification = await backupVerificationService.verifyBackup(id, {
        actorId: admin.id,
        actorEmail: admin.email,
      });
      return NextResponse.json({ success: verification.success, verification });
    }

    if (action === "restore") {
      if (body?.confirmationText !== "RESTORE") {
        return NextResponse.json(
          { error: "Confirmation text must be exactly 'RESTORE'" },
          { status: 400 }
        );
      }

      const restoreResult = await backupRestoreService.restoreFromBackup(id, {
        actorId: admin.id,
        actorEmail: admin.email,
      });

      return NextResponse.json({ success: restoreResult.success, result: restoreResult });
    }

    if (action === "protect") {
      const existing = await prisma.backup.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 });
      }

      const updated = await prisma.backup.update({
        where: { id },
        data: { protected: !existing.protected },
      });

      return NextResponse.json({
        success: true,
        protected: updated.protected,
        message: `Backup protection updated to ${updated.protected}`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Backup action failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    const backup = await prisma.backup.findUnique({ where: { id } });

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    if (backup.protected) {
      return NextResponse.json(
        { error: "Cannot delete a protected backup. Unprotect it first." },
        { status: 400 }
      );
    }

    await backupStorage.deleteBackup(backup.filename);
    await prisma.backup.delete({ where: { id } });

    await prisma.backupAuditLog.create({
      data: {
        backupId: id,
        actorId: admin.id,
        actorEmail: admin.email,
        action: "DELETE_BACKUP",
        status: "SUCCESS",
        details: `Backup '${backup.filename}' manually deleted by admin.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Backup '${backup.filename}' deleted successfully.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete backup";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}