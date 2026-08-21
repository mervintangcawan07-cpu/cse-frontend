// Relative Path: src/app/api/vouchers/redeem/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/serverAuth";

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAuthUser(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || code.trim().length < 4) {
      return NextResponse.json(
        { error: "A valid voucher code is required." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    const voucherCode = await prisma.institutionalVoucherCode.findUnique({
      where: { code: cleanCode },
      include: { batch: true },
    });

    if (!voucherCode) {
      return NextResponse.json(
        { error: "Invalid voucher code. Please check and try again." },
        { status: 404 }
      );
    }

    // Idempotent: already redeemed by this user
    if (voucherCode.status === "REDEEMED" && voucherCode.redeemedBy === user.id) {
      return NextResponse.json({
        success: true,
        message: "You already redeemed this voucher. Your access is active.",
        accessUntil: voucherCode.accessUntil,
      });
    }

    if (voucherCode.status === "REDEEMED") {
      return NextResponse.json(
        { error: "This voucher code has already been used." },
        { status: 409 }
      );
    }

    if (voucherCode.status === "REVOKED") {
      return NextResponse.json(
        { error: "This voucher code has been revoked and is no longer valid." },
        { status: 410 }
      );
    }

    if (voucherCode.batch.expiresAt && new Date() > voucherCode.batch.expiresAt) {
      return NextResponse.json(
        { error: "This voucher batch has expired and can no longer be redeemed." },
        { status: 410 }
      );
    }

    if (voucherCode.batch.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This voucher is from an inactive or fully-redeemed batch." },
        { status: 410 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isPaid: true, paidUntil: true },
    });

    const durationDays = voucherCode.batch.durationDays || 365;
    const now = new Date();
    const baseDate =
      dbUser?.isPaid && dbUser.paidUntil && dbUser.paidUntil > now
        ? dbUser.paidUntil
        : now;

    const accessUntil = new Date(baseDate);
    accessUntil.setDate(accessUntil.getDate() + durationDays);

    const willBeFullyRedeemed =
      voucherCode.batch.redeemedCount + 1 >= voucherCode.batch.totalCodes;

    await prisma.$transaction([
      prisma.institutionalVoucherCode.update({
        where: { id: voucherCode.id },
        data: {
          status: "REDEEMED",
          redeemedBy: user.id,
          redeemedAt: now,
          accessUntil,
        },
      }),
      prisma.institutionalVoucherBatch.update({
        where: { id: voucherCode.batchId },
        data: {
          redeemedCount: { increment: 1 },
          status: willBeFullyRedeemed ? "FULLY_REDEEMED" : voucherCode.batch.status,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          isPaid: true,
          paidUntil: accessUntil,
          planType: voucherCode.batch.planType || "ANNUAL",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Voucher redeemed! Your premium access is now active until ${accessUntil.toLocaleDateString(
        "en-PH",
        { year: "numeric", month: "long", day: "numeric" }
      )}.`,
      accessUntil: accessUntil.toISOString(),
      planType: voucherCode.batch.planType,
      durationDays,
    });
  } catch (error: any) {
    console.error("[VOUCHER_REDEEM_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to redeem voucher. Please try again." },
      { status: 500 }
    );
  }
}
