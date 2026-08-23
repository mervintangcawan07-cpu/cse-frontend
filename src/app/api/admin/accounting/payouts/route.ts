// Relative Path: src/app/api/admin/accounting/payouts/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/encryption";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { sendPartnerPayoutProcessedEmail } from "@/lib/email";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";
import { PartnerService } from "@/lib/accounting/partnerService";
import { getSiteUrl } from "@/lib/config/site";

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
      type === "PARTNER"
        ? []
        : prisma.referralPayout.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } } },
          }),
      type === "REFERRAL"
        ? []
        : prisma.partnerPayout.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { partner: { select: { name: true, partnerId: true, code: true, type: true } } },
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
        accountNumber: PartnerService.maskAccountNumber(rawAcc, p.method),
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
        recipientEmailMasked: p.partner?.partnerId || p.partner?.code || "PTR",
        partnerId: p.partner?.partnerId || p.partner?.code,
        amountCentavos: p.amountCentavos,
        formattedAmount: formatCentavosToPesos(p.amountCentavos),
        method: p.method,
        accountName: p.accountName,
        accountNumber: PartnerService.maskAccountNumber(rawAcc, p.method),
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
      // 1. Pre-lock lookup for partnerId
      const preLookup = await prisma.partnerPayout.findUnique({
        where: { id: payoutId },
        select: { partnerId: true },
      });
      if (!preLookup) return NextResponse.json({ error: "Partner payout not found" }, { status: 404 });

      const txResult = await prisma.$transaction(async (tx) => {
        // 🔒 Acquire transaction-scoped advisory lock on partner-finance domain
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`partner-finance:${preLookup.partnerId}`}, 0)
          )::text AS lock_result
        `;

        // 🔍 Re-fetch payout inside lock
        const partnerPayout = await tx.partnerPayout.findUnique({
          where: { id: payoutId },
        });
        if (!partnerPayout) return { success: false, error: "Partner payout not found", status: 404 };

        let newStatus: any = "REQUESTED";
        let auditAction: any = "PARTNER_PAYOUT_APPROVED";
        let allowedPredecessors: any[] = [];

        if (action === "APPROVE") {
          newStatus = "APPROVED";
          auditAction = "PARTNER_PAYOUT_APPROVED";
          allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW"];
        } else if (action === "PROCESSING") {
          newStatus = "PROCESSING";
          auditAction = "PARTNER_PAYOUT_PROCESSING";
          allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED"];
        } else if (action === "REJECT") {
          newStatus = "REJECTED";
          auditAction = "PARTNER_PAYOUT_REJECTED";
          allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED"];
        } else if (action === "FAIL") {
          newStatus = "FAILED";
          auditAction = "PARTNER_PAYOUT_FAILED";
          allowedPredecessors = ["PROCESSING", "APPROVED"];
        } else if (action === "REVERSE") {
          newStatus = "REVERSED";
          auditAction = "PARTNER_PAYOUT_REVERSED";
          allowedPredecessors = ["PAID"];
        } else if (action === "MARK_PAID") {
          newStatus = "PAID";
          auditAction = "PARTNER_PAYOUT_PAID";
          allowedPredecessors = ["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED", "PROCESSING"];
        }

        // Check if already in target state (idempotent success)
        if (partnerPayout.status === newStatus) {
          return { success: true, alreadyProcessed: true, partnerPayout };
        }

        // Check valid predecessor
        if (!allowedPredecessors.includes(partnerPayout.status)) {
          return {
            success: false,
            error: `Cannot perform ${action} on payout currently in status '${partnerPayout.status}'.`,
            status: 400,
          };
        }

        // 🛡️ Backing Revalidation for financial progressions (APPROVE, PROCESSING, MARK_PAID)
        if (["APPROVE", "PROCESSING", "MARK_PAID"].includes(action)) {
          const now = new Date();
          const commissions = await tx.partnerCommission.findMany({
            where: { partnerId: preLookup.partnerId },
          });
          const allPayouts = await tx.partnerPayout.findMany({
            where: { partnerId: preLookup.partnerId },
          });

          let totalValidEarnedCentavos = 0;
          commissions.forEach((c) => {
            if (
              c.status === "AVAILABLE" ||
              c.status === "PAID" ||
              (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
            ) {
              totalValidEarnedCentavos += c.commissionAmountCentavos;
            }
          });

          const FINANCIALLY_CONSUMING_STATUSES: string[] = [
            "REQUESTED",
            "RESERVED",
            "UNDER_REVIEW",
            "APPROVED",
            "PROCESSING",
          ];

          let historicalPaidPayoutCentavos = 0;
          let otherActivePayoutCentavos = 0;

          allPayouts.forEach((p) => {
            if (p.status === "PAID") {
              historicalPaidPayoutCentavos += p.amountCentavos;
            } else if (p.id !== payoutId && FINANCIALLY_CONSUMING_STATUSES.includes(p.status)) {
              otherActivePayoutCentavos += p.amountCentavos;
            }
          });

          const targetPayoutCentavos = partnerPayout.amountCentavos;
          const totalCommittedCentavos =
            historicalPaidPayoutCentavos + targetPayoutCentavos + otherActivePayoutCentavos;

          if (totalCommittedCentavos > totalValidEarnedCentavos) {
            // Log manual-review audit inside tx without throwing
            await tx.accountingAuditLog.create({
              data: {
                action: "PAYOUT_BACKING_CONFLICT_MANUAL_REVIEW_REQUIRED",
                targetType: "PARTNER_PAYOUT",
                targetId: payoutId,
                amountCentavos: targetPayoutCentavos,
                reason: `Backing check failed for action ${action}. Valid earned: ${totalValidEarnedCentavos}, Already paid: ${historicalPaidPayoutCentavos}, Other active commitments: ${otherActivePayoutCentavos}, Target payout: ${targetPayoutCentavos}`,
                metadata: {
                  payoutId,
                  partnerId: preLookup.partnerId,
                  action,
                  totalValidEarnedCentavos,
                  historicalPaidPayoutCentavos,
                  otherActivePayoutCentavos,
                  targetPayoutCentavos,
                  totalCommittedCentavos,
                },
              },
            });

            return {
              success: false,
              error: `Payout lacks sufficient financial backing earnings (Valid earned: ${formatCentavosToPesos(
                totalValidEarnedCentavos
              )}, Already paid: ${formatCentavosToPesos(
                historicalPaidPayoutCentavos
              )}, Other active commitments: ${formatCentavosToPesos(
                otherActivePayoutCentavos
              )}). Action blocked for manual review.`,
              status: 400,
            };
          }
        }

        // Compare-and-Set update
        const updateRes = await tx.partnerPayout.updateMany({
          where: {
            id: payoutId,
            status: { in: allowedPredecessors },
          },
          data: {
            status: newStatus,
            adminNotes: adminNotes || undefined,
            transactionRef: transactionRef || undefined,
            processedBy: user.id,
            processedAt: new Date(),
          },
        });

        if (updateRes.count === 0) {
          return { success: false, error: "Concurrent state change detected. Action aborted.", status: 409 };
        }

        // Audit Log
        await PartnerAuditService.logEvent(
          {
            action: auditAction,
            partnerId: preLookup.partnerId,
            actorId: user.id,
            actorRole: "ADMIN",
            amountCentavos: partnerPayout.amountCentavos,
            reason: adminNotes,
            metadata: { payoutId, action, transactionRef },
          },
          tx
        );

        if (action === "MARK_PAID") {
          await LedgerService.recordPayoutDisbursement(
            {
              payoutId,
              payoutType: "PARTNER",
              recipientId: preLookup.partnerId,
              amountCentavos: partnerPayout.amountCentavos,
              method: partnerPayout.method,
              referenceNumber: transactionRef,
              adminUserId: user.id,
            },
            tx
          );
        }

        return { success: true, partnerPayout, partnerId: preLookup.partnerId };
      });

      if (!txResult.success) {
        return NextResponse.json({ error: txResult.error }, { status: txResult.status || 400 });
      }

      if (!txResult.alreadyProcessed && action === "MARK_PAID") {
        // Fire payout notification email post-commit (non-blocking)
        const partnerRecord = await prisma.partner.findUnique({
          where: { id: preLookup.partnerId },
          select: { name: true, contactEmail: true },
        }).catch(() => null);

        if (partnerRecord?.contactEmail) {
          sendPartnerPayoutProcessedEmail({
            toEmail: partnerRecord.contactEmail,
            partnerName: partnerRecord.name,
            amountPesos: formatCentavosToPesos(txResult.partnerPayout!.amountCentavos),
            payoutMethod: String(txResult.partnerPayout!.method),
            transactionRef: transactionRef || undefined,
            dashboardUrl: `${getSiteUrl()}/partner-portal/payouts`,
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
