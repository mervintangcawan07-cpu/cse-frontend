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

    // 🔒 Interactive transaction with Level 4 User-Entitlement lock and Voucher CAS claim
    const result = await prisma.$transaction(async (tx) => {
      const redemptionNow = new Date();

      // 1. Acquire transaction-scoped advisory lock on user entitlement
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`user-entitlement:${user.id}`}, 0)
        )::text AS lock_result
      `;

      // 2. Fetch voucher code and batch under transaction
      const voucherCode = await tx.institutionalVoucherCode.findUnique({
        where: { code: cleanCode },
        include: { batch: true },
      });

      if (!voucherCode) {
        return {
          status: 404,
          payload: { error: "Invalid voucher code. Please check and try again." },
        };
      }

      // 3. Idempotent check: already redeemed by current user
      if (voucherCode.status === "REDEEMED" && voucherCode.redeemedBy === user.id) {
        return {
          status: 200,
          payload: {
            success: true,
            message: "You already redeemed this voucher. Your access is active.",
            accessUntil: voucherCode.accessUntil ? voucherCode.accessUntil.toISOString() : null,
          },
        };
      }

      // 4. Status validations
      if (voucherCode.status === "REDEEMED") {
        return {
          status: 409,
          payload: { error: "This voucher code has already been used." },
        };
      }

      if (voucherCode.status === "REVOKED") {
        return {
          status: 410,
          payload: { error: "This voucher code has been revoked and is no longer valid." },
        };
      }

      if (voucherCode.batch.expiresAt && redemptionNow > voucherCode.batch.expiresAt) {
        return {
          status: 410,
          payload: { error: "This voucher batch has expired and can no longer be redeemed." },
        };
      }

      if (voucherCode.batch.status !== "ACTIVE") {
        return {
          status: 410,
          payload: { error: "This voucher is from an inactive or fully-redeemed batch." },
        };
      }

      // 5. Atomic VoucherCode Compare-and-Set claim
      const claimResult = await tx.institutionalVoucherCode.updateMany({
        where: {
          id: voucherCode.id,
          status: "UNUSED",
        },
        data: {
          status: "REDEEMED",
          redeemedBy: user.id,
          redeemedAt: redemptionNow,
        },
      });

      if (claimResult.count !== 1) {
        // Collision race: another concurrent request claimed the code
        const recheck = await tx.institutionalVoucherCode.findUnique({
          where: { id: voucherCode.id },
        });

        if (recheck?.status === "REDEEMED" && recheck.redeemedBy === user.id) {
          return {
            status: 200,
            payload: {
              success: true,
              message: "You already redeemed this voucher. Your access is active.",
              accessUntil: recheck.accessUntil ? recheck.accessUntil.toISOString() : null,
            },
          };
        }

        return {
          status: 409,
          payload: { error: "This voucher code has already been used." },
        };
      }

      // 6. Authoritative conditional batch increment
      const batchUpdateResult = await tx.institutionalVoucherBatch.updateMany({
        where: {
          id: voucherCode.batchId,
          status: "ACTIVE",
          redeemedCount: { lt: voucherCode.batch.totalCodes },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: redemptionNow } },
          ],
        },
        data: {
          redeemedCount: { increment: 1 },
        },
      });

      if (batchUpdateResult.count !== 1) {
        // Critical: Abort transaction to completely rollback the voucher code CAS claim!
        throw new Error("BATCH_ELIGIBILITY_CONFLICT");
      }

      // 7. Fresh locked user read and stacked entitlement calculation
      const freshUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, isPaid: true, paidUntil: true },
      });

      const durationDays = voucherCode.batch.durationDays || 365;
      const baseDate =
        freshUser?.isPaid && freshUser.paidUntil && freshUser.paidUntil > redemptionNow
          ? new Date(freshUser.paidUntil)
          : new Date(redemptionNow);

      const accessUntil = new Date(baseDate);
      accessUntil.setDate(accessUntil.getDate() + durationDays);

      // 8. Update User entitlement
      await tx.user.update({
        where: { id: user.id },
        data: {
          isPaid: true,
          paidUntil: accessUntil,
          planType: voucherCode.batch.planType || "ANNUAL",
        },
      });

      // 9. Persist accessUntil on the voucher code
      await tx.institutionalVoucherCode.update({
        where: { id: voucherCode.id },
        data: { accessUntil },
      });

      // 10. Check post-increment batch state for conditional FULLY_REDEEMED transition
      const freshBatch = await tx.institutionalVoucherBatch.findUnique({
        where: { id: voucherCode.batchId },
        select: { redeemedCount: true, totalCodes: true, status: true },
      });

      if (
        freshBatch &&
        freshBatch.redeemedCount >= freshBatch.totalCodes &&
        freshBatch.status === "ACTIVE"
      ) {
        await tx.institutionalVoucherBatch.updateMany({
          where: {
            id: voucherCode.batchId,
            status: "ACTIVE",
            redeemedCount: { gte: freshBatch.totalCodes },
          },
          data: { status: "FULLY_REDEEMED" },
        });
      }

      // 11. Optional activity log inside transaction
      const maskedCode = cleanCode.length > 8
        ? `${cleanCode.substring(0, 4)}...${cleanCode.substring(cleanCode.length - 4)}`
        : cleanCode;

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "VOUCHER_REDEEMED",
          metadata: JSON.stringify({
            batchId: voucherCode.batchId,
            batchRef: voucherCode.batch.batchRef,
            durationDays,
            accessUntil: accessUntil.toISOString(),
            codeMasked: maskedCode,
          }),
        },
      }).catch((err) => console.error("[VOUCHER_ACTIVITY_LOG_ERROR]", err));

      return {
        status: 200,
        payload: {
          success: true,
          message: `Voucher redeemed! Your premium access is now active until ${accessUntil.toLocaleDateString(
            "en-PH",
            { year: "numeric", month: "long", day: "numeric" }
          )}.`,
          accessUntil: accessUntil.toISOString(),
          planType: voucherCode.batch.planType,
          durationDays,
        },
      };
    });

    return NextResponse.json(result.payload, { status: result.status });
  } catch (error: any) {
    if (error?.message === "BATCH_ELIGIBILITY_CONFLICT") {
      // Transaction was safely rolled back; determine specific batch reason
      return NextResponse.json(
        { error: "This voucher is from an inactive, expired, or fully-redeemed batch." },
        { status: 410 }
      );
    }

    console.error("[VOUCHER_REDEEM_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to redeem voucher. Please try again." },
      { status: 500 }
    );
  }
}
