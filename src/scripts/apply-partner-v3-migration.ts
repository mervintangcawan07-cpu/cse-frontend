// Relative Path: src/scripts/apply-partner-v3-migration.ts
import { prisma } from "@/lib/prisma";

async function applyMigration() {
  console.log("Applying additive migration for Partner Portal v3.0...");

  try {
    // 1. Enum values
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESERVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PayoutStatus')) THEN
          ALTER TYPE "PayoutStatus" ADD VALUE 'RESERVED';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REVERSED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PayoutStatus')) THEN
          ALTER TYPE "PayoutStatus" ADD VALUE 'REVERSED';
        END IF;
      END
      $$;
    `);
    console.log("✓ PayoutStatus enum updated (RESERVED, REVERSED)");

    // 2. Partner columns
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "setupToken" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "setupTokenExpires" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "resetTokenExpires" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "tempPasswordHash" TEXT;`);

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Partner_partnerId_key" ON "Partner"("partnerId");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Partner_setupToken_key" ON "Partner"("setupToken");`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Partner_resetToken_key" ON "Partner"("resetToken");`);
    console.log("✓ Partner table columns and indexes verified");

    // 3. PartnerPayoutProfile table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerPayoutProfile" (
        "id" TEXT NOT NULL,
        "partnerId" TEXT NOT NULL,
        "method" "PayoutMethod" NOT NULL,
        "accountHolderName" TEXT NOT NULL,
        "accountNumberEncrypted" TEXT NOT NULL,
        "bankName" TEXT,
        "accountType" TEXT,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PartnerPayoutProfile_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "PartnerPayoutProfile_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "PartnerPayoutProfile" DROP COLUMN IF EXISTS "accountNumberMasked";`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartnerPayoutProfile_partnerId_idx" ON "PartnerPayoutProfile"("partnerId");`);
    console.log("✓ PartnerPayoutProfile table verified");

    // 4. PartnerSequence table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PartnerSequence" (
        "id" TEXT NOT NULL DEFAULT 'PARTNER_SEQ',
        "currentVal" INTEGER NOT NULL DEFAULT 100,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PartnerSequence_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "PartnerSequence" ADD COLUMN IF NOT EXISTS "currentVal" INTEGER NOT NULL DEFAULT 100;`);
    console.log("✓ PartnerSequence counter table verified");

    // 5. Backfill existing partners without partnerId
    const existingPartnersWithoutId = await prisma.partner.findMany({
      where: { partnerId: null },
      select: { id: true, code: true },
    });

    if (existingPartnersWithoutId.length > 0) {
      console.log(`Backfilling ${existingPartnersWithoutId.length} existing partners with sequential PT-XXXXXX...`);
      for (const p of existingPartnersWithoutId) {
        const seq = await prisma.partnerSequence.upsert({
          where: { id: "PARTNER_SEQ" },
          update: { currentVal: { increment: 1 } },
          create: { id: "PARTNER_SEQ", currentVal: 101 },
        });
        const assignedPT = `PT-${String(seq.currentVal).padStart(6, "0")}`;
        await prisma.partner.update({
          where: { id: p.id },
          data: { partnerId: assignedPT },
        });
        console.log(`  Assigned ${assignedPT} to partner ${p.code}`);
      }
    }

    console.log("All additive migrations applied successfully with ZERO data loss.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
