// Relative Path: src/app/api/admin/accounting/vouchers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/serverAuth";
import { nanoid } from "nanoid";

// ─── GET: List all voucher batches ──────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const batches = await prisma.institutionalVoucherBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { codes: true } },
        codes: {
          where: { status: "REDEEMED" },
          select: { id: true },
        },
      },
    });

    const result = batches.map((b) => ({
      id: b.id,
      batchRef: b.batchRef,
      institutionName: b.institutionName,
      contactName: b.contactName,
      contactEmail: b.contactEmail,
      planType: b.planType,
      durationDays: b.durationDays,
      totalCodes: b.totalCodes,
      redeemedCount: b.redeemedCount,
      unusedCount: b.totalCodes - b.redeemedCount,
      status: b.status,
      expiresAt: b.expiresAt?.toISOString() || null,
      createdAt: b.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, total: result.length, batches: result });
  } catch (error) {
    console.error("[ADMIN_VOUCHER_BATCHES_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch voucher batches." }, { status: 500 });
  }
}

// ─── POST: Generate a new voucher batch ─────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      institutionName,
      contactName,
      contactEmail,
      planType = "ANNUAL",
      durationDays = 365,
      quantity,
      pricePerCodeCentavos = 0,
      expiresAt,
      notes,
    } = body;

    if (!institutionName || !quantity || quantity < 1 || quantity > 10000) {
      return NextResponse.json(
        { error: "institutionName and quantity (1–10000) are required." },
        { status: 400 }
      );
    }

    // Generate a unique batch reference
    const prefix = institutionName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 6);
    const year = new Date().getFullYear();
    const batchRef = `BATCH-${prefix}-${year}-${nanoid(4).toUpperCase()}`;

    // Generate individual codes: PREFIX-XXXX-9999
    const codes: string[] = [];
    const seen = new Set<string>();
    while (codes.length < quantity) {
      const raw = `${prefix.substring(0, 3)}-${nanoid(4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!seen.has(raw)) {
        seen.add(raw);
        codes.push(raw);
      }
    }

    const batch = await prisma.institutionalVoucherBatch.create({
      data: {
        batchRef,
        institutionName: institutionName.trim(),
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        planType,
        durationDays: Number(durationDays),
        totalCodes: quantity,
        pricePerCodeCentavos: Number(pricePerCodeCentavos),
        status: "ACTIVE",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes?.trim() || null,
        createdBy: user.id,
        codes: {
          create: codes.map((code) => ({ code })),
        },
      },
      include: {
        _count: { select: { codes: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Batch "${batchRef}" created with ${quantity} voucher codes.`,
      batch: {
        id: batch.id,
        batchRef: batch.batchRef,
        institutionName: batch.institutionName,
        planType: batch.planType,
        totalCodes: batch.totalCodes,
        status: batch.status,
        codes,
      },
    });
  } catch (error: any) {
    console.error("[ADMIN_VOUCHER_BATCH_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create voucher batch." },
      { status: 500 }
    );
  }
}
