-- CreateEnum
CREATE TYPE "PaymentFinalizationManifestRevisionReason" AS ENUM ('INITIAL_INGESTION', 'PROVIDER_FEE_ENRICHMENT');

-- CreateTable
CREATE TABLE "PaymentFinalizationManifestRevision" (
    "id" TEXT NOT NULL,
    "finalizationId" TEXT NOT NULL,
    "manifestVersion" INTEGER NOT NULL DEFAULT 1,
    "manifestRevision" INTEGER NOT NULL,
    "manifestHash" VARCHAR(64) NOT NULL,
    "parentManifestHash" VARCHAR(64),
    "revisionReason" "PaymentFinalizationManifestRevisionReason" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentFinalizationManifestRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PFinManifestRevision_fin_id_idx" ON "PaymentFinalizationManifestRevision"("finalizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PFinManifestRevision_fin_rev_key" ON "PaymentFinalizationManifestRevision"("finalizationId", "manifestRevision");

-- CreateIndex
CREATE UNIQUE INDEX "PFinManifestRevision_parent_key" ON "PaymentFinalizationManifestRevision"("finalizationId", "parentManifestHash");

-- AddForeignKey
ALTER TABLE "PaymentFinalizationManifestRevision" ADD CONSTRAINT "PaymentFinalizationManifestRevision_finalizationId_fkey" FOREIGN KEY ("finalizationId") REFERENCES "PaymentFinalization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
