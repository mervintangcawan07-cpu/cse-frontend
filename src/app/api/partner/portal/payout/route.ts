// Relative Path: src/app/api/partner/portal/payout/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { decrypt } from "@/lib/crypto/encryption";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [overview, payouts, savedMethods] = await Promise.all([
      PartnerService.getPartnerFinancialOverview(partner.id),
      prisma.partnerPayout.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: "desc" },
      }),
      PartnerService.listPayoutProfiles(partner.id),
    ]);

    const formattedPayouts = payouts.map((p) => {
      let rawAcc = "";
      try {
        rawAcc = decrypt(p.accountNumberEncrypted) || p.accountNumberEncrypted;
      } catch {
        rawAcc = p.accountNumberEncrypted;
      }

      return {
        id: p.id,
        date: p.createdAt.toISOString(),
        amountCentavos: p.amountCentavos,
        formattedAmount: formatCentavosToPesos(p.amountCentavos),
        method: p.method,
        accountName: p.accountName,
        accountNumberMasked: PartnerService.maskAccountNumber(rawAcc, p.method),
        bankName: p.bankName,
        status: p.status,
        adminNotes: p.adminNotes,
        transactionRef: p.transactionRef,
      };
    });

    return NextResponse.json({
      success: true,
      metrics: overview.metrics,
      savedMethods,
      payouts: formattedPayouts,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_PAYOUT_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch payout data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amountPesos, method, accountNumber, accountName, bankName, profileId } = body;

    if (!amountPesos || (!profileId && (!method || !accountNumber || !accountName))) {
      return NextResponse.json(
        { error: "Amount and payout destination details are required." },
        { status: 400 }
      );
    }

    const requestedAmountCentavos = Math.round(Number(amountPesos) * 100);

    if (requestedAmountCentavos <= 0) {
      return NextResponse.json({ error: "Invalid payout amount." }, { status: 400 });
    }

    const result = await PartnerService.requestPayoutAtomic({
      partnerId: partner.id,
      requestedAmountCentavos,
      method: method || "GCASH",
      accountNumber,
      accountName,
      bankName,
      profileId,
    });

    return NextResponse.json({
      success: true,
      payoutId: result.payout.id,
      message: `Payout request for ${formatCentavosToPesos(
        requestedAmountCentavos
      )} submitted and funds reserved successfully! Our finance team will review and disburse shortly.`,
    });
  } catch (error: any) {
    console.error("[PARTNER_PORTAL_PAYOUT_ERROR]", error);
    const clientMessage =
      error?.message && !error.message.startsWith("Critical")
        ? error.message
        : "Failed to submit payout request";
    return NextResponse.json({ error: clientMessage }, { status: 400 });
  }
}
