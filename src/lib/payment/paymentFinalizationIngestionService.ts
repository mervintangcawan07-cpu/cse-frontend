/**
 * GovStudyX — Payment Finalization Ingestion Service (Slice 8E-C)
 *
 * Production-dormant service that ingests an ALREADY AUTHORITATIVELY VERIFIED payment
 * into the durable GovStudyX Phase-1 state.
 *
 * Atomically establishes canonical Transaction, plans manifest, grants entitlement,
 * persists effects, posts balanced PAYMENT_RECEIVED ledger pair, and commits before
 * attempting the coordinator fast-path.
 *
 * Strictly decoupled from provider HTTP verification and live production routes.
 */

import { randomBytes } from "node:crypto";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, PaymentFinalizationSource, PaymentFinalizationFeeKnowledge } from "@prisma/client";
import {
  SUPPORTED_CURRENCY,
} from "./paymentFinalizationContracts";
import {
  PaymentFinalizationManifestService,
  TransactionScopedFinalizationDataReader,
} from "./paymentFinalizationManifestService";
import { IdempotentLedgerService } from "@/lib/accounting/idempotentLedgerService";
import {
  PaymentFinalizationCoordinator,
  type ExecuteFinalizationInput,
  type ExecuteFinalizationOutcome,
  type ExecuteFinalizationResult,
} from "./paymentFinalizationCoordinator";

export type IngestionOutcome =
  | "FRESH_DURABLE_COMMIT"
  | "DURABLE_REPLAY"
  | "LEGACY_ALREADY_FINALIZED"
  | "IDENTITY_CONFLICT"
  | "INVARIANT_CONFLICT";

export interface FastPathExecutionResult {
  readonly attempted: boolean;
  readonly outcome?: ExecuteFinalizationOutcome | "ERROR";
  readonly message?: string;
  readonly details?: {
    readonly completedEffectsCount?: number;
    readonly nextAttemptAt?: Date | null;
    readonly errorCode?: string | null;
  };
}

export interface IngestVerifiedPaymentResult {
  readonly outcome: IngestionOutcome;
  readonly durableCommitted: boolean;
  readonly transactionId?: string;
  readonly finalizationId?: string;
  readonly paidUntil?: Date | null;
  readonly fastPath?: FastPathExecutionResult;
  readonly feeEnrichmentRequired?: boolean;
  readonly conflictCode?: string;
  readonly conflictMessage?: string;
}

export interface IngestVerifiedPaymentInput {
  readonly userId: string;
  readonly checkoutSessionId: string;
  readonly planType: string;
  readonly currency?: string;
  readonly purchaseAmountCentavos: number;
  readonly verifiedAt: Date | string;
  readonly source: PaymentFinalizationSource;
  readonly providerPaymentId?: string | null;
  readonly providerPaidAt?: Date | string | null;
  readonly paymentIntentId?: string | null;
  readonly receiptUrl?: string | null;
  readonly feeKnowledge: PaymentFinalizationFeeKnowledge;
  readonly feeAmountCentavos?: number | null;
}

export interface IPaymentCoordinatorRunner {
  executeFinalization(
    input: ExecuteFinalizationInput
  ): Promise<ExecuteFinalizationResult>;
}

/**
 * Test-only failure injection checkpoints.
 * @internal Test harness dependency injection only.
 */
export type PaymentFinalizationIngestionFaultPoint =
  | "PLANNER"
  | "MANIFEST_PERSIST"
  | "USER_UPDATE"
  | "LEDGER_POST"
  | "EFFECT_COMPLETE";

/**
 * @internal Test harness dependency injection only.
 */
export interface PaymentFinalizationIngestionTestHooks {
  readonly onBeforeStep?: (point: PaymentFinalizationIngestionFaultPoint) => void | Promise<void>;
}

export interface PaymentFinalizationIngestionServiceOptions {
  readonly prisma?: PrismaClient;
  readonly coordinator?: IPaymentCoordinatorRunner;
  /** @internal Test-only fault injector hook. Production default is undefined. */
  readonly testHooks?: PaymentFinalizationIngestionTestHooks;
}

function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[DATABASE_URL_REDACTED]").slice(0, 400);
}

export class PaymentFinalizationIngestionService {
  private readonly prisma: PrismaClient;
  private readonly coordinator?: IPaymentCoordinatorRunner;
  private readonly testHooks?: PaymentFinalizationIngestionTestHooks;

  constructor(options?: PaymentFinalizationIngestionServiceOptions) {
    this.prisma = options?.prisma ?? defaultPrisma;
    this.coordinator = options?.coordinator;
    this.testHooks = options?.testHooks;
  }

  private getCoordinator(): IPaymentCoordinatorRunner {
    if (this.coordinator) {
      return this.coordinator;
    }
    return PaymentFinalizationCoordinator;
  }

  /**
   * Main entry point for durable payment ingestion.
   */
  async ingestVerifiedPayment(input: IngestVerifiedPaymentInput): Promise<IngestVerifiedPaymentResult> {
    const {
      userId,
      checkoutSessionId,
      planType,
      currency = SUPPORTED_CURRENCY,
      purchaseAmountCentavos,
      verifiedAt,
      source,
      providerPaymentId,
      providerPaidAt,
      paymentIntentId,
      receiptUrl,
      feeKnowledge,
      feeAmountCentavos,
    } = input;

    // ────────────────────────────────────────────────────────────
    // 0. Pre-transaction validation & Fail-Closed Invariants
    // ────────────────────────────────────────────────────────────

    // Identifier validation
    if (!checkoutSessionId || typeof checkoutSessionId !== "string" || checkoutSessionId.trim().length === 0) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "INVALID_CHECKOUT_SESSION_ID",
        conflictMessage: "checkoutSessionId must be a non-empty string",
      };
    }

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "INVALID_USER_ID",
        conflictMessage: "userId must be a non-empty string",
      };
    }

    if (source !== "WEBHOOK" && source !== "VERIFY_POLL") {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "INVALID_SOURCE",
        conflictMessage: `Invalid payment source: ${source}`,
      };
    }

    // Supported plan validation
    if (!["1_MONTH", "6_MONTHS", "1_YEAR"].includes(planType)) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "UNSUPPORTED_PLAN_TYPE",
        conflictMessage: `Unsupported planType: ${planType}`,
      };
    }

    // Currency authority
    if (currency !== SUPPORTED_CURRENCY) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "UNSUPPORTED_CURRENCY",
        conflictMessage: `Unsupported currency: ${currency}. Only PHP is supported.`,
      };
    }

    // Representability check (Correction #1: fail closed on fractional pesos)
    if (
      typeof purchaseAmountCentavos !== "number" ||
      !Number.isFinite(purchaseAmountCentavos) ||
      !Number.isSafeInteger(purchaseAmountCentavos) ||
      purchaseAmountCentavos <= 0 ||
      purchaseAmountCentavos % 100 !== 0
    ) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "AMOUNT_UNIT_UNREPRESENTABLE",
        conflictMessage: `purchaseAmountCentavos (${purchaseAmountCentavos}) must be a positive safe integer divisible by 100 to be exactly representable in legacy Transaction.amount`,
      };
    }

    // Fee contract validation
    if (feeKnowledge === "UNKNOWN") {
      if (feeAmountCentavos !== null && feeAmountCentavos !== undefined) {
        return {
          outcome: "INVARIANT_CONFLICT",
          durableCommitted: false,
          conflictCode: "FEE_KNOWLEDGE_UNKNOWN_AMOUNT_PRESENT",
          conflictMessage: "feeAmountCentavos must be null/undefined when feeKnowledge is UNKNOWN",
        };
      }
    } else if (feeKnowledge === "KNOWN") {
      if (
        feeAmountCentavos === null ||
        feeAmountCentavos === undefined ||
        typeof feeAmountCentavos !== "number" ||
        !Number.isFinite(feeAmountCentavos) ||
        !Number.isSafeInteger(feeAmountCentavos) ||
        feeAmountCentavos < 0
      ) {
        return {
          outcome: "INVARIANT_CONFLICT",
          durableCommitted: false,
          conflictCode: "FEE_KNOWLEDGE_KNOWN_INVALID_AMOUNT",
          conflictMessage: "feeAmountCentavos must be a non-negative safe integer when feeKnowledge is KNOWN",
        };
      }
    } else {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "INVALID_FEE_KNOWLEDGE",
        conflictMessage: `Invalid feeKnowledge value: ${feeKnowledge}`,
      };
    }

    const verifiedAtDate = verifiedAt instanceof Date ? verifiedAt : new Date(verifiedAt);
    if (Number.isNaN(verifiedAtDate.getTime())) {
      return {
        outcome: "INVARIANT_CONFLICT",
        durableCommitted: false,
        conflictCode: "INVALID_VERIFIED_AT",
        conflictMessage: "verifiedAt is not a valid date",
      };
    }

    const providerPaidAtDate = providerPaidAt
      ? providerPaidAt instanceof Date
      ? providerPaidAt
      : new Date(providerPaidAt)
      : null;

    // ────────────────────────────────────────────────────────────
    // 1. ATOMIC PHASE 1 DATABASE TRANSACTION
    // ────────────────────────────────────────────────────────────
    let txResult: {
      outcome: IngestionOutcome;
      durableCommitted: boolean;
      transactionId?: string;
      finalizationId?: string;
      paidUntil?: Date | null;
      feeEnrichmentRequired?: boolean;
      conflictCode?: string;
      conflictMessage?: string;
      fastPathEligible?: boolean;
    };

    try {
      txResult = await this.prisma.$transaction(
        async (tx) => {
          // 🔒 1. Checkout Session advisory lock (Level 0)
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${checkoutSessionId}, 0)
            )::text AS lock_result
          `;

          // 🔍 2. Resolve existing state under checkout lock
          const existingTxn = await tx.transaction.findUnique({
            where: { checkoutSessionId },
          });

          const existingPfin = await tx.paymentFinalization.findUnique({
            where: { checkoutSessionId },
            include: { effects: true },
          });

          // 🔒 3. User-Entitlement advisory lock (Level 4)
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`user-entitlement:${userId}`}, 0)
            )::text AS lock_result
          `;

          // ────────────────────────────────────────────────────────────
          // State Machine: Case B — Existing Durable PaymentFinalization
          // ────────────────────────────────────────────────────────────
          if (existingPfin) {
            // Case E: Broken relation
            if (!existingTxn || existingPfin.transactionId !== existingTxn.id) {
              return {
                outcome: "INVARIANT_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "BROKEN_RELATION",
                conflictMessage: "PaymentFinalization exists without matching canonical Transaction",
              };
            }

            // Immutable identity cross-checks
            if (existingTxn.userId !== userId) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "USER_ID_MISMATCH",
                conflictMessage: "Existing durable payment belongs to a different user",
              };
            }
            if (existingPfin.planType !== planType) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "PLAN_TYPE_MISMATCH",
                conflictMessage: "Existing durable payment has conflicting planType",
              };
            }
            if (existingPfin.purchaseAmountCentavos !== purchaseAmountCentavos) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "PURCHASE_AMOUNT_MISMATCH",
                conflictMessage: "Existing durable payment has conflicting purchaseAmountCentavos",
              };
            }
            if (existingPfin.currency !== currency) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "CURRENCY_MISMATCH",
                conflictMessage: "Existing durable payment has conflicting currency",
              };
            }

            // Provider Payment ID check (Correction #4: Replay with missing or existing providerPaymentId)
            if (
              existingPfin.providerPaymentId &&
              providerPaymentId &&
              existingPfin.providerPaymentId !== providerPaymentId
            ) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "PROVIDER_PAYMENT_ID_MISMATCH",
                conflictMessage: "Existing durable payment has conflicting providerPaymentId",
              };
            }

            // Fee check on replay (Correction #4 / Spec: Unknown fee replay rule)
            let feeEnrichmentRequired = false;
            if (existingPfin.feeKnowledge === "KNOWN" && feeKnowledge === "KNOWN") {
              if (existingPfin.feeAmountCentavos !== feeAmountCentavos) {
                return {
                  outcome: "IDENTITY_CONFLICT" as const,
                  durableCommitted: false,
                  conflictCode: "FEE_AMOUNT_MISMATCH",
                  conflictMessage: "Existing durable payment has conflicting known fee amount",
                };
              }
            } else if (existingPfin.feeKnowledge === "UNKNOWN" && feeKnowledge === "KNOWN") {
              // Existing is UNKNOWN, replay supplies KNOWN fee -> DO NOT enrich in Slice 8E-C (Slice 8F responsibility)
              feeEnrichmentRequired = true;
            }

            // Valid durable replay: fetch user paidUntil
            const currentUser = await tx.user.findUnique({
              where: { id: userId },
              select: { paidUntil: true },
            });

            return {
              outcome: "DURABLE_REPLAY" as const,
              durableCommitted: true,
              transactionId: existingTxn.id,
              finalizationId: existingPfin.id,
              paidUntil: currentUser?.paidUntil ?? null,
              feeEnrichmentRequired,
              fastPathEligible: existingPfin.status !== "COMPLETE",
            };
          }

          // ────────────────────────────────────────────────────────────
          // State Machine: Case C — Existing Transaction PAID, no finalization
          // ────────────────────────────────────────────────────────────
          if (existingTxn && existingTxn.status === "PAID") {
            if (existingTxn.userId !== userId) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "USER_ID_MISMATCH",
                conflictMessage: "Existing legacy payment belongs to a different user",
              };
            }
            return {
              outcome: "LEGACY_ALREADY_FINALIZED" as const,
              durableCommitted: false,
              transactionId: existingTxn.id,
              conflictCode: "LEGACY_PAYMENT_FINALIZED",
              conflictMessage: "Payment was finalized under legacy architecture; durable adoption belongs to Slice 8J",
            };
          }

          // ────────────────────────────────────────────────────────────
          // State Machine: Case D — Existing Transaction non-PAID, no finalization
          // ────────────────────────────────────────────────────────────
          if (existingTxn && existingTxn.status !== "PAID") {
            return {
              outcome: "INVARIANT_CONFLICT" as const,
              durableCommitted: false,
              transactionId: existingTxn.id,
              conflictCode: "EXISTING_NON_PAID_TRANSACTION",
              conflictMessage: `Existing transaction has non-PAID status: ${existingTxn.status}`,
            };
          }

          // ────────────────────────────────────────────────────────────
          // State Machine: Case A — Fresh Durable Ingestion
          // ────────────────────────────────────────────────────────────

          // Provider payment ID cross-check across different checkouts
          if (providerPaymentId) {
            const existingByProvider = await tx.paymentFinalization.findUnique({
              where: { providerPaymentId },
            });
            if (existingByProvider) {
              return {
                outcome: "IDENTITY_CONFLICT" as const,
                durableCommitted: false,
                conflictCode: "PROVIDER_PAYMENT_ALREADY_INGESTED",
                conflictMessage: `providerPaymentId ${providerPaymentId} is already associated with checkoutSessionId ${existingByProvider.checkoutSessionId}`,
              };
            }
          }

          // Verify user exists before proceeding
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, isPaid: true, paidUntil: true },
          });
          if (!user) {
            return {
              outcome: "INVARIANT_CONFLICT" as const,
              durableCommitted: false,
              conflictCode: "USER_NOT_FOUND",
              conflictMessage: `User ${userId} not found`,
            };
          }

          // 📝 Create canonical Transaction with status PAID and createdAt = verifiedAtDate
          const transactionId = `txn_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
          const amountPesos = purchaseAmountCentavos / 100;
          const fee = feeKnowledge === "KNOWN" ? feeAmountCentavos ?? 0 : null;

          const createdTxn = await tx.transaction.create({
            data: {
              id: transactionId,
              userId,
              checkoutSessionId,
              paymentIntentId: paymentIntentId ?? `pi_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
              amount: amountPesos,
              grossAmountCentavos: purchaseAmountCentavos,
              discountAmountCentavos: 0,
              feeAmountCentavos: fee,
              netSettlementCentavos: fee !== null ? purchaseAmountCentavos - fee : null,
              planType,
              status: "PAID",
              receiptUrl: receiptUrl ?? null,
              createdAt: verifiedAtDate,
              updatedAt: verifiedAtDate,
            },
          });

          await this.testHooks?.onBeforeStep?.("PLANNER");

          // 📋 Plan finalization manifest using TransactionScopedFinalizationDataReader(tx)
          // CRITICAL: User has NOT been mutated yet; reader observes pre-grant User state!
          const scopedReader = new TransactionScopedFinalizationDataReader(tx);
          const manifest = await PaymentFinalizationManifestService.planFinalization(
            {
              transactionId: createdTxn.id,
              checkoutSessionId,
              userId,
              planType,
              purchaseAmountCentavos,
              authoritativeGrossAmountCentavos: purchaseAmountCentavos,
              feeKnowledge,
              feeAmountCentavos: feeKnowledge === "KNOWN" ? feeAmountCentavos ?? 0 : undefined,
              feeObservedAtIso: feeKnowledge === "KNOWN" ? verifiedAtDate.toISOString() : undefined,
              providerPaymentId: providerPaymentId ?? undefined,
              providerPaidAtIso: providerPaidAtDate?.toISOString(),
              source,
              origin: "NEW_PAYMENT",
              currency,
              verifiedAtIso: verifiedAtDate.toISOString(),
            },
            scopedReader
          );

          await this.testHooks?.onBeforeStep?.("MANIFEST_PERSIST");

          // 💾 Persist PaymentFinalization and 7 effects
          const finalizationId = `pfin_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
          const effectRows = manifest.effects.map((eff) => ({
            id: `eff_${eff.effectType.toLowerCase()}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
            effectType: eff.effectType,
            effectKey: eff.effectKey,
            operationKey: eff.operationKey,
            status: eff.status,
            intentVersion: eff.intentVersion,
            intent: eff.intent as unknown as Prisma.InputJsonValue,
            intentHash: eff.intentHash,
            attemptCount: 0,
            nextAttemptAt: verifiedAtDate,
            completedAt: null,
          }));

          await tx.paymentFinalization.create({
            data: {
              id: finalizationId,
              transactionId: createdTxn.id,
              checkoutSessionId,
              providerPaymentId: manifest.providerPaymentId,
              providerPaidAt: manifest.providerPaidAt ? new Date(manifest.providerPaidAt) : null,
              source: manifest.source,
              origin: manifest.origin,
              status: "PENDING",
              manifestVersion: manifest.manifestVersion,
              manifestRevision: manifest.manifestRevision,
              manifestHash: manifest.manifestHash,
              planType: manifest.planType,
              currency: manifest.currency,
              purchaseAmountCentavos: manifest.purchaseAmountCentavos,
              feeKnowledge: manifest.feeKnowledge,
              feeAmountCentavos: manifest.feeAmountCentavos,
              feeObservedAt: manifest.feeObservedAt ? new Date(manifest.feeObservedAt) : null,
              entitlementBefore: manifest.entitlementBefore ? new Date(manifest.entitlementBefore) : null,
              entitlementAfter: manifest.entitlementAfter ? new Date(manifest.entitlementAfter) : null,
              verifiedAt: verifiedAtDate,
              attemptCount: 0,
              nextAttemptAt: verifiedAtDate,
              effects: {
                create: effectRows,
              },
            },
          });

          await this.testHooks?.onBeforeStep?.("USER_UPDATE");

          // 👤 Update User entitlement to EXACTLY manifest.entitlementAfter
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              isPaid: true,
              planType: manifest.planType,
              paidUntil: manifest.entitlementAfter ? new Date(manifest.entitlementAfter) : null,
            },
          });

          await this.testHooks?.onBeforeStep?.("LEDGER_POST");

          // 📖 Post PAYMENT_RECEIVED balanced double-entry ledger pair
          const paymentEffect = effectRows.find((e) => e.effectType === "PAYMENT_LEDGER");
          if (!paymentEffect) {
            throw new Error("Missing PAYMENT_LEDGER effect in planned manifest");
          }

          const ledgerResult = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
            {
              transactionId: createdTxn.id,
              finalizationEffectId: paymentEffect.id,
              operation: { kind: "PAYMENT" },
              operationKey: paymentEffect.operationKey,
              transactionType: "PAYMENT_RECEIVED",
              amountCentavos: manifest.purchaseAmountCentavos,
              debitCategory: "CASH_PAYMONGO",
              creditCategory: "REVENUE_PREMIUM",
              effectiveDate: verifiedAtDate,
              currency,
              sourceEntity: "PaymentFinalization",
              sourceId: finalizationId,
              description: `Subscription payment ${manifest.planType}`,
              createdBy: null,
              periodId: null,
            },
            tx
          );

          if (!ledgerResult.debitEntry || !ledgerResult.creditEntry) {
            throw new Error("Failed to create balanced payment ledger entries");
          }

          await this.testHooks?.onBeforeStep?.("EFFECT_COMPLETE");

          // ✅ Transition PAYMENT_LEDGER effect to COMPLETE
          await tx.paymentFinalizationEffect.update({
            where: { id: paymentEffect.id },
            data: {
              status: "COMPLETE",
              completedAt: verifiedAtDate,
            },
          });

          return {
            outcome: "FRESH_DURABLE_COMMIT" as const,
            durableCommitted: true,
            transactionId: createdTxn.id,
            finalizationId,
            paidUntil: updatedUser.paidUntil,
            fastPathEligible: true,
          };
        },
        { timeout: 25_000, maxWait: 15_000 }
      );
    } catch (error: unknown) {
      // Catch PostgreSQL unique constraint violations (P2002) for providerPaymentId or checkoutSessionId
      const err = error as { code?: string; meta?: { target?: unknown }; message?: string } | null;
      if (err && typeof err === "object" && err.code === "P2002") {
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(",")
          : String(err.meta?.target || "");
        const errorMsg = String(err.message || "");
        if (target.includes("providerPaymentId") || errorMsg.includes("providerPaymentId")) {
          return {
            outcome: "IDENTITY_CONFLICT",
            durableCommitted: false,
            conflictCode: "PROVIDER_PAYMENT_ALREADY_INGESTED",
            conflictMessage: "Concurrent ingestion with identical providerPaymentId failed unique constraint",
          };
        }
        if (target.includes("checkoutSessionId") || errorMsg.includes("checkoutSessionId")) {
          return {
            outcome: "IDENTITY_CONFLICT",
            durableCommitted: false,
            conflictCode: "CHECKOUT_SESSION_ALREADY_INGESTED",
            conflictMessage: "Concurrent ingestion with identical checkoutSessionId failed unique constraint",
          };
        }
        if (target.includes("operationKey") || errorMsg.includes("operationKey")) {
          return {
            outcome: "IDENTITY_CONFLICT",
            durableCommitted: false,
            conflictCode: "OPERATION_KEY_ALREADY_EXISTS",
            conflictMessage: "Concurrent ingestion collided on unique operationKey",
          };
        }
        return {
          outcome: "IDENTITY_CONFLICT",
          durableCommitted: false,
          conflictCode: "CONCURRENT_UNIQUE_CONSTRAINT_CONFLICT",
          conflictMessage: "Unique constraint collision occurred during concurrent ingestion",
        };
      }
      throw error;
    }

    // If transaction returned a non-committed conflict result, return immediately
    if (!txResult.durableCommitted || !txResult.fastPathEligible || !txResult.finalizationId) {
      return {
        outcome: txResult.outcome,
        durableCommitted: txResult.durableCommitted,
        transactionId: txResult.transactionId,
        finalizationId: txResult.finalizationId,
        paidUntil: txResult.paidUntil,
        feeEnrichmentRequired: txResult.feeEnrichmentRequired,
        conflictCode: txResult.conflictCode,
        conflictMessage: txResult.conflictMessage,
        fastPath: {
          attempted: false,
        },
      };
    }

    // ────────────────────────────────────────────────────────────
    // 2. POST-COMMIT COORDINATOR FAST PATH (Outside DB Transaction)
    // ────────────────────────────────────────────────────────────
    let fastPath: FastPathExecutionResult;
    try {
      const coordinator = this.getCoordinator();
      const coordResult = await coordinator.executeFinalization({
        finalizationId: txResult.finalizationId,
        workerId: `ingest_fast_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
        now: new Date(),
      });

      fastPath = {
        attempted: true,
        outcome: coordResult.outcome,
        message: coordResult.errorCode ? `Coordinator ended with error: ${coordResult.errorCode}` : undefined,
        details: {
          completedEffectsCount: coordResult.completedEffectIds.length,
          nextAttemptAt: coordResult.nextAttemptAt,
          errorCode: coordResult.errorCode,
        },
      };
    } catch (coordError) {
      fastPath = {
        attempted: true,
        outcome: "ERROR",
        message: sanitizeErrorMessage(coordError),
      };
    }

    return {
      outcome: txResult.outcome,
      durableCommitted: true,
      transactionId: txResult.transactionId,
      finalizationId: txResult.finalizationId,
      paidUntil: txResult.paidUntil,
      feeEnrichmentRequired: txResult.feeEnrichmentRequired,
      fastPath,
    };
  }
}
