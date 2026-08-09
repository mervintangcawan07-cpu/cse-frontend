// Relative Path: src/app/api/admin/backups/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backupService } from "@/lib/backup/backupService";
import { backupHealthMonitor } from "@/lib/backup/backupHealth";

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

export async function GET() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const [backups, auditLogs, health] = await Promise.all([
      prisma.backup.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.backupAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      backupHealthMonitor.getHealthReport(),
    ]);

    const formattedBackups = backups.map((b) => ({
      ...b,
      sizeBytes: b.sizeBytes ? b.sizeBytes.toString() : "0",
    }));

    return NextResponse.json({
      success: true,
      health,
      backups: formattedBackups,
      auditLogs,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch backups";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const admin = await verifyAdminAuth();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const result = await backupService.createBackup("MANUAL", {
      actorId: admin.id,
      actorEmail: admin.email,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Manual database backup created successfully.",
      backup: result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to trigger manual backup";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}