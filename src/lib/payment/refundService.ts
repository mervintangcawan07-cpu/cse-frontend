// Relative Path: src/lib/payment/refundService.ts
import { isExactPayMongoPaymentIdListRejection } from "@/lib/payment/refundHistorySafety";
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";
import { ReconciliationService } from "@/lib/accounting/reconciliationService";

export interface PayMongoRefundResource {
  id: string; // ref_...
  type: string; // refund
  attributes: {
    amount: number; // integer centavos
    currency: string; // PHP
    status: string; // succeeded, pending, processing, failed
    payment_id: string; // pay_...
    reason?: string;
    created_at?: number;
    updated_at?: number;
  };
}

export interface PayMongoCheckoutSessionResource {
  id: string; // cs_...
  type: string; // checkout_session
  attributes: {
    status?: string;
    amount?: number;
    payment_intent?: {
      id?: string;
      attributes?: {
        status?: string;
      };
    };
    payments?: PayMongoPaymentResource[];
    metadata?: Record<string, any>;
  };
}

export interface PayMongoPaymentResource {
  id: string; // pay_...
  type: string; // payment
  attributes: {
    amount: number; // original customer-paid payment amount in centavos
    currency: string;
    status: string; // pending, failed, paid
    fee?: number; // authoritative PayMongo processing fee in centavos
    net_amount?: number; // settlement amount after PayMongo fee
    created_at?: number; // PayMongo Unix timestamp in seconds
    source?: {
      id?: string;
      type?: string; // card, gcash, paymaya, qrph
      attributes?: Record<string, any>;
    };
    payment_intent_id?: string;
    payment_intent?: { id: string };
    refunds?: PayMongoRefundResource[];
    metadata?: Record<string, any>;
  };
}

export interface RefundProcessingOutcome {
  success: boolean;
  status:
    | "PROCESSED_FULL_REFUND"
    | "PROCESSED_PARTIAL_REFUND"
    | "ALREADY_PROCESSED"
    | "IGNORED_NON_FINAL_REFUND"
    | "TRANSACTION_NOT_RESOLVED"
    | "REFUND_ENUMERATION_INCOMPLETE"
    | "REFUND_PAYMENT_AMOUNT_MISMATCH"
    | "REFUND_ACCOUNTING_MISMATCH"
    | "ERROR";
  message: string;
  refundId?: string;
  transactionId?: string;
  cumulativeRefundedCentavos?: number;
}

export class RefundService {
  /**
   * Helper: Resolves plan duration in days from planType.
   */
  static getPlanDurationDays(planType: string | null | undefined): number {
    if (planType === "1_MONTH") return 30;
    if (planType === "6_MONTHS") return 180;
    if (planType === "1_YEAR") return 365;

    throw new Error("Unsupported pricing plan.");
  }

  /**
   * Fetches a Checkout Session from PayMongo using Basic Auth.
   * READ-ONLY: performs GET only and makes no database or financial mutations.
   */
  static async fetchPayMongoCheckoutSession(
    checkoutSessionId: string,
    secretKey: string
  ): Promise<PayMongoCheckoutSessionResource | null> {
    if (!checkoutSessionId || !checkoutSessionId.startsWith("cs_")) {
      return null;
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    let response: Response;
    try {
      response = await fetch(
        `https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`,
        {
          headers: { Authorization: `Basic ${authHeader}` },
          signal: AbortSignal.timeout(10000),
        }
      );
    } catch (fetchErr) {
      console.warn(
        `[RefundService] PayMongo GET checkout session ${checkoutSessionId} network error:`,
        fetchErr
      );
      return null;
    }

    if (!response.ok) {
      console.warn(
        `[RefundService] PayMongo GET checkout session ${checkoutSessionId} failed with HTTP ${response.status}`
      );
      return null;
    }

    const json = await response.json().catch(() => null);
    return json?.data || null;
  }

  /**
   * Returns the authoritative paid Payment embedded in a Checkout Session.
   * Pure selection only; no side effects.
   */
  static resolvePaidPaymentFromCheckout(
    checkout: PayMongoCheckoutSessionResource
  ): PayMongoPaymentResource | null {
    const payments = checkout?.attributes?.payments || [];

    return (
      payments.find(
        (payment) =>
          payment?.id?.startsWith("pay_") &&
          payment?.attributes?.status === "paid"
      ) || null
    );
  }

  /**
   * Fetches the Payment resource from PayMongo API using Basic Auth.
   */
  static async fetchPayMongoPayment(
    paymentId: string,
    secretKey: string
  ): Promise<PayMongoPaymentResource | null> {
    if (!paymentId || !paymentId.startsWith("pay_")) return null;
    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    const response = await fetch(`https://api.paymongo.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${authHeader}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[RefundService] PayMongo GET payment ${paymentId} failed with HTTP ${response.status}`);
      return null;
    }

    const json = await response.json();
    return json?.data || null;
  }

  /**
   * Strictly enumerates ALL Refund resources for a Payment.
   *
   * READ-ONLY. Intended for refund preview/execution preflight where an
   * incomplete history must fail closed rather than be interpreted as zero.
   *
   * Unlike fetchAllSucceededRefunds(), this method has NO embedded-resource
   * fallback and throws whenever authoritative pagination cannot be completed.
   */
  static async fetchAllRefundsStrict(
    paymentId: string,
    secretKey: string
  ): Promise<PayMongoRefundResource[]> {
    if (!paymentId || !paymentId.startsWith("pay_")) {
      throw new Error("REFUND_HISTORY_INVALID_PAYMENT_ID");
    }

    if (!secretKey || !secretKey.trim()) {
      throw new Error("REFUND_HISTORY_MISSING_SECRET");
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");
    const refundsById = new Map<string, PayMongoRefundResource>();

    let afterCursor: string | null = null;

    const MAX_PAGES = 10;
    const LIMIT = 100;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL("https://api.paymongo.com/refunds");

      url.searchParams.set(
        "data.attributes.payment_id",
        paymentId
      );
      url.searchParams.set(
        "data.attributes.limit",
        String(LIMIT)
      );

      if (afterCursor) {
        url.searchParams.set(
          "data.attributes.after",
          afterCursor
        );
      }

      let response: Response;

      try {
        response = await fetch(url.toString(), {
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        throw new Error("REFUND_HISTORY_NETWORK_ERROR");
      }

      if (!response.ok) {
        const errorPayload =
          (await response.json().catch(() => null)) as
            | {
                errors?: Array<{
                  code?: unknown;
                  source?: { pointer?: unknown };
                }>;
              }
            | null;

        const rawCode =
          errorPayload?.errors?.[0]?.code;

        const rawPointer =
          errorPayload?.errors?.[0]?.source?.pointer;

        const safeCode =
          typeof rawCode === "string" &&
          /^[A-Za-z0-9_-]{1,80}$/.test(rawCode)
            ? rawCode
            : "UNKNOWN";

        const safePointer =
          typeof rawPointer === "string" &&
          /^[A-Za-z0-9_./\[\]-]{1,120}$/.test(
            rawPointer
          )
            ? rawPointer
            : "NONE";

        console.error(
          `[REFUND_SERVICE] Refund history request rejected: HTTP_${response.status} code=${safeCode} pointer=${safePointer}`
        );

        const diagnosticErrors =
          Array.isArray(errorPayload?.errors)
            ? errorPayload.errors
            : [];

        const safeDiagnosticSet =
          diagnosticErrors
            .slice(0, 8)
            .map((item, index) => {
              const itemCode =
                item?.code;

              const itemPointer =
                item?.source?.pointer;

              const sanitizedCode =
                typeof itemCode === "string" &&
                /^[A-Za-z0-9_-]{1,80}$/.test(
                  itemCode
                )
                  ? itemCode
                  : "UNKNOWN";

              const sanitizedPointer =
                typeof itemPointer === "string" &&
                /^[A-Za-z0-9_./\[\]-]{1,120}$/.test(
                  itemPointer
                )
                  ? itemPointer
                  : "NONE";

              return `${index + 1}:${sanitizedCode}:${sanitizedPointer}`;
            })
            .join(",");

        console.error(
          `[REFUND_SERVICE] Refund history rejection set: HTTP_${response.status} errorCount=${diagnosticErrors.length} errors=${safeDiagnosticSet || "NONE"}`
        );

        if (
          isExactPayMongoPaymentIdListRejection(
            response.status,
            errorPayload
          )
        ) {
          throw new Error(
            "REFUND_HISTORY_PAYMENT_ID_LIST_REJECTED"
          );
        }

        throw new Error(
          `REFUND_HISTORY_HTTP_${response.status}`
        );
      }

      const body = await response.json().catch(() => null);

      if (!body || !Array.isArray(body.data)) {
        throw new Error("REFUND_HISTORY_INVALID_RESPONSE");
      }

      const items = body.data as PayMongoRefundResource[];

      for (const refund of items) {
        if (
          !refund ||
          typeof refund.id !== "string" ||
          !refund.id.startsWith("ref_") ||
          refund.type !== "refund"
        ) {
          throw new Error("REFUND_HISTORY_INVALID_RESOURCE");
        }

        if (refund.attributes?.payment_id !== paymentId) {
          throw new Error("REFUND_HISTORY_PAYMENT_MISMATCH");
        }

        refundsById.set(refund.id, refund);
      }

      // A short page proves pagination is complete.
      if (items.length < LIMIT) {
        return Array.from(refundsById.values());
      }

      const nextCursor = items[items.length - 1]?.id;

      if (
        !nextCursor ||
        nextCursor === afterCursor
      ) {
        throw new Error(
          "REFUND_HISTORY_PAGINATION_INCOMPLETE"
        );
      }

      afterCursor = nextCursor;
    }

    // Exactly MAX_PAGES full pages means additional history may exist.
    // Never silently truncate financial history.
    throw new Error(
      "REFUND_HISTORY_PAGINATION_INCOMPLETE"
    );
  }

  /**
   * Strict succeeded-refund view used for cumulative refund accounting.
   * Authoritative enumeration still occurs through fetchAllRefundsStrict().
   */
  static async fetchAllSucceededRefundsStrict(
    paymentId: string,
    secretKey: string
  ): Promise<PayMongoRefundResource[]> {
    const refunds = await this.fetchAllRefundsStrict(
      paymentId,
      secretKey
    );

    return refunds.filter(
      (refund) => refund.attributes?.status === "succeeded"
    );
  }

  /**
   * Enumerates ALL historical Refund resources for a Payment using the documented List Refunds API.
   * Enforces pagination safety bound (MAX_PAGES = 10).
   */
  static async fetchAllSucceededRefunds(
    paymentId: string,
    secretKey: string
  ): Promise<PayMongoRefundResource[]> {
    const allSucceededRefunds: PayMongoRefundResource[] = [];
    let afterCursor: string | null = null;
    let pageCount = 0;
    const MAX_PAGES = 10;
    const LIMIT = 100;

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    while (pageCount < MAX_PAGES) {
      pageCount++;
      const url = new URL("https://api.paymongo.com/refunds");
      url.searchParams.set("data.attributes.payment_id", paymentId);
      url.searchParams.set("data.attributes.limit", String(LIMIT));
      if (afterCursor) {
        url.searchParams.set("data.attributes.after", afterCursor);
      }

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          headers: { Authorization: `Basic ${authHeader}` },
          signal: AbortSignal.timeout(10000),
        });
      } catch (fetchErr) {
        console.warn(`[RefundService] PayMongo List Refunds network error on payment ${paymentId}:`, fetchErr);
        break;
      }

      if (!res.ok) {
        console.warn(`[RefundService] PayMongo List Refunds HTTP ${res.status} on payment ${paymentId}`);
        break;
      }

      const body = await res.json().catch(() => null);
      const items: PayMongoRefundResource[] = body?.data || [];

      for (const item of items) {
        if (item.attributes?.status === "succeeded") {
          allSucceededRefunds.push(item);
        }
      }

      // Safe termination: less than LIMIT items returned
      if (items.length < LIMIT) {
        break;
      }

      const nextCursor = items[items.length - 1]?.id;
      if (!nextCursor || nextCursor === afterCursor) {
        break;
      }

      // Check if max pages reached while more items might still exist
      if (pageCount >= MAX_PAGES) {
        throw new Error("REFUND_ENUMERATION_INCOMPLETE");
      }

      afterCursor = nextCursor;
    }

    // Fallback: If List Refunds returned empty, inspect Payment.attributes.refunds collection
    if (allSucceededRefunds.length === 0) {
      const payment = await this.fetchPayMongoPayment(paymentId, secretKey);
      const embeddedRefunds = payment?.attributes?.refunds || [];
      for (const ref of embeddedRefunds) {
        const status = (ref as any).attributes?.status || (ref as any).status;
        if (status === "succeeded") {
          allSucceededRefunds.push({
            id: ref.id,
            type: "refund",
            attributes: {
              amount: (ref as any).attributes?.amount || (ref as any).amount,
              currency: (ref as any).attributes?.currency || (ref as any).currency || "PHP",
              status: "succeeded",
              payment_id: paymentId,
              reason: (ref as any).attributes?.reason || (ref as any).reason,
              created_at: (ref as any).attributes?.created_at || (ref as any).created_at,
              updated_at: (ref as any).attributes?.updated_at || (ref as any).updated_at,
            },
          });
        }
      }
    }

    return allSucceededRefunds;
  }

  /**
   * Reconstructs the deterministic pre-refund entitlement timeline from structured sources.
   */
  static async computeDeterministicEntitlement(
    userId: string,
    excludeTransactionId?: string,
    client?: any
  ): Promise<{ expectedPaidUntil: Date | null; expectedIsPaid: boolean }> {
    const db = client || prisma;

    const [user, transactions, vouchers] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, createdAt: true },
      }),
      db.transaction.findMany({
        where: {
          userId,
          status: "PAID",
          ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, planType: true, createdAt: true },
      }),
      db.institutionalVoucherCode.findMany({
        where: {
          redeemedBy: userId,
          status: "REDEEMED",
        },
        orderBy: { redeemedAt: "asc" },
        include: { batch: { select: { durationDays: true } } },
      }),
    ]);

    if (!user) {
      return { expectedPaidUntil: null, expectedIsPaid: false };
    }

    type GrantItem = { date: Date; durationDays: number };
    const grants: GrantItem[] = [];

    for (const tx of transactions) {
      grants.push({
        date: tx.createdAt,
        durationDays: this.getPlanDurationDays(tx.planType),
      });
    }

    for (const v of vouchers) {
      grants.push({
        date: v.redeemedAt || v.createdAt,
        durationDays: v.batch?.durationDays || 365,
      });
    }

    grants.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (grants.length === 0) {
      return { expectedPaidUntil: null, expectedIsPaid: false };
    }

    let cursor = new Date(user.createdAt);

    for (const g of grants) {
      const baseDate = g.date.getTime() > cursor.getTime() ? new Date(g.date) : new Date(cursor);
      baseDate.setDate(baseDate.getDate() + g.durationDays);
      cursor = baseDate;
    }

    const now = new Date();
    const expectedPaidUntil = cursor;
    const expectedIsPaid = expectedPaidUntil.getTime() > now.getTime();

    return { expectedPaidUntil, expectedIsPaid };
  }

  /**
   * Core Transaction-Scoped Atomic Reversal Engine.
   * Holds PostgreSQL transaction advisory lock throughout execution.
   */
  static async processSingleRefundUnderLock(params: {
    transactionId: string;
    refund: PayMongoRefundResource;
    payment: PayMongoPaymentResource;
  }): Promise<RefundProcessingOutcome> {
    const { transactionId, refund, payment } = params;

    const result = await prisma.$transaction(
      async (tx) => {
        // 🔒 1. ACQUIRE TRANSACTION-SCOPED ADVISORY LOCK
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${transactionId}, 0)
          )::text AS lock_result
        `;

        // 🔍 2. RE-FETCH AUTHORITATIVE TRANSACTION STATE
        const currentTxn = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: {
            user: true,
            referralReward: true,
            partnerCommission: { include: { partner: true } },
          },
        });

        if (!currentTxn) {
          return {
            success: false,
            status: "TRANSACTION_NOT_RESOLVED" as const,
            message: `Transaction ${transactionId} not found under lock`,
          };
        }

        // 🛡️ 3. DURABLE REFUND-ID IDEMPOTENCY CHECK (First Before Mismatch Validations)
        const existingCanonicalLeg = await tx.financialLedgerEntry.findFirst({
          where: {
            transactionId: currentTxn.id,
            transactionType: "REFUND_REVERSAL",
            sourceEntity: "Refund",
            sourceId: refund.id,
            accountCategory: "REVENUE_PREMIUM",
            entryType: "DEBIT",
          },
        });

        if (existingCanonicalLeg) {
          return {
            success: true,
            status: "ALREADY_PROCESSED" as const,
            message: `Refund ${refund.id} was already recorded in canonical ledger`,
            refundId: refund.id,
            transactionId: currentTxn.id,
          };
        }

        // 💳 4. AUTHORITATIVE EXTERNAL PAYMENT BASE & TRANSACTION CROSS-CHECK
        const paymongoPaidCentavos = payment?.attributes?.amount;
        if (
          typeof paymongoPaidCentavos !== "number" ||
          paymongoPaidCentavos <= 0 ||
          payment?.attributes?.currency !== "PHP"
        ) {
          return {
            success: false,
            status: "ERROR" as const,
            message: `Invalid or non-positive PayMongo Payment amount: ${paymongoPaidCentavos}`,
            transactionId: currentTxn.id,
            refundId: refund.id,
          };
        }

        // Cross-check with Transaction.grossAmountCentavos if present
        if (currentTxn.grossAmountCentavos && currentTxn.grossAmountCentavos > 0) {
          if (currentTxn.grossAmountCentavos !== paymongoPaidCentavos) {
            console.error(
              `[RefundService Financial Discrepancy] Transaction ${currentTxn.id} grossAmountCentavos (${currentTxn.grossAmountCentavos}) does not match PayMongo Payment amount (${paymongoPaidCentavos})`
            );
            return {
              success: false,
              status: "REFUND_PAYMENT_AMOUNT_MISMATCH" as const,
              message: `Financial mismatch: Transaction grossAmountCentavos (${currentTxn.grossAmountCentavos}) != PayMongo Payment amount (${paymongoPaidCentavos})`,
              transactionId: currentTxn.id,
              refundId: refund.id,
            };
          }
        }

        // Authoritative refund base is the customer-paid payment amount from PayMongo
        const originalRefundableCentavos = paymongoPaidCentavos;

        // 📊 5. CANONICAL CUMULATIVE REFUND CALCULATION
        const cumulativeAgg = await tx.financialLedgerEntry.aggregate({
          where: {
            transactionId: currentTxn.id,
            transactionType: "REFUND_REVERSAL",
            accountCategory: "REVENUE_PREMIUM",
            entryType: "DEBIT",
          },
          _sum: { amountCentavos: true },
        });

        const cumulativeRefundedCentavos = cumulativeAgg._sum.amountCentavos || 0;
        const remainingRefundableCentavos = Math.max(
          0,
          originalRefundableCentavos - cumulativeRefundedCentavos
        );

        if (remainingRefundableCentavos <= 0) {
          // Already 100% refunded
          return {
            success: true,
            status: "ALREADY_PROCESSED" as const,
            message: `Transaction ${currentTxn.id} has already been 100% refunded`,
            refundId: refund.id,
            transactionId: currentTxn.id,
            cumulativeRefundedCentavos,
          };
        }

        const incomingAmountCentavos = refund.attributes?.amount;
        if (typeof incomingAmountCentavos !== "number" || incomingAmountCentavos <= 0) {
          return {
            success: false,
            status: "ERROR" as const,
            message: `Non-positive refund amount received: ${incomingAmountCentavos}`,
          };
        }

        // 🚨 6. STRICT OVER-REFUND ACCOUNTING MISMATCH CHECK (Zero Silent Clamping)
        if (incomingAmountCentavos > remainingRefundableCentavos) {
          console.error(
            `[RefundService Accounting Mismatch] Transaction ${currentTxn.id}, Refund ${refund.id}, Payment ${refund.attributes.payment_id}: incomingAmountCentavos (${incomingAmountCentavos}) > remainingRefundableCentavos (${remainingRefundableCentavos})`
          );
          return {
            success: false,
            status: "REFUND_ACCOUNTING_MISMATCH" as const,
            message: `Refund amount ${incomingAmountCentavos} centavos exceeds remaining refundable balance ${remainingRefundableCentavos} centavos`,
            refundId: refund.id,
            transactionId: currentTxn.id,
          };
        }

        const effectiveRefundCentavos = incomingAmountCentavos;
        const newCumulativeRefundedCentavos = cumulativeRefundedCentavos + effectiveRefundCentavos;

        // Exact equality check for full refund
        const isFullRefund = newCumulativeRefundedCentavos === originalRefundableCentavos;

        // 🤝 7. PARTNER COMMISSION REVERSAL EVALUATION
        let reversePartnerLiability = false;
        let partnerCommissionReversalAmountCentavos = 0;
        if (isFullRefund && currentTxn.partnerCommission) {
          const ptrComm = currentTxn.partnerCommission;

          // 🔒 Level 2 Lock: Acquire partner-finance advisory lock
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`partner-finance:${ptrComm.partnerId}`}, 0)
            )::text AS lock_result
          `;

          const now = new Date();
          const allCommissions = await tx.partnerCommission.findMany({
            where: { partnerId: ptrComm.partnerId },
          });
          const allPayouts = await tx.partnerPayout.findMany({
            where: { partnerId: ptrComm.partnerId },
          });

          let validEarnedBeforeRefund = 0;
          allCommissions.forEach((c) => {
            if (
              c.status === "AVAILABLE" ||
              c.status === "PAID" ||
              (c.status === "PENDING" && c.holdingUntil && c.holdingUntil <= now) ||
              c.id === ptrComm.id // include target commission before reversal
            ) {
              validEarnedBeforeRefund += c.commissionAmountCentavos;
            }
          });

          let historicalPaidPayoutTotal = 0;
          let activeReservedPayoutTotal = 0;
          allPayouts.forEach((p) => {
            if (p.status === "PAID") {
              historicalPaidPayoutTotal += p.amountCentavos;
            } else if (["REQUESTED", "RESERVED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(p.status)) {
              activeReservedPayoutTotal += p.amountCentavos;
            }
          });

          // Always transition the refunded commission so it cannot be withdrawn in the future
          await tx.partnerCommission.update({
            where: { id: ptrComm.id },
            data: {
              status: "REVERSED",
              reversedAt: new Date(),
              reversalReason: `Full purchase refund (${refund.id})`,
            },
          });

          await PartnerAuditService.logEvent(
            {
              action: "PARTNER_PAYOUT_REVERSED",
              partnerId: ptrComm.partnerId,
              amountCentavos: ptrComm.commissionAmountCentavos,
              reason: `Purchase refunded via PayMongo (${refund.id})`,
              metadata: {
                refundId: refund.id,
                transactionId: currentTxn.id,
                previousStatus: ptrComm.status,
              },
            },
            tx
          );

          const validEarnedAfterRefund = validEarnedBeforeRefund - ptrComm.commissionAmountCentavos;
          const outstandingLiabilityBefore = Math.max(0, validEarnedBeforeRefund - historicalPaidPayoutTotal);
          const safeLiabilityDebitCentavos = Math.min(ptrComm.commissionAmountCentavos, outstandingLiabilityBefore);

          if (safeLiabilityDebitCentavos > 0) {
            reversePartnerLiability = true;
            partnerCommissionReversalAmountCentavos = safeLiabilityDebitCentavos;
          }

          if (historicalPaidPayoutTotal > validEarnedAfterRefund) {
            const unbackedDelta = ptrComm.commissionAmountCentavos - safeLiabilityDebitCentavos;
            await tx.accountingAuditLog.create({
              data: {
                action: "POST_PAYOUT_REFUND_MANUAL_REVIEW_REQUIRED",
                targetType: "PARTNER_COMMISSION",
                targetId: ptrComm.id,
                amountCentavos: unbackedDelta,
                reason: `Full refund on Transaction ${currentTxn.id} occurred after payout disbursement exceeded remaining aggregate balance. Unbacked amount: ${unbackedDelta} centavos`,
                metadata: {
                  refundId: refund.id,
                  partnerId: ptrComm.partnerId,
                  unbackedDelta,
                  historicalPaidPayoutTotal,
                  validEarnedAfterRefund,
                },
              },
            });
          } else if (historicalPaidPayoutTotal + activeReservedPayoutTotal > validEarnedAfterRefund) {
            await tx.accountingAuditLog.create({
              data: {
                action: "PAYOUT_REFUND_CONFLICT_MANUAL_REVIEW_REQUIRED",
                targetType: "PARTNER_COMMISSION",
                targetId: ptrComm.id,
                amountCentavos: ptrComm.commissionAmountCentavos,
                reason: `Full refund on Transaction ${currentTxn.id} reduced valid earnings below active payout reservations. Manual review required before pending payouts can be disbursed.`,
                metadata: {
                  refundId: refund.id,
                  partnerId: ptrComm.partnerId,
                  activeReservedPayoutTotal,
                  validEarnedAfterRefund,
                },
              },
            });
          }
        }

        // 🎁 8. REFERRAL REWARD REVERSAL EVALUATION
        let reverseReferralLiability = false;
        let referralRewardReversalAmountCentavos = 0;
        if (isFullRefund && currentTxn.referralReward) {
          const refReward = currentTxn.referralReward;

          // 🔒 Level 3 Lock: Acquire referral-finance advisory lock
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`referral-finance:${refReward.inviterId}`}, 0)
            )::text AS lock_result
          `;

          const now = new Date();
          const allRewards = await tx.referralReward.findMany({
            where: { inviterId: refReward.inviterId },
          });
          const allPayouts = await tx.referralPayout.findMany({
            where: { userId: refReward.inviterId },
          });

          let validEarnedBeforeRefund = 0;
          allRewards.forEach((r) => {
            if (
              r.status === "AVAILABLE" ||
              r.status === "PAID" ||
              (r.status === "PENDING" && r.holdingUntil && r.holdingUntil <= now) ||
              r.id === refReward.id
            ) {
              validEarnedBeforeRefund += r.rewardAmountCentavos;
            }
          });

          let historicalPaidPayoutTotal = 0;
          let activeReservedPayoutTotal = 0;
          allPayouts.forEach((p) => {
            if (p.status === "PAID") {
              historicalPaidPayoutTotal += p.amountCentavos;
            } else if (["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING"].includes(p.status)) {
              activeReservedPayoutTotal += p.amountCentavos;
            }
          });

          // Always transition the refunded reward so it cannot be withdrawn in the future
          await tx.referralReward.update({
            where: { id: refReward.id },
            data: {
              status: "REFUNDED",
              reversedAt: new Date(),
              reversalReason: `Full purchase refund (${refund.id})`,
            },
          });

          await tx.referral.update({
            where: { id: refReward.referralId },
            data: { status: "REFUNDED" },
          });

          await tx.referralAuditLog.create({
            data: {
              actorId: "SYSTEM_PAYMONGO_REFUND",
              actorRole: "SYSTEM",
              action: "REWARD_REVERSED",
              targetType: "REWARD",
              targetId: refReward.id,
              amountCentavos: refReward.rewardAmountCentavos,
              reason: `PayMongo full refund (${refund.id})`,
              metadata: {
                refundId: refund.id,
                transactionId: currentTxn.id,
                previousStatus: refReward.status,
              },
            },
          });

          const validEarnedAfterRefund = validEarnedBeforeRefund - refReward.rewardAmountCentavos;
          const outstandingLiabilityBefore = Math.max(0, validEarnedBeforeRefund - historicalPaidPayoutTotal);
          const safeLiabilityDebitCentavos = Math.min(refReward.rewardAmountCentavos, outstandingLiabilityBefore);

          if (safeLiabilityDebitCentavos > 0) {
            reverseReferralLiability = true;
            referralRewardReversalAmountCentavos = safeLiabilityDebitCentavos;
          }

          if (historicalPaidPayoutTotal > validEarnedAfterRefund) {
            const unbackedDelta = refReward.rewardAmountCentavos - safeLiabilityDebitCentavos;
            await tx.accountingAuditLog.create({
              data: {
                action: "POST_PAYOUT_REFUND_MANUAL_REVIEW_REQUIRED",
                targetType: "REFERRAL_REWARD",
                targetId: refReward.id,
                amountCentavos: unbackedDelta,
                reason: `Full refund on Transaction ${currentTxn.id} occurred after payout disbursement exceeded remaining aggregate balance. Unbacked amount: ${unbackedDelta} centavos`,
                metadata: {
                  refundId: refund.id,
                  inviterId: refReward.inviterId,
                  unbackedDelta,
                  historicalPaidPayoutTotal,
                  validEarnedAfterRefund,
                },
              },
            });
          } else if (historicalPaidPayoutTotal + activeReservedPayoutTotal > validEarnedAfterRefund) {
            await tx.accountingAuditLog.create({
              data: {
                action: "PAYOUT_REFUND_CONFLICT_MANUAL_REVIEW_REQUIRED",
                targetType: "REFERRAL_REWARD",
                targetId: refReward.id,
                amountCentavos: refReward.rewardAmountCentavos,
                reason: `Full refund on Transaction ${currentTxn.id} reduced valid earnings below active payout reservations. Manual review required before pending payouts can be disbursed.`,
                metadata: {
                  refundId: refund.id,
                  inviterId: refReward.inviterId,
                  activeReservedPayoutTotal,
                  validEarnedAfterRefund,
                },
              },
            });
          }
        }

        // 📖 9. DOUBLE-ENTRY FINANCIAL LEDGER POSTING
        await LedgerService.recordRefundReversal(
          {
            transactionId: currentTxn.id,
            refundAmountCentavos: effectiveRefundCentavos,
            refundId: refund.id,
            referralRewardId: currentTxn.referralReward?.id,
            referralRewardCentavos: referralRewardReversalAmountCentavos,
            reverseReferralLiability,
            partnerCommissionId: currentTxn.partnerCommission?.id,
            partnerCommissionCentavos: partnerCommissionReversalAmountCentavos,
            reversePartnerLiability,
            reason: `PayMongo refund ${refund.id} (${isFullRefund ? "FULL" : "PARTIAL"})`,
          },
          tx
        );

        // 🎓 10. CUSTOMER PREMIUM ENTITLEMENT REVERSAL (Full Refund Only, Guarded)
        if (isFullRefund && currentTxn.user) {
          // 🔒 Acquire Level 4 User-Entitlement advisory lock to serialize entitlement modifications
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`user-entitlement:${currentTxn.user.id}`}, 0)
            )::text AS lock_result
          `;

          // Re-fetch fresh user under user-entitlement lock
          const freshUser = await tx.user.findUnique({
            where: { id: currentTxn.user.id },
            select: { id: true, isPaid: true, paidUntil: true, createdAt: true },
          });
          const user = freshUser || currentTxn.user;

          // A. Compute expected pre-refund state INCLUDING currentTxn
          const preRefundBaseline = await this.computeDeterministicEntitlement(user.id, undefined, tx);

          const actualPaidUntilTime = user.paidUntil ? user.paidUntil.getTime() : 0;
          const expectedPaidUntilTime = preRefundBaseline.expectedPaidUntil
            ? preRefundBaseline.expectedPaidUntil.getTime()
            : 0;

          const isPaidMatches = user.isPaid === preRefundBaseline.expectedIsPaid;
          const paidUntilMatches =
            Math.abs(actualPaidUntilTime - expectedPaidUntilTime) <= 60000; // 60-second tolerance

          const isBaselineEquivalent = isPaidMatches && paidUntilMatches;

          if (isBaselineEquivalent) {
            // B. Safe to recompute: exclude currentTxn from timeline
            const postRefundState = await this.computeDeterministicEntitlement(user.id, currentTxn.id, tx);

            // Invariant: Refund must NEVER increase access
            const postTime = postRefundState.expectedPaidUntil
              ? postRefundState.expectedPaidUntil.getTime()
              : 0;
            const accessNotIncreased = postTime <= actualPaidUntilTime;
            const hardRevokeKept = !user.isPaid ? !postRefundState.expectedIsPaid : true;

            if (accessNotIncreased && hardRevokeKept) {
              await tx.user.update({
                where: { id: user.id },
                data: {
                  isPaid: postRefundState.expectedIsPaid,
                  paidUntil: postRefundState.expectedPaidUntil,
                },
              });
            } else {
              // Access increase detected or hard revoke violation: preserve state, flag manual review
              await tx.accountingAuditLog.create({
                data: {
                  action: "ENTITLEMENT_MANUAL_REVIEW_REQUIRED",
                  targetType: "USER",
                  targetId: user.id,
                  reason: `Calculated post-refund access exceeded pre-refund state. Preserving user subscription state.`,
                  metadata: {
                    refundId: refund.id,
                    transactionId: currentTxn.id,
                    actualPaidUntil: user.paidUntil,
                    calculatedPostRefundPaidUntil: postRefundState.expectedPaidUntil,
                  },
                },
              });
            }
          } else {
            // Baseline discrepancy (Admin override, manual REVOKE, or manual grant detected)
            await tx.accountingAuditLog.create({
              data: {
                action: "ENTITLEMENT_MANUAL_REVIEW_REQUIRED",
                targetType: "USER",
                targetId: user.id,
                reason: `Actual user entitlement did not match deterministic pre-refund grant baseline upon refund ${refund.id}. Preserving subscription access.`,
                metadata: {
                  refundId: refund.id,
                  transactionId: currentTxn.id,
                  actualIsPaid: user.isPaid,
                  actualPaidUntil: user.paidUntil,
                  expectedPreRefundPaidUntil: preRefundBaseline.expectedPaidUntil,
                },
              },
            });
          }
        }

        // 🔄 11. TRANSACTION STATUS TRANSITION (Full Refund Only)
        // Keep the transaction PAID until entitlement reconstruction is complete
        // so the pre-refund baseline can correctly include currentTxn.
        if (isFullRefund) {
          await tx.transaction.update({
            where: { id: currentTxn.id },
            data: { status: "REFUNDED" },
          });
        }

        // 🧾 12. TAX REFUND RECONCILIATION AUDIT LOG
        await tx.accountingAuditLog.create({
          data: {
            action: "TAX_REFUND_MANUAL_RECONCILIATION_REQUIRED",
            targetType: "TRANSACTION",
            targetId: currentTxn.id,
            amountCentavos: effectiveRefundCentavos,
            reason: `Tax provision reversal requires manual accounting reconciliation for Transaction ${currentTxn.id}`,
            metadata: {
              refundId: refund.id,
              effectiveRefundCentavos,
            },
          },
        });

        return {
          success: true,
          status: isFullRefund ? ("PROCESSED_FULL_REFUND" as const) : ("PROCESSED_PARTIAL_REFUND" as const),
          message: `Successfully processed ${isFullRefund ? "FULL" : "PARTIAL"} refund ${refund.id} for Transaction ${currentTxn.id}`,
          refundId: refund.id,
          transactionId: currentTxn.id,
          cumulativeRefundedCentavos: newCumulativeRefundedCentavos,
        };
      },
      { timeout: 25000, maxWait: 15000 }
    );

    return result;
  }

  /**
   * Main Webhook Orchestrator for PayMongo Refund Events.
   */
  static async processPayMongoRefundWebhook(params: {
    eventType: string;
    payload: any;
    secretKey: string;
  }): Promise<RefundProcessingOutcome> {
    const { eventType, payload, secretKey } = params;

    // ────────────────────────────────────────────────────────────
    // FLOW 1: payment.refund.updated (Direct Refund Resource)
    // ────────────────────────────────────────────────────────────
    if (eventType === "payment.refund.updated") {
      const refundResource = payload?.data?.attributes?.data;
      if (!refundResource || refundResource.type !== "refund") {
        return {
          success: false,
          status: "ERROR",
          message: "Malformed payment.refund.updated payload: data is not a refund resource",
        };
      }

      const refundId = refundResource.id; // ref_...
      const status = refundResource.attributes?.status;
      const paymentId = refundResource.attributes?.payment_id; // pay_...
      const amountCentavos = refundResource.attributes?.amount;

      // Validate status: ONLY "succeeded" triggers financial mutations
      if (status !== "succeeded") {
        console.log(`[RefundService] Non-succeeded refund update (${refundId}, status=${status}). Ignored safely.`);
        return {
          success: true,
          status: "IGNORED_NON_FINAL_REFUND",
          message: `Refund status is ${status}; ignored safely without financial mutation`,
          refundId,
        };
      }

      if (!refundId || !refundId.startsWith("ref_") || !paymentId || !paymentId.startsWith("pay_")) {
        return {
          success: false,
          status: "ERROR",
          message: `Malformed identifiers in refund resource: refundId=${refundId}, paymentId=${paymentId}`,
        };
      }

      // Fetch authoritative Payment resource
      const payment = await this.fetchPayMongoPayment(paymentId, secretKey);
      if (!payment) {
        return {
          success: false,
          status: "ERROR",
          message: `Could not retrieve PayMongo Payment resource for paymentId=${paymentId}`,
          refundId,
        };
      }

      const paymentIntentId =
        payment.attributes?.payment_intent_id || payment.attributes?.payment_intent?.id;

      let transaction = null;
      if (paymentIntentId) {
        transaction = await prisma.transaction.findFirst({
          where: { paymentIntentId },
        });
      }

      // Fallback: If metadata contains checkoutSessionId
      if (!transaction && payment.attributes?.metadata?.checkoutSessionId) {
        transaction = await prisma.transaction.findUnique({
          where: { checkoutSessionId: payment.attributes.metadata.checkoutSessionId },
        });
      }

      if (!transaction) {
        console.warn(
          `[RefundService] Could not resolve GovStudyX Transaction for paymentId=${paymentId}, paymentIntentId=${paymentIntentId}`
        );
        return {
          success: false,
          status: "TRANSACTION_NOT_RESOLVED",
          message: `Transaction not found for refund ${refundId} (payment ${paymentId})`,
          refundId,
        };
      }

      const outcome = await this.processSingleRefundUnderLock({
        transactionId: transaction.id,
        refund: {
          id: refundId,
          type: "refund",
          attributes: {
            amount: amountCentavos,
            currency: refundResource.attributes?.currency || "PHP",
            status: "succeeded",
            payment_id: paymentId,
            reason: refundResource.attributes?.reason,
          },
        },
        payment,
      });

      // Post-commit Self-Healing Reconciliation
      if (
        outcome.status === "PROCESSED_FULL_REFUND" ||
        outcome.status === "PROCESSED_PARTIAL_REFUND" ||
        outcome.status === "ALREADY_PROCESSED"
      ) {
        await ReconciliationService.reconcileTransaction(transaction.id).catch((err) =>
          console.error("[RefundService] Post-commit reconciliation warning:", err)
        );
      }

      return outcome;
    }

    // ────────────────────────────────────────────────────────────
    // FLOW 2: payment.refunded (Payment Resource Canonical Recovery)
    // ────────────────────────────────────────────────────────────
    if (eventType === "payment.refunded") {
      const paymentData = payload?.data?.attributes?.data;
      const paymentId = paymentData?.id; // pay_...

      if (!paymentId || !paymentId.startsWith("pay_")) {
        return {
          success: false,
          status: "ERROR",
          message: `Invalid or missing paymentId in payment.refunded payload: ${paymentId}`,
        };
      }

      // Fetch or use authoritative Payment resource
      let paymentResource = paymentData;
      let paymentIntentId =
        paymentData?.attributes?.payment_intent_id || paymentData?.attributes?.payment_intent?.id;

      if (!paymentIntentId || !paymentData?.attributes?.amount) {
        const fetchedPayment = await this.fetchPayMongoPayment(paymentId, secretKey);
        if (fetchedPayment) {
          paymentResource = fetchedPayment;
          paymentIntentId =
            fetchedPayment.attributes?.payment_intent_id ||
            fetchedPayment.attributes?.payment_intent?.id;
        }
      }

      let transaction = null;
      if (paymentIntentId) {
        transaction = await prisma.transaction.findFirst({
          where: { paymentIntentId },
        });
      }

      if (!transaction) {
        console.warn(
          `[RefundService] Could not resolve GovStudyX Transaction for payment.refunded event on paymentId=${paymentId}`
        );
        return {
          success: false,
          status: "TRANSACTION_NOT_RESOLVED",
          message: `Transaction not found for payment ${paymentId}`,
        };
      }

      // Enumerate ALL historical succeeded refunds for this payment
      const succeededRefunds = await this.fetchAllSucceededRefunds(paymentId, secretKey);

      if (succeededRefunds.length === 0) {
        console.log(`[RefundService] payment.refunded received for ${paymentId}, but 0 succeeded refunds found.`);
        return {
          success: true,
          status: "IGNORED_NON_FINAL_REFUND",
          message: "No succeeded refunds found for payment",
          transactionId: transaction.id,
        };
      }

      // Deduplicate by refundId & sort deterministically (created_at asc, id asc)
      const uniqueRefundsMap = new Map<string, PayMongoRefundResource>();
      for (const r of succeededRefunds) {
        uniqueRefundsMap.set(r.id, r);
      }
      const sortedRefunds = Array.from(uniqueRefundsMap.values()).sort((a, b) => {
        const timeA = a.attributes?.created_at || 0;
        const timeB = b.attributes?.created_at || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      // Process each refund in deterministic order under its own advisory lock
      let lastOutcome: RefundProcessingOutcome = {
        success: true,
        status: "ALREADY_PROCESSED",
        message: "All refunds already processed",
        transactionId: transaction.id,
      };

      for (const ref of sortedRefunds) {
        const outcome = await this.processSingleRefundUnderLock({
          transactionId: transaction.id,
          refund: ref,
          payment: paymentResource,
        });
        lastOutcome = outcome;
        if (!outcome.success) {
          // Break immediately on financial mismatch or incomplete recovery
          break;
        }
      }

      // Post-commit Self-Healing Reconciliation
      if (lastOutcome.success) {
        await ReconciliationService.reconcileTransaction(transaction.id).catch((err) =>
          console.error("[RefundService] Post-commit reconciliation warning:", err)
        );
      }

      return lastOutcome;
    }

    return {
      success: true,
      status: "IGNORED_NON_FINAL_REFUND",
      message: `Event type ${eventType} is not a handled refund event`,
    };
  }
}
