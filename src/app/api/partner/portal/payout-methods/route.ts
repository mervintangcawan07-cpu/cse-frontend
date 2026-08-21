// Relative Path: src/app/api/partner/portal/payout-methods/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const methods = await PartnerService.listPayoutProfiles(partner.id);

    return NextResponse.json({
      success: true,
      methods,
    });
  } catch (error) {
    console.error("[PARTNER_PAYOUT_METHODS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch payout methods" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { method, accountHolderName, accountNumber, bankName, accountType, isDefault } = body;

    if (!method || !accountHolderName || !accountNumber) {
      return NextResponse.json(
        { error: "Method, account holder name, and account number are required." },
        { status: 400 }
      );
    }

    const cleanNumber = String(accountNumber).replace(/[\s-]/g, "");

    // Validation for GCash & Maya
    if (method === "GCASH" || method === "MAYA") {
      if (!cleanNumber.startsWith("09") || cleanNumber.length !== 11) {
        return NextResponse.json(
          { error: `${method === "GCASH" ? "GCash" : "Maya"} mobile number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).` },
          { status: 400 }
        );
      }
    }

    if (method === "BANK_TRANSFER" && !bankName) {
      return NextResponse.json(
        { error: "Bank name is required for bank transfer method." },
        { status: 400 }
      );
    }

    const profile = await PartnerService.addPayoutProfile({
      partnerId: partner.id,
      method,
      accountHolderName,
      accountNumber: cleanNumber,
      bankName,
      accountType,
      isDefault: Boolean(isDefault),
    });

    return NextResponse.json({
      success: true,
      message: `${method} payout account added successfully!`,
      profileId: profile.id,
    });
  } catch (error: any) {
    console.error("[PARTNER_PAYOUT_METHODS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to add payout method" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }

    const updated = await PartnerService.setDefaultPayoutProfile(partner.id, profileId);

    return NextResponse.json({
      success: true,
      message: "Default payout method updated successfully!",
      profile: updated,
    });
  } catch (error: any) {
    console.error("[PARTNER_PAYOUT_METHODS_PATCH_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to set default method" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }

    const profile = await prisma.partnerPayoutProfile.findFirst({
      where: { id: profileId, partnerId: partner.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Payout profile not found" }, { status: 404 });
    }

    await prisma.partnerPayoutProfile.delete({
      where: { id: profileId },
    });

    await PartnerAuditService.logEvent({
      action: "PARTNER_PAYOUT_METHOD_REMOVED",
      partnerId: partner.id,
      metadata: { profileId, method: profile.method },
    });

    return NextResponse.json({
      success: true,
      message: "Payout method removed successfully.",
    });
  } catch (error) {
    console.error("[PARTNER_PAYOUT_METHODS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Failed to remove payout method" }, { status: 500 });
  }
}
