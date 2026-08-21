// Relative Path: src/app/api/referral/validate-code/route.ts
import { NextResponse } from "next/server";
import { ReferralService } from "@/lib/referral/referralService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "";

    const validation = await ReferralService.validateReferralCode(code);
    return NextResponse.json(validation);
  } catch (error) {
    console.error("[VALIDATE_REFERRAL_CODE_ERROR]", error);
    return NextResponse.json(
      { isValid: false, code: "", error: "Failed to validate referral code" },
      { status: 500 }
    );
  }
}
