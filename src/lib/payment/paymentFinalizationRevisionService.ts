// Relative Path: src/lib/payment/paymentFinalizationRevisionService.ts
/**
 * GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 8F-B)
 *
 * Immutable Manifest Revision Foundation.
 * Provides canonical snapshot reconstruction, independent intent/root hash verification,
 * parent->child revision chaining, and atomic CAS-first transition primitives.
 *
 * Application-level append-only immutable revision history:
 * ZERO production update/delete/upsert methods on PaymentFinalizationManifestRevision.
 * STRICTLY DORMANT - ZERO APP ROUTE WIRING - ZERO EXTERNAL NETWORK CALLS.
 */

import type { Prisma, PaymentFinalization, PaymentFinalizationEffect, PaymentFinalizationManifestRevision, Transaction } from "@prisma/client";
import {
  canonicalizeJson,
  computeSha256Hash,
  SUPPORTED_MANIFEST_REVISIONS,
  type SupportedManifestRevision,
  type SupportedPlanType,
  SUPPORTED_PLAN_TYPES,
  type PaymentFinalizationSource,
  type PaymentFinalizationOrigin,
  type PaymentFinalizationEffectType,
  type PaymentFinalizationFeeKnowledge,
  type PaymentFinalizationManifestRevisionReason,
  type PaymentFinalizationManifestSnapshot,
  type EffectManifestSnapshot,
} from "./paymentFinalizationContracts";

export type LoadedFinalizationWithEffects = PaymentFinalization & {
  readonly transaction: Transaction;
  readonly effects: readonly PaymentFinalizationEffect[];
  readonly revisions?: readonly PaymentFinalizationManifestRevision[];
};

export class RevisionInvariantError extends Error {
  readonly name = "RevisionInvariantError";
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RevisionConcurrencyError extends Error {
  readonly name = "RevisionConcurrencyError";
  readonly code = "REVISION_CONCURRENTLY_CHANGED";
  constructor(message: string = "Manifest revision was concurrently modified.") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const EFFECT_TYPE_RANK: Readonly<Record<PaymentFinalizationEffectType, number>> = {
  PAYMENT_LEDGER: 0,
  PROVIDER_FEE_LEDGER: 1,
  REFERRAL_REWARD: 2,
  PARTNER_COMMISSION: 3,
  PARTNER_LIABILITY_LEDGER: 4,
  TAX_PROVISION: 5,
  RECONCILIATION: 6,
};

export function compareSnapshotEffects(
  left: { readonly effectType: PaymentFinalizationEffectType; readonly effectKey: string; readonly operationKey: string; readonly id?: string },
  right: { readonly effectType: PaymentFinalizationEffectType; readonly effectKey: string; readonly operationKey: string; readonly id?: string }
): number {
  const rankDifference = EFFECT_TYPE_RANK[left.effectType] - EFFECT_TYPE_RANK[right.effectType];
  if (rankDifference !== 0) return rankDifference;
  const keyDifference = left.effectKey.localeCompare(right.effectKey);
  if (keyDifference !== 0) return keyDifference;
  if (left.id && right.id) {
    return left.id.localeCompare(right.id);
  }
  return left.operationKey.localeCompare(right.operationKey);
}

function originalPlannedStatus(intent: unknown): string {
  if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
    throw new RevisionInvariantError("INVALID_IMMUTABLE_INTENT", "Intent must be a JSON object.");
  }
  const status = (intent as Record<string, unknown>).status;
  if (typeof status !== "string") {
    throw new RevisionInvariantError("INVALID_IMMUTABLE_INTENT", "Intent missing status string.");
  }
  return status;
}

export class PaymentFinalizationRevisionService {
  /**
   * Reconstructs the canonical manifest snapshot from loaded database records.
   * Independently verifies each effect intent hash and root manifest hash.
   */
  static buildCanonicalSnapshot(
    finalization: LoadedFinalizationWithEffects
  ): PaymentFinalizationManifestSnapshot {
    if (
      !SUPPORTED_MANIFEST_REVISIONS.includes(
        finalization.manifestRevision as SupportedManifestRevision
      )
    ) {
      throw new RevisionInvariantError(
        "UNSUPPORTED_VERSION",
        `Unsupported manifestRevision: ${finalization.manifestRevision}`
      );
    }

    const effects: EffectManifestSnapshot[] = [];
    for (const effect of finalization.effects) {
      const intentRecord = effect.intent as Record<string, unknown>;
      const computedIntentHash = computeSha256Hash(canonicalizeJson(intentRecord));
      if (computedIntentHash !== effect.intentHash) {
        throw new RevisionInvariantError(
          "EFFECT_HASH_MISMATCH",
          `Intent hash mismatch for effect ${effect.effectKey}`
        );
      }
      const plannedStatus = originalPlannedStatus(intentRecord);
      effects.push({
        effectType: effect.effectType,
        effectKey: effect.effectKey,
        operationKey: effect.operationKey,
        status: plannedStatus,
        intentVersion: effect.intentVersion,
        intentHash: effect.intentHash,
        intent: intentRecord,
      });
    }

    effects.sort(compareSnapshotEffects);

    const snapshot: PaymentFinalizationManifestSnapshot = {
      manifestVersion: 1,
      manifestRevision: finalization.manifestRevision as SupportedManifestRevision,
      transactionId: finalization.transactionId,
      checkoutSessionId: finalization.checkoutSessionId,
      userId: finalization.transaction.userId,
      providerPaymentId: finalization.providerPaymentId,
      providerPaidAt: finalization.providerPaidAt?.toISOString() ?? null,
      source: finalization.source,
      origin: finalization.origin,
      planType: finalization.planType as SupportedPlanType,
      currency: "PHP",
      purchaseAmountCentavos: finalization.purchaseAmountCentavos,
      feeKnowledge: finalization.feeKnowledge,
      feeAmountCentavos: finalization.feeAmountCentavos,
      feeObservedAt: finalization.feeObservedAt?.toISOString() ?? null,
      verifiedAt: finalization.verifiedAt.toISOString(),
      entitlementBefore: finalization.entitlementBefore?.toISOString() ?? null,
      entitlementAfter: finalization.entitlementAfter?.toISOString() ?? null,
      manifestHash: finalization.manifestHash,
      effects,
    };

    const recomputedRootHash = this.recomputeSnapshotManifestHash(snapshot);
    if (recomputedRootHash !== finalization.manifestHash) {
      throw new RevisionInvariantError(
        "MANIFEST_HASH_MISMATCH",
        "Recomputed root manifest hash does not match stored manifestHash."
      );
    }

    return snapshot;
  }

  /**
   * Deterministically recomputes the root manifestHash from a manifest snapshot.
   */
  static recomputeSnapshotManifestHash(
    snapshot: PaymentFinalizationManifestSnapshot
  ): string {
    const orderedEffects = [...snapshot.effects].sort(compareSnapshotEffects);
    const manifestSummary = {
      manifestVersion: snapshot.manifestVersion,
      manifestRevision: snapshot.manifestRevision,
      transactionId: snapshot.transactionId,
      checkoutSessionId: snapshot.checkoutSessionId,
      userId: snapshot.userId,
      providerPaymentId: snapshot.providerPaymentId,
      providerPaidAt: snapshot.providerPaidAt,
      source: snapshot.source,
      origin: snapshot.origin,
      planType: snapshot.planType,
      currency: snapshot.currency,
      purchaseAmountCentavos: snapshot.purchaseAmountCentavos,
      feeKnowledge: snapshot.feeKnowledge,
      feeAmountCentavos: snapshot.feeAmountCentavos,
      feeObservedAt: snapshot.feeObservedAt,
      verifiedAt: snapshot.verifiedAt,
      entitlementBefore: snapshot.entitlementBefore,
      entitlementAfter: snapshot.entitlementAfter,
      effects: orderedEffects.map((effect) => ({
        effectType: effect.effectType,
        effectKey: effect.effectKey,
        operationKey: effect.operationKey,
        status: effect.status,
        intentVersion: effect.intentVersion,
        intentHash: effect.intentHash,
      })),
    };

    return computeSha256Hash(canonicalizeJson(manifestSummary));
  }

  /**
   * Independently verifies every effect intent in a snapshot against its declared intentHash.
   */
  static verifySnapshotIntents(
    snapshot: PaymentFinalizationManifestSnapshot
  ): boolean {
    for (const effect of snapshot.effects) {
      const computed = computeSha256Hash(canonicalizeJson(effect.intent));
      if (computed !== effect.intentHash) {
        return false;
      }
    }
    return true;
  }

  /**
   * Fully validates a candidate Revision-2 snapshot against current state.
   */
  static verifyCandidateSnapshot(
    candidate: PaymentFinalizationManifestSnapshot,
    currentParent: LoadedFinalizationWithEffects
  ): void {
    if (candidate.manifestVersion !== 1 || candidate.manifestRevision !== 2) {
      throw new RevisionInvariantError(
        "UNSUPPORTED_VERSION",
        "Candidate snapshot must be manifestVersion 1, manifestRevision 2."
      );
    }
    if (
      candidate.transactionId !== currentParent.transactionId ||
      candidate.checkoutSessionId !== currentParent.checkoutSessionId ||
      candidate.userId !== currentParent.transaction.userId ||
      candidate.purchaseAmountCentavos !== currentParent.purchaseAmountCentavos ||
      candidate.currency !== currentParent.currency
    ) {
      throw new RevisionInvariantError(
        "TRANSACTION_IDENTITY_MISMATCH",
        "Candidate snapshot identities do not match current transaction."
      );
    }

    if (!this.verifySnapshotIntents(candidate)) {
      throw new RevisionInvariantError(
        "EFFECT_HASH_MISMATCH",
        "Candidate effect intent hash does not match computed hash."
      );
    }

    const recomputedHash = this.recomputeSnapshotManifestHash(candidate);
    if (recomputedHash !== candidate.manifestHash) {
      throw new RevisionInvariantError(
        "MANIFEST_HASH_MISMATCH",
        "Candidate root manifest hash does not match recomputed hash."
      );
    }

    // Verify topology parity with current effects
    const currentTypes = new Set(currentParent.effects.map((e) => `${e.effectType}:${e.effectKey}`));
    const candidateTypes = new Set(candidate.effects.map((e) => `${e.effectType}:${e.effectKey}`));
    if (currentTypes.size !== candidateTypes.size) {
      throw new RevisionInvariantError(
        "MANIFEST_TOPOLOGY_INVALID",
        "Candidate effect topology cardinality differs from current manifest."
      );
    }
    for (const key of currentTypes) {
      if (!candidateTypes.has(key)) {
        throw new RevisionInvariantError(
          "MANIFEST_TOPOLOGY_INVALID",
          `Candidate missing effect: ${key}`
        );
      }
    }
  }

  /**
   * Enforces and validates the full revision chain for coordinator execution.
   */
  static verifyRevisionChain(
    revisions: readonly PaymentFinalizationManifestRevision[],
    currentFinalization: LoadedFinalizationWithEffects
  ): void {
    if (currentFinalization.manifestRevision === 1) {
      // Revision 1 requires no archive records for execution
      return;
    }

    if (currentFinalization.manifestRevision === 2) {
      if (!revisions || revisions.length < 2) {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "Revision 2 execution requires complete R1 and R2 revision archive history."
        );
      }

      const r1 = revisions.find((r) => r.manifestRevision === 1);
      const r2 = revisions.find((r) => r.manifestRevision === 2);
      if (!r1 || !r2) {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "Missing R1 or R2 revision archive record."
        );
      }

      if (r1.parentManifestHash !== null) {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "Genesis R1 archive must have parentManifestHash null."
        );
      }
      if (r1.revisionReason !== "INITIAL_INGESTION") {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "R1 revisionReason must be INITIAL_INGESTION."
        );
      }

      if (r2.parentManifestHash !== r1.manifestHash) {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "R2 parentManifestHash does not equal R1 manifestHash."
        );
      }
      if (r2.revisionReason !== "PROVIDER_FEE_ENRICHMENT") {
        throw new RevisionInvariantError(
          "REVISION_CHAIN_INVALID",
          "R2 revisionReason must be PROVIDER_FEE_ENRICHMENT."
        );
      }

      // Reconstruct and verify R1 snapshot
      const r1Snapshot = r1.snapshot as unknown as PaymentFinalizationManifestSnapshot;
      if (!this.verifySnapshotIntents(r1Snapshot)) {
        throw new RevisionInvariantError(
          "EFFECT_HASH_MISMATCH",
          "R1 archive effect intent hash verification failed."
        );
      }
      if (this.recomputeSnapshotManifestHash(r1Snapshot) !== r1.manifestHash) {
        throw new RevisionInvariantError(
          "MANIFEST_HASH_MISMATCH",
          "R1 archive root manifest hash verification failed."
        );
      }

      // Reconstruct and verify R2 snapshot
      const r2Snapshot = r2.snapshot as unknown as PaymentFinalizationManifestSnapshot;
      if (!this.verifySnapshotIntents(r2Snapshot)) {
        throw new RevisionInvariantError(
          "EFFECT_HASH_MISMATCH",
          "R2 archive effect intent hash verification failed."
        );
      }
      if (this.recomputeSnapshotManifestHash(r2Snapshot) !== r2.manifestHash) {
        throw new RevisionInvariantError(
          "MANIFEST_HASH_MISMATCH",
          "R2 archive root manifest hash verification failed."
        );
      }

      // Current projection must match R2 archive hash
      if (currentFinalization.manifestHash !== r2.manifestHash) {
        throw new RevisionInvariantError(
          "MANIFEST_HASH_MISMATCH",
          "Current PaymentFinalization manifestHash does not match R2 archive manifestHash."
        );
      }
      return;
    }

    throw new RevisionInvariantError(
      "UNSUPPORTED_VERSION",
      `Unsupported manifestRevision: ${currentFinalization.manifestRevision}`
    );
  }

  /**
   * Atomic, caller-owned transaction primitive to transition from Revision 1 to Revision 2.
   *
   * Executes CAS-first:
   * 1. Reconstructs and verifies R1 snapshot
   * 2. Completely verifies candidate R2 snapshot
   * 3. Executes CAS updateMany on PaymentFinalization
   *    (fails closed with REVISION_CONCURRENTLY_CHANGED if count !== 1)
   * 4. Updates current child effect projections from verified R2 candidate
   * 5. Appends immutable R1 archive row
   * 6. Appends immutable R2 archive row
   * 7. Returns transition result
   */
  static async transitionToNextRevision(
    tx: Prisma.TransactionClient,
    input: {
      readonly finalizationId: string;
      readonly expectedCurrentRevision: 1;
      readonly expectedCurrentManifestHash: string;
      readonly candidateR2Snapshot: PaymentFinalizationManifestSnapshot;
    }
  ): Promise<{
    readonly finalizationId: string;
    readonly previousRevision: 1;
    readonly currentRevision: 2;
    readonly r1ManifestHash: string;
    readonly r2ManifestHash: string;
    readonly r1ArchiveId: string;
    readonly r2ArchiveId: string;
  }> {
    const current = await tx.paymentFinalization.findUnique({
      where: { id: input.finalizationId },
      include: { transaction: true, effects: true },
    });
    if (!current) {
      throw new RevisionInvariantError("REVISION_NOT_FOUND", "PaymentFinalization not found.");
    }

    if (current.manifestRevision !== input.expectedCurrentRevision) {
      throw new RevisionConcurrencyError(
        `Expected revision ${input.expectedCurrentRevision} but found ${current.manifestRevision}`
      );
    }
    if (current.manifestHash !== input.expectedCurrentManifestHash) {
      throw new RevisionConcurrencyError("Manifest hash changed concurrently.");
    }

    // Step 1: Reconstruct and verify R1 snapshot
    const r1Snapshot = this.buildCanonicalSnapshot(current);

    // Step 2: Fully verify candidate R2 snapshot
    this.verifyCandidateSnapshot(input.candidateR2Snapshot, current);

    // Step 3: CAS update on current projection parent
    const casResult = await tx.paymentFinalization.updateMany({
      where: {
        id: current.id,
        manifestRevision: 1,
        manifestHash: current.manifestHash,
      },
      data: {
        manifestRevision: 2,
        manifestHash: input.candidateR2Snapshot.manifestHash,
        feeKnowledge: input.candidateR2Snapshot.feeKnowledge,
        feeAmountCentavos: input.candidateR2Snapshot.feeAmountCentavos,
        feeObservedAt: input.candidateR2Snapshot.feeObservedAt
          ? new Date(input.candidateR2Snapshot.feeObservedAt)
          : null,
      },
    });

    if (casResult.count !== 1) {
      throw new RevisionConcurrencyError(
        "Manifest revision was concurrently modified (CAS failed)."
      );
    }

    // Step 4: Apply verified effect updates to current projection
    for (const candidateEffect of input.candidateR2Snapshot.effects) {
      const existing = current.effects.find(
        (e) => e.effectType === candidateEffect.effectType && e.effectKey === candidateEffect.effectKey
      );
      if (!existing) {
        throw new RevisionInvariantError(
          "MANIFEST_TOPOLOGY_INVALID",
          `Missing existing effect for ${candidateEffect.effectKey}`
        );
      }

      // Preserve terminal lifecycle statuses (COMPLETE or NOT_APPLICABLE)
      // Only transition pending/awaiting_data/failed_retryable statuses
      const statusToSet =
        existing.status === "COMPLETE" || existing.status === "NOT_APPLICABLE"
          ? existing.status
          : (candidateEffect.status as PaymentFinalizationEffect["status"]);

      await tx.paymentFinalizationEffect.update({
        where: { id: existing.id },
        data: {
          intent: candidateEffect.intent as unknown as Prisma.InputJsonValue,
          intentHash: candidateEffect.intentHash,
          status: statusToSet,
        },
      });
    }

    // Step 5: Persist immutable R1 archive row
    const r1Archive = await tx.paymentFinalizationManifestRevision.create({
      data: {
        finalizationId: current.id,
        manifestVersion: 1,
        manifestRevision: 1,
        manifestHash: current.manifestHash,
        parentManifestHash: null,
        revisionReason: "INITIAL_INGESTION",
        snapshot: r1Snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    // Step 6: Persist immutable R2 archive row
    const r2Archive = await tx.paymentFinalizationManifestRevision.create({
      data: {
        finalizationId: current.id,
        manifestVersion: 1,
        manifestRevision: 2,
        manifestHash: input.candidateR2Snapshot.manifestHash,
        parentManifestHash: current.manifestHash,
        revisionReason: "PROVIDER_FEE_ENRICHMENT",
        snapshot: input.candidateR2Snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      finalizationId: current.id,
      previousRevision: 1,
      currentRevision: 2,
      r1ManifestHash: current.manifestHash,
      r2ManifestHash: input.candidateR2Snapshot.manifestHash,
      r1ArchiveId: r1Archive.id,
      r2ArchiveId: r2Archive.id,
    };
  }
}
