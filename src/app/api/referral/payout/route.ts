// Relative Path: src/app/api/referral/payout/route.ts
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";
import { getClientIp, checkRateLimit, AUTH_LIMITER, createRateLimitResponse } from "@/lib/ratelimit";
import { PayoutMethod } from "@/lib/referral/types";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuthUser(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientIp = getClientIp(request);
    const rateLimitKey = `payout:${user.id}`;
    const rateResult = await checkRateLimit(AUTH_LIMITER, rateLimitKey);
    if (!rateResult.success) {
      return createRateLimitResponse(rateResult, "Too many payout requests. Please wait a moment before trying again.");
    }

    const body = await request.json();
    const { amountPesos, amountCentavos, method, accountNumber, accountName, bankName } = body;

    // Determine requested centavos safely
    let targetCentavos = 0;
    if (typeof amountCentavos === "number" && amountCentavos > 0) {
      targetCentavos = Math.round(amountCentavos);
    } else if (typeof amountPesos === "number" && amountPesos > 0) {
      targetCentavos = Math.round(amountPesos * 100);
    } else {
      return NextResponse.json({ error: "A valid payout amount is required" }, { status: 400 });
    }

    const validMethods: PayoutMethod[] = ["GCASH", "BANK_TRANSFER", "MAYA"];
    if (!method || !validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Invalid payout method. Supported methods: GCASH, BANK_TRANSFER, MAYA." },
        { status: 400 }
      );
    }

    if (!accountNumber || String(accountNumber).trim().length < 4) {
      return NextResponse.json({ error: "Valid account/phone number is required." }, { status: 400 });
    }

    if (!accountName || String(accountName).trim().length < 2) {
      return NextResponse.json({ error: "Account holder full name is required." }, { status: 400 });
    }

    if (method === "BANK_TRANSFER" && (!bankName || String(bankName).trim().length < 2)) {
      return NextResponse.json({ error: "Bank name is required for bank transfers." }, { status: 400 });
    }

    const result = await ReferralService.requestPayout({
      userId: user.id,
      amountCentavos: targetCentavos,
      method: method as PayoutMethod,
      accountNumber: String(accountNumber).trim(),
      accountName: String(accountName).trim(),
      bankName: bankName ? String(bankName).trim() : undefined,
      ipAddress: clientIp,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to submit payout request" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      payoutId: result.payoutId,
      message: "Payout request submitted successfully!",
    });
  } catch (error) {
    console.error("[REFERRAL_PAYOUT_POST_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to process payout request." },
      { status: 500 }
    );
  }
}
