// Relative Path: src/app/api/referral/payout/route.ts
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";
import { getClientIp, checkRateLimit, AUTH_LIMITER, createRateLimitResponse } from "@/lib/ratelimit";
import { PayoutMethod } from "@/lib/referral/types";
import { IdempotencyService, IdempotencyDomainError } from "@/lib/accounting/idempotencyService";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuthUser(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idempotencyKey = IdempotencyService.parseAndValidateIdempotencyKey(request);

    const clientIp = getClientIp(request);
    const rateLimitKey = `payout:${user.id}`;
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many payout requests. Please wait a moment before trying again.");
    }

    const body = await request.json();
    const { amountPesos, amountCentavos, method, accountNumber, accountName, bankName } = body;

    // 1. Amount input validation & normalization
    let centavosFromRawCentavos: number | null = null;
    if (amountCentavos !== undefined && amountCentavos !== null) {
      if (
        typeof amountCentavos !== "number" ||
        !Number.isFinite(amountCentavos) ||
        !Number.isSafeInteger(amountCentavos) ||
        amountCentavos <= 0
      ) {
        return NextResponse.json(
          { error: "amountCentavos must be a positive integer without fractions." },
          { status: 400 }
        );
      }
      centavosFromRawCentavos = amountCentavos;
    }

    let centavosFromPesos: number | null = null;
    if (amountPesos !== undefined && amountPesos !== null) {
      if (
        typeof amountPesos !== "number" ||
        !Number.isFinite(amountPesos) ||
        amountPesos <= 0
      ) {
        return NextResponse.json(
          { error: "amountPesos must be a positive number." },
          { status: 400 }
        );
      }
      const converted = Math.round(amountPesos * 100);
      if (!Number.isSafeInteger(converted) || converted <= 0) {
        return NextResponse.json(
          { error: "amountPesos results in an invalid centavo amount." },
          { status: 400 }
        );
      }
      centavosFromPesos = converted;
    }

    let targetCentavos: number;
    if (centavosFromRawCentavos !== null && centavosFromPesos !== null) {
      if (centavosFromRawCentavos !== centavosFromPesos) {
        return NextResponse.json(
          { error: "Conflicting payout amount fields." },
          { status: 400 }
        );
      }
      targetCentavos = centavosFromRawCentavos;
    } else if (centavosFromRawCentavos !== null) {
      targetCentavos = centavosFromRawCentavos;
    } else if (centavosFromPesos !== null) {
      targetCentavos = centavosFromPesos;
    } else {
      return NextResponse.json(
        { error: "A valid positive payout amount is required." },
        { status: 400 }
      );
    }

    // 2. Payout method validation
    const validMethods: PayoutMethod[] = ["GCASH", "BANK_TRANSFER", "MAYA"];
    if (typeof method !== "string" || !validMethods.includes(method as PayoutMethod)) {
      return NextResponse.json(
        { error: "Invalid payout method. Supported methods: GCASH, BANK_TRANSFER, MAYA." },
        { status: 400 }
      );
    }
    const normalizedMethod = method as PayoutMethod;

    // 3. Destination strings validation and normalization
    if (typeof accountNumber !== "string" || accountNumber.trim().length < 4) {
      return NextResponse.json({ error: "Valid account/phone number is required." }, { status: 400 });
    }
    const normalizedAccountNumber = accountNumber.trim();

    if (typeof accountName !== "string" || accountName.trim().length < 2) {
      return NextResponse.json({ error: "Account holder full name is required." }, { status: 400 });
    }
    const normalizedAccountName = accountName.trim();

    let normalizedBankName: string | null = null;
    if (bankName !== undefined && bankName !== null) {
      if (typeof bankName !== "string") {
        return NextResponse.json({ error: "Bank name must be a string if provided." }, { status: 400 });
      }
      normalizedBankName = bankName.trim() || null;
    }

    if (normalizedMethod === "BANK_TRANSFER" && (!normalizedBankName || normalizedBankName.length < 2)) {
      return NextResponse.json({ error: "Bank name is required for bank transfers." }, { status: 400 });
    }

    // 4. Canonical request hash
    const requestHash = idempotencyKey
      ? IdempotencyService.hashCanonicalPayload({
          amountCentavos: targetCentavos,
          method: normalizedMethod,
          accountNumber: normalizedAccountNumber,
          accountName: normalizedAccountName,
          bankName: normalizedBankName,
        })
      : null;

    // 5. Service execution
    const result = await ReferralService.requestPayout({
      userId: user.id,
      amountCentavos: targetCentavos,
      method: normalizedMethod,
      accountNumber: normalizedAccountNumber,
      accountName: normalizedAccountName,
      bankName: normalizedBankName ?? undefined,
      ipAddress: clientIp,
      idempotencyContext:
        idempotencyKey && requestHash
          ? {
              idempotencyKey,
              requestHash,
            }
          : undefined,
    });

    if (!result.success) {
      const status = result.status || 400;
      return NextResponse.json({ error: result.error || "Failed to submit payout request" }, { status });
    }

    const responseHeaders: Record<string, string> = {};
    if (result.isReplay) {
      responseHeaders["X-Idempotent-Replay"] = "true";
    }

    return NextResponse.json(
      {
        success: true,
        payoutId: result.payoutId,
        message: result.isReplay
          ? "Payout request replayed from previous successful submission."
          : "Payout request submitted successfully!",
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
    console.error("[REFERRAL_PAYOUT_POST_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process payout request." },
      { status: 500 }
    );
  }
}
