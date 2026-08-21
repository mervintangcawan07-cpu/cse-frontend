// Relative Path: src/app/api/admin/referrals/payouts/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { ReferralService } from "@/lib/referral/referralService";
import { getClientIp } from "@/lib/ratelimit";
import { decrypt } from "@/lib/crypto/encryption";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const [total, payouts] = await Promise.all([
      prisma.referralPayout.count({ where }),
      prisma.referralPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    const formatted = payouts.map((p) => {
      let rawNumber = "";
      try {
        rawNumber = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
      } catch {
        rawNumber = "******";
      }

      return {
        id: p.id,
        user: p.user,
        amountCentavos: p.amountCentavos,
        currency: p.currency,
        method: p.method,
        accountName: p.accountName,
        accountNumber: rawNumber,
        bankName: p.bankName,
        status: p.status,
        adminNotes: p.adminNotes,
        transactionRef: p.transactionRef,
        processedBy: p.processedBy,
        processedAt: p.processedAt?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: formatted,
    });
  } catch (error) {
    console.error("[ADMIN_PAYOUTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { payoutId, action, adminNotes, transactionRef } = body;

    if (!payoutId || !action) {
      return NextResponse.json({ error: "payoutId and action are required" }, { status: 400 });
    }

    const validActions = ["APPROVE", "REJECT", "MARK_PAID"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const result = await ReferralService.adminProcessPayout({
      payoutId,
      action,
      adminNotes,
      transactionRef,
      adminUserId: user.id,
      clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Action failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Payout successfully updated: ${action}`,
    });
  } catch (error) {
    console.error("[ADMIN_PAYOUTS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update payout" }, { status: 500 });
  }
}
