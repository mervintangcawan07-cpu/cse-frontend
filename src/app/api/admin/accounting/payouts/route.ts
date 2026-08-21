// Relative Path: src/app/api/admin/accounting/payouts/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/encryption";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { sendPartnerPayoutProcessedEmail } from "@/lib/email";


export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || "ALL";

    const where: any = {};
    if (status && status !== "ALL") where.status = status;

    const [referralPayouts, partnerPayouts] = await Promise.all([
      type === "PARTNER" ? [] : prisma.referralPayout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      type === "REFERRAL" ? [] : prisma.partnerPayout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { partner: { select: { name: true, code: true, type: true } } },
      }),
    ]);

    const formattedReferral = referralPayouts.map((p) => {
      let rawAcc = "";
      try {
        rawAcc = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
      } catch {
        rawAcc = "******";
      }
      return {
        id: p.id,
        payoutType: "REFERRAL",
        recipientName: p.user?.name || "Student",
        recipientEmailMasked: p.user?.email ? p.user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "—",
        amountCentavos: p.amountCentavos,
        formattedAmount: formatCentavosToPesos(p.amountCentavos),
        method: p.method,
        accountName: p.accountName,
        accountNumber: rawAcc,
        bankName: p.bankName,
        status: p.status,
        adminNotes: p.adminNotes,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt.toISOString(),
      };
    });

    const formattedPartner = partnerPayouts.map((p) => {
      let rawAcc = "";
      try {
        rawAcc = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
      } catch {
        rawAcc = "******";
      }
      return {
        id: p.id,
        payoutType: "PARTNER",
        recipientName: p.partner?.name || "Partner",
        recipientEmailMasked: p.partner?.code || "PTR",
        amountCentavos: p.amountCentavos,
        formattedAmount: formatCentavosToPesos(p.amountCentavos),
        method: p.method,
        accountName: p.accountName,
        accountNumber: rawAcc,
        bankName: p.bankName,
        status: p.status,
        adminNotes: p.adminNotes,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt.toISOString(),
      };
    });

    const combined = [...formattedReferral, ...formattedPartner].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      total: combined.length,
      payouts: combined,
    });
  } catch (error) {
    console.error("[ADMIN_ACCOUNTING_PAYOUTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch payouts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { payoutId, payoutType, action, adminNotes, transactionRef } = body;

    if (!payoutId || !payoutType || !action) {
      return NextResponse.json({ error: "payoutId, payoutType, and action are required" }, { status: 400 });
    }

    if (payoutType === "REFERRAL") {
      const { ReferralService } = await import("@/lib/referral/referralService");
      const res = await ReferralService.adminProcessPayout({
        payoutId,
        action,
        adminNotes,
        transactionRef,
        adminUserId: user.id,
      });
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
    } else {
      // Partner Payout
      const partnerPayout = await prisma.partnerPayout.findUnique({
        where: { id: payoutId },
      });
      if (!partnerPayout) return NextResponse.json({ error: "Partner payout not found" }, { status: 404 });

      let newStatus: any = "REQUESTED";
      if (action === "APPROVE") newStatus = "APPROVED";
      else if (action === "REJECT") newStatus = "REJECTED";
      else if (action === "MARK_PAID") newStatus = "PAID";

      await prisma.partnerPayout.update({
        where: { id: payoutId },
        data: {
          status: newStatus,
          adminNotes: adminNotes || undefined,
          transactionRef: transactionRef || undefined,
          processedBy: user.id,
          processedAt: new Date(),
        },
      });

      if (action === "MARK_PAID") {
        await LedgerService.recordPayoutDisbursement({
          payoutId,
          payoutType: "PARTNER",
          recipientId: partnerPayout.partnerId,
          amountCentavos: partnerPayout.amountCentavos,
          method: partnerPayout.method,
          referenceNumber: transactionRef,
          adminUserId: user.id,
        });

        // Fire payout notification email (non-blocking)
        const partnerRecord = await prisma.partner.findUnique({
          where: { id: partnerPayout.partnerId },
          select: { name: true, contactEmail: true },
        }).catch(() => null);

        if (partnerRecord?.contactEmail) {
          sendPartnerPayoutProcessedEmail({
            toEmail: partnerRecord.contactEmail,
            partnerName: partnerRecord.name,
            amountPesos: formatCentavosToPesos(partnerPayout.amountCentavos),
            payoutMethod: String(partnerPayout.method),
            transactionRef: transactionRef || undefined,
          }).catch((err) => console.error("[PARTNER_PAYOUT_EMAIL_ERROR]", err));
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payout successfully updated: ${action}`,
    });
  } catch (error) {
    console.error("[ADMIN_ACCOUNTING_PAYOUTS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to process payout" }, { status: 500 });
  }
}
