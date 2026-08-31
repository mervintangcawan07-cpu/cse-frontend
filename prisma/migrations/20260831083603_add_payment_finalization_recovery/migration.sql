-- CreateEnum
CREATE TYPE "PaymentFinalizationStatus" AS ENUM ('PENDING', 'PROCESSING', 'FAILED_RETRYABLE', 'COMPLETE', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentFinalizationEffectStatus" AS ENUM ('PENDING', 'AWAITING_DATA', 'FAILED_RETRYABLE', 'COMPLETE', 'NOT_APPLICABLE', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentFinalizationEffectType" AS ENUM ('PAYMENT_LEDGER', 'PROVIDER_FEE_LEDGER', 'REFERRAL_REWARD', 'PARTNER_COMMISSION', 'PARTNER_LIABILITY_LEDGER', 'TAX_PROVISION', 'RECONCILIATION');

-- CreateEnum
CREATE TYPE "PaymentFinalizationSource" AS ENUM ('WEBHOOK', 'VERIFY_POLL');

-- CreateEnum
CREATE TYPE "PaymentFinalizationOrigin" AS ENUM ('NEW_PAYMENT', 'LEGACY_ADOPTED');

-- CreateEnum
CREATE TYPE "PaymentFinalizationFeeKnowledge" AS ENUM ('UNKNOWN', 'KNOWN');

-- CreateTable
CREATE TABLE "PaymentFinalization" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerPaidAt" TIMESTAMP(3),
    "source" "PaymentFinalizationSource" NOT NULL,
    "origin" "PaymentFinalizationOrigin" NOT NULL DEFAULT 'NEW_PAYMENT',
    "status" "PaymentFinalizationStatus" NOT NULL DEFAULT 'PENDING',
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "manifestRevision" INTEGER NOT NULL DEFAULT 1,
    "manifestHash" VARCHAR(64) NOT NULL,
    "planType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "purchaseAmountCentavos" INTEGER NOT NULL,
    "feeKnowledge" "PaymentFinalizationFeeKnowledge" NOT NULL DEFAULT 'UNKNOWN',
    "feeAmountCentavos" INTEGER,
    "feeObservedAt" TIMESTAMP(3),
    "entitlementBefore" TIMESTAMP(3),
    "entitlementAfter" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" VARCHAR(64),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(64),
    "lastErrorMessage" VARCHAR(500),
    "manualReviewReasonCode" VARCHAR(64),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFinalizationEffect" (
    "id" TEXT NOT NULL,
    "finalizationId" TEXT NOT NULL,
    "effectType" "PaymentFinalizationEffectType" NOT NULL,
    "effectKey" VARCHAR(191) NOT NULL,
    "operationKey" VARCHAR(255) NOT NULL,
    "status" "PaymentFinalizationEffectStatus" NOT NULL DEFAULT 'PENDING',
    "intentVersion" INTEGER NOT NULL DEFAULT 1,
    "intent" JSONB NOT NULL,
    "intentHash" VARCHAR(64) NOT NULL,
    "referralId" TEXT,
    "partnerId" TEXT,
    "taxConfigId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorCode" VARCHAR(64),
    "lastErrorMessage" VARCHAR(500),
    "manualReviewReasonCode" VARCHAR(64),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentFinalizationEffect_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FinancialLedgerEntry"
    ADD COLUMN "operationKey" VARCHAR(255),
    ADD COLUMN "finalizationEffectId" TEXT;

-- AlterTable
ALTER TABLE "ReferralReward" ADD COLUMN "finalizationEffectId" TEXT;

-- AlterTable
ALTER TABLE "PartnerCommission" ADD COLUMN "finalizationEffectId" TEXT;

-- AlterTable
ALTER TABLE "TaxRecord" ADD COLUMN "finalizationEffectId" TEXT;

-- AlterTable
ALTER TABLE "ReconciliationRecord" ADD COLUMN "finalizationEffectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFinalization_transactionId_key" ON "PaymentFinalization"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFinalization_checkoutSessionId_key" ON "PaymentFinalization"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFinalization_providerPaymentId_key" ON "PaymentFinalization"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentFinalization_status_nextAttemptAt_createdAt_idx" ON "PaymentFinalization"("status", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentFinalization_leaseExpiresAt_idx" ON "PaymentFinalization"("leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFinalizationEffect_operationKey_key" ON "PaymentFinalizationEffect"("operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentFinalizationEffect_finalization_effect_key" ON "PaymentFinalizationEffect"("finalizationId", "effectType", "effectKey");

-- CreateIndex
CREATE INDEX "PaymentFinalizationEffect_finalizationId_status_idx" ON "PaymentFinalizationEffect"("finalizationId", "status");

-- CreateIndex
CREATE INDEX "PaymentFinalizationEffect_status_nextAttemptAt_idx" ON "PaymentFinalizationEffect"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "PaymentFinalizationEffect_referralId_idx" ON "PaymentFinalizationEffect"("referralId");

-- CreateIndex
CREATE INDEX "PaymentFinalizationEffect_partnerId_idx" ON "PaymentFinalizationEffect"("partnerId");

-- CreateIndex
CREATE INDEX "PaymentFinalizationEffect_taxConfigId_idx" ON "PaymentFinalizationEffect"("taxConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_operationKey_entryType_key" ON "FinancialLedgerEntry"("operationKey", "entryType");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_finalizationEffectId_entryType_key" ON "FinancialLedgerEntry"("finalizationEffectId", "entryType");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_finalizationEffectId_key" ON "ReferralReward"("finalizationEffectId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCommission_finalizationEffectId_key" ON "PartnerCommission"("finalizationEffectId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRecord_finalizationEffectId_key" ON "TaxRecord"("finalizationEffectId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationRecord_finalizationEffectId_key" ON "ReconciliationRecord"("finalizationEffectId");

-- AddForeignKey
ALTER TABLE "PaymentFinalization" ADD CONSTRAINT "PaymentFinalization_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFinalizationEffect" ADD CONSTRAINT "PaymentFinalizationEffect_finalizationId_fkey" FOREIGN KEY ("finalizationId") REFERENCES "PaymentFinalization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFinalizationEffect" ADD CONSTRAINT "PaymentFinalizationEffect_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "Referral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFinalizationEffect" ADD CONSTRAINT "PaymentFinalizationEffect_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFinalizationEffect" ADD CONSTRAINT "PaymentFinalizationEffect_taxConfigId_fkey" FOREIGN KEY ("taxConfigId") REFERENCES "TaxConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_finalizationEffectId_fkey" FOREIGN KEY ("finalizationEffectId") REFERENCES "PaymentFinalizationEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_finalizationEffectId_fkey" FOREIGN KEY ("finalizationEffectId") REFERENCES "PaymentFinalizationEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_finalizationEffectId_fkey" FOREIGN KEY ("finalizationEffectId") REFERENCES "PaymentFinalizationEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_finalizationEffectId_fkey" FOREIGN KEY ("finalizationEffectId") REFERENCES "PaymentFinalizationEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_finalizationEffectId_fkey" FOREIGN KEY ("finalizationEffectId") REFERENCES "PaymentFinalizationEffect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
