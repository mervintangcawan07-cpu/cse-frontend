-- CreateEnum
CREATE TYPE "RefundOperationStatus" AS ENUM ('RESERVED', 'SUBMITTING', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REJECTED', 'UNKNOWN', 'MANUAL_REVIEW_REQUIRED');

-- CreateTable
CREATE TABLE "RefundOperation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "paymongoIdempotencyKey" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "refundId" TEXT,
    "amountCentavos" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "paymongoReason" TEXT NOT NULL,
    "status" "RefundOperationStatus" NOT NULL DEFAULT 'RESERVED',
    "providerStatus" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastHttpStatus" INTEGER,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundOperation_paymongoIdempotencyKey_key" ON "RefundOperation"("paymongoIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RefundOperation_refundId_key" ON "RefundOperation"("refundId");

-- CreateIndex
CREATE INDEX "RefundOperation_transactionId_status_idx" ON "RefundOperation"("transactionId", "status");

-- CreateIndex
CREATE INDEX "RefundOperation_createdAt_idx" ON "RefundOperation"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RefundOperation_actorId_idempotencyKey_key" ON "RefundOperation"("actorId", "idempotencyKey");
