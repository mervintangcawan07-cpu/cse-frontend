// Relative Path: src/app/api/partner/portal/payout/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { decrypt } from "@/lib/crypto/encryption";
import { IdempotencyService, IdempotencyDomainError } from "@/lib/accounting/idempotencyService";
import { PayoutMethod } from "@prisma/client";

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

    const idempotencyKey = IdempotencyService.parseAndValidateIdempotencyKey(request);

    const body = await request.json();
    const { amountPesos, method, accountNumber, accountName, bankName, profileId } = body;

    // 1. Amount validation and normalization
    const numericAmount =
      typeof amountPesos === "number"
        ? amountPesos
        : typeof amountPesos === "string" && amountPesos.trim() !== ""
          ? Number(amountPesos)
          : NaN;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Positive numeric payout amount is required." },
        { status: 400 }
      );
    }

    const requestedAmountCentavos = Math.round(numericAmount * 100);
    if (!Number.isSafeInteger(requestedAmountCentavos) || requestedAmountCentavos <= 0) {
      return NextResponse.json(
        { error: "Valid positive payout amount is required." },
        { status: 400 }
      );
    }

    // 2. Validate profileId
    let normalizedProfileId: string | null = null;
    if (profileId !== undefined && profileId !== null) {
      if (typeof profileId !== "string") {
        return NextResponse.json({ error: "Profile ID must be a string." }, { status: 400 });
      }
      const trimmed = profileId.trim();
      if (trimmed.length === 0) {
        return NextResponse.json({ error: "Profile ID cannot be empty." }, { status: 400 });
      }
      normalizedProfileId = trimmed;
    }

    // 3. Destination mode handling and canonical hashing
    let requestHash: string | null = null;
    let serviceResultPromise: Promise<any>;

    if (normalizedProfileId) {
      // MODE A: Saved profile is authoritative
      if (idempotencyKey) {
        requestHash = IdempotencyService.hashCanonicalPayload({
          requestedAmountCentavos,
          destinationMode: "PROFILE",
          profileId: normalizedProfileId,
        });
      }

      serviceResultPromise = PartnerService.requestPayoutAtomic({
        partnerId: partner.id,
        requestedAmountCentavos,
        profileId: normalizedProfileId,
        idempotencyContext:
          idempotencyKey && requestHash
            ? {
                idempotencyKey,
                requestHash,
              }
            : undefined,
      });
    } else {
      // MODE B: Direct destination validation
      let normalizedMethod: PayoutMethod = PayoutMethod.GCASH;
      if (method !== undefined && method !== null) {
        if (typeof method !== "string") {
          return NextResponse.json({ error: "Payout method must be a string." }, { status: 400 });
        }
        const trimmedMethod = method.trim();
        if (
          !Object.values(PayoutMethod).includes(trimmedMethod as PayoutMethod)
        ) {
          return NextResponse.json(
            { error: `Invalid payout method. Supported methods: ${Object.values(PayoutMethod).join(", ")}.` },
            { status: 400 }
          );
        }
        normalizedMethod = trimmedMethod as PayoutMethod;
      }

      if (typeof accountNumber !== "string" || accountNumber.trim().length === 0) {
        return NextResponse.json({ error: "Valid account number is required." }, { status: 400 });
      }
      const normalizedAccountNumber = accountNumber.trim();

      if (typeof accountName !== "string" || accountName.trim().length === 0) {
        return NextResponse.json({ error: "Valid account name is required." }, { status: 400 });
      }
      const normalizedAccountName = accountName.trim();

      let normalizedBankName: string | null = null;
      if (bankName !== undefined && bankName !== null) {
        if (typeof bankName !== "string") {
          return NextResponse.json({ error: "Bank name must be a string if provided." }, { status: 400 });
        }
        normalizedBankName = bankName.trim() || null;
      }

      if (idempotencyKey) {
        requestHash = IdempotencyService.hashCanonicalPayload({
          requestedAmountCentavos,
          destinationMode: "DIRECT",
          method: normalizedMethod,
          accountNumber: normalizedAccountNumber,
          accountName: normalizedAccountName,
          bankName: normalizedBankName,
        });
      }

      serviceResultPromise = PartnerService.requestPayoutAtomic({
        partnerId: partner.id,
        requestedAmountCentavos,
        method: normalizedMethod,
        accountNumber: normalizedAccountNumber,
        accountName: normalizedAccountName,
        bankName: normalizedBankName,
        idempotencyContext:
          idempotencyKey && requestHash
            ? {
                idempotencyKey,
                requestHash,
              }
            : undefined,
      });
    }

    const result = await serviceResultPromise;

    const responseHeaders: Record<string, string> = {};
    if (result.isReplay) {
      responseHeaders["X-Idempotent-Replay"] = "true";
    }

    return NextResponse.json(
      {
        success: true,
        payoutId: result.payout.id,
        message: result.isReplay
          ? `Payout request for ${formatCentavosToPesos(
              requestedAmountCentavos
            )} replayed from previous successful submission.`
          : `Payout request for ${formatCentavosToPesos(
              requestedAmountCentavos
            )} submitted and funds reserved successfully! Our finance team will review and disburse shortly.`,
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error: any) {
    if (error instanceof IdempotencyDomainError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PARTNER_PORTAL_PAYOUT_ERROR]", error);
    const clientMessage =
      error?.message &&
      !error.message.startsWith("Critical") &&
      !error.message.includes("prisma") &&
      !error.message.includes("crypto")
        ? error.message
        : "Failed to submit payout request";
    return NextResponse.json({ error: clientMessage }, { status: 400 });
  }
}
