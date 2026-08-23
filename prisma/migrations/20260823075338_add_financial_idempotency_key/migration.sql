-- CreateTable
CREATE TABLE "FinancialIdempotencyKey" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialIdempotencyKey_actorId_operationType_idempotencyKey_key" ON "FinancialIdempotencyKey"("actorId", "operationType", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialIdempotencyKey_createdAt_idx" ON "FinancialIdempotencyKey"("createdAt");
