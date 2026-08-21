// Relative Path: src/app/api/partner/portal/payout/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto/encryption";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function POST(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amountPesos, method, accountNumber, accountName, bankName } = body;

    if (!amountPesos || !method || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "Amount, method, account holder name, and account number are required." },
        { status: 400 }
      );
    }

    const requestedAmountCentavos = Math.round(Number(amountPesos) * 100);

    if (requestedAmountCentavos <= 0) {
      return NextResponse.json({ error: "Invalid payout amount." }, { status: 400 });
    }

    const minPayout = partner.minPayoutCentavos || 15000;
    if (requestedAmountCentavos < minPayout) {
      return NextResponse.json(
        {
          error: `Requested amount is below the minimum payout threshold of ${formatCentavosToPesos(
            minPayout
          )}.`,
        },
        { status: 400 }
      );
    }

    const now = new Date();

    // Calculate live available balance
    const [commissions, existingPayouts] = await Promise.all([
      prisma.partnerCommission.findMany({
        where: { partnerId: partner.id },
      }),
      prisma.partnerPayout.findMany({
        where: { partnerId: partner.id },
      }),
    ]);

    let availableCentavos = 0;
    commissions.forEach((c) => {
      if (
        c.status === "AVAILABLE" ||
        (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now)
      ) {
        availableCentavos += c.commissionAmountCentavos;
      }
    });

    let alreadyReservedOrPaidCentavos = 0;
    existingPayouts.forEach((p) => {
      if (p.status === "PAID" || p.status === "REQUESTED" || p.status === "APPROVED") {
        alreadyReservedOrPaidCentavos += p.amountCentavos;
      }
    });

    const trueAvailableCentavos = Math.max(0, availableCentavos - alreadyReservedOrPaidCentavos);

    if (requestedAmountCentavos > trueAvailableCentavos) {
      return NextResponse.json(
        {
          error: `Insufficient available balance. You currently have ${formatCentavosToPesos(
            trueAvailableCentavos
          )} available for withdrawal.`,
        },
        { status: 400 }
      );
    }

    // Encrypt account number
    const encryptedAcc = encrypt(String(accountNumber).trim()) || String(accountNumber).trim();

    const payout = await prisma.partnerPayout.create({
      data: {
        partnerId: partner.id,
        amountCentavos: requestedAmountCentavos,
        currency: "PHP",
        method: method || "GCASH",
        accountNumberEncrypted: encryptedAcc,
        accountName: String(accountName).trim(),
        bankName: bankName ? String(bankName).trim() : null,
        status: "REQUESTED",
      },
    });

    return NextResponse.json({
      success: true,
      payoutId: payout.id,
      message: `Payout request for ${formatCentavosToPesos(
        requestedAmountCentavos
      )} submitted successfully! Our finance team will review and disburse within 1-2 business days.`,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_PAYOUT_ERROR]", error);
    return NextResponse.json({ error: "Failed to submit payout request" }, { status: 500 });
  }
}
