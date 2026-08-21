// Relative Path: src/scripts/test-partner-portal-v3.ts
import { prisma } from "@/lib/prisma";
import { PartnerService } from "@/lib/accounting/partnerService";
import { PartnerStatementService } from "@/lib/accounting/partnerStatementService";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";
import { formatCentavosToPesos } from "@/lib/accounting/money";

async function runTests() {
  console.log("============================================================");
  console.log("GOVSTUDYX PARTNER PORTAL & FINANCIAL SYSTEM V3.0 TEST SUITE");
  console.log("============================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // TEST 1: Partner ID Normalization
    console.log("\n--- TEST 1: Partner ID Normalization ---");
    assert(PartnerService.normalizePartnerId("pt-000123") === "PT-000123", "Normalizes lowercase 'pt-000123'");
    assert(PartnerService.normalizePartnerId("PT-123") === "PT-000123", "Pads short 'PT-123' to 'PT-000123'");
    assert(PartnerService.normalizePartnerId("pt-1") === "PT-000001", "Pads 'pt-1' to 'PT-000001'");
    assert(PartnerService.normalizePartnerId("  PT-000456  ") === "PT-000456", "Trims whitespace from '  PT-000456  '");

    // TEST 2: Masking Engine
    console.log("\n--- TEST 2: Sensitive Account Masking ---");
    assert(PartnerService.maskAccountNumber("09171234567", "GCASH") === "09******567", "Masks GCash mobile number");
    assert(PartnerService.maskAccountNumber("09989876543", "MAYA") === "09******543", "Masks Maya mobile number");
    assert(PartnerService.maskAccountNumber("123456789012", "BANK_TRANSFER") === "******9012", "Masks Bank account number");

    // TEST 3: Create Test Partner with PT-XXXXXX
    console.log("\n--- TEST 3: Atomic Sequential PT-XXXXXX Generation ---");
    const testCode = `TEST_PARTNER_${Date.now()}`;
    const testEmail = `partner_${Date.now()}@testgovstudyx.com`;

    const partner = await PartnerService.createPartner({
      name: "Test CSE Review Center",
      code: testCode,
      contactEmail: testEmail,
      type: "SCHOOL",
      commissionRate: 15.0,
      minPayoutCentavos: 1000, // ₱10.00
      holdingPeriodDays: 0,
    });

    assert(Boolean(partner.partnerId && partner.partnerId.startsWith("PT-")), `Partner created with sequential ID: ${partner.partnerId}`);
    assert(Boolean(partner.setupToken), "Partner generated with one-time setupToken");

    // TEST 4: Dual Identifier Resolution
    console.log("\n--- TEST 4: Dual Identifier Resolution (Email / PT-XXXXXX) ---");
    const resolvedByEmail = await PartnerService.resolvePartnerByIdentifier(testEmail);
    assert(resolvedByEmail?.id === partner.id, "Resolves partner via contact email");

    const resolvedById = await PartnerService.resolvePartnerByIdentifier(partner.partnerId!);
    assert(resolvedById?.id === partner.id, "Resolves partner via PT-XXXXXX");

    const resolvedByLowerId = await PartnerService.resolvePartnerByIdentifier(partner.partnerId!.toLowerCase());
    assert(resolvedByLowerId?.id === partner.id, "Resolves partner via lowercase pt-xxxxxx");

    // TEST 5: Payout Methods Registration & Default Switching
    console.log("\n--- TEST 5: Payout Methods Management ---");
    const gcashProfile = await PartnerService.addPayoutProfile({
      partnerId: partner.id,
      method: "GCASH",
      accountHolderName: "Juan Partner",
      accountNumber: "09171234567",
      isDefault: true,
    });

    assert(gcashProfile.method === "GCASH", "Added GCash profile");
    assert(gcashProfile.isDefault === true, "GCash profile set as default");

    const mayaProfile = await PartnerService.addPayoutProfile({
      partnerId: partner.id,
      method: "MAYA",
      accountHolderName: "Juan Partner",
      accountNumber: "09187654321",
      isDefault: true,
    });

    assert(mayaProfile.isDefault === true, "Maya profile set as new default");

    const methodsList = await PartnerService.listPayoutProfiles(partner.id);
    assert(methodsList.length === 2, `Retrieved 2 registered payout methods (found ${methodsList.length})`);
    assert(methodsList.find((m) => m.id === gcashProfile.id)?.isDefault === false, "Previous GCash profile unset as default");
    assert(methodsList.find((m) => m.id === gcashProfile.id)?.accountNumberMasked === "09******567", "Masked GCash number returned in list");

    // TEST 6: Simulated Transactions & 7 KPI Metrics
    console.log("\n--- TEST 6: Financial Calculations & 7 KPI Cards ---");
    // Create test user and transaction
    const testUser = await prisma.user.create({
      data: {
        email: `student_${Date.now()}@test.com`,
        name: "Test Student",
        password: "mock_password_123",
      },
    });

    const testTxn = await prisma.transaction.create({
      data: {
        userId: testUser.id,
        checkoutSessionId: `CS-TEST-${Date.now()}`,
        amount: 299,
        grossAmountCentavos: 29900, // ₱299.00
        netSettlementCentavos: 28400,
        feeAmountCentavos: 1500,
        status: "COMPLETED",
        planType: "PRO_PASS_2026",
      },
    });

    // Create Partner Commission: ₱299.00 * 15% = ₱44.85 (4485 centavos)
    const commCentavos = Math.round(29900 * 0.15); // 4485
    const commission = await prisma.partnerCommission.create({
      data: {
        partnerId: partner.id,
        transactionId: testTxn.id,
        purchaseAmountCentavos: 29900,
        commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
        effectiveRate: 15.0,
        commissionAmountCentavos: commCentavos,
        status: "AVAILABLE",
        campaignSource: "youtube",
      },
    });

    const overview = await PartnerService.getPartnerFinancialOverview(partner.id);
    assert(overview.metrics.qualifyingSalesCentavos === 29900, `Qualifying Sales: ${overview.metrics.formattedQualifyingSales}`);
    assert(overview.metrics.totalCommissionCentavos === 4485, `Total Commission: ${overview.metrics.formattedTotalCommission}`);
    assert(overview.metrics.availableCommissionCentavos === 4485, `Available Commission: ${overview.metrics.formattedAvailableCommission}`);
    assert(overview.metrics.outstandingBalanceCentavos === 4485, `Outstanding Balance: ${overview.metrics.formattedOutstandingBalance}`);
    assert(overview.channelBreakdown.length === 1 && overview.channelBreakdown[0].channel === "youtube", "Channel analytics tracks 'youtube' source");

    // TEST 7: Atomic Payout Reservation & Concurrency Balance Protection
    console.log("\n--- TEST 7: Atomic Payout Balance Reservation ---");
    const payoutReq = await PartnerService.requestPayoutAtomic({
      partnerId: partner.id,
      requestedAmountCentavos: 2000, // ₱20.00
      profileId: gcashProfile.id,
    });

    assert(payoutReq.payout.status === "RESERVED", `Payout request status is RESERVED (id: ${payoutReq.payout.id})`);

    const overviewAfterPayout = await PartnerService.getPartnerFinancialOverview(partner.id);
    assert(overviewAfterPayout.metrics.reservedForPayoutCentavos === 2000, `Reserved for Payout: ${overviewAfterPayout.metrics.formattedReservedForPayout}`);
    assert(overviewAfterPayout.metrics.availableCommissionCentavos === 2485, `Remaining Available: ${overviewAfterPayout.metrics.formattedAvailableCommission}`);
    assert(overviewAfterPayout.metrics.outstandingBalanceCentavos === 2485, `Remaining Outstanding: ${overviewAfterPayout.metrics.formattedOutstandingBalance}`);

    // TEST 8: Financial Statement Generation & Reconciliation
    console.log("\n--- TEST 8: Financial Statement Multi-Format Export ---");
    const statementDataset = await PartnerStatementService.getStatementDataset({
      partnerId: partner.id,
      period: "THIS_MONTH",
    });

    assert(statementDataset.reconciliation.isReconciled === true, `Double-entry reconciliation status: ${statementDataset.reconciliation.status}`);
    assert(statementDataset.statementReference.startsWith("GSX-PS-"), `Statement Reference: ${statementDataset.statementReference}`);
    assert(statementDataset.transactions.length === 1, `Statement transactions count: ${statementDataset.transactions.length}`);

    const xlsxBuffer = await PartnerStatementService.generateStatementXLSX(statementDataset);
    assert(xlsxBuffer.length > 0, `Generated 6-sheet XLSX workbook buffer (${xlsxBuffer.length} bytes)`);

    const csvData = PartnerStatementService.generateStatementCSV(statementDataset);
    assert(csvData.includes(statementDataset.statementReference), "Generated CSV contains Statement Reference header");

    // TEST 9: Audit Trail Logging
    console.log("\n--- TEST 9: Audit Trail Logging ---");
    const logs = await PartnerAuditService.getPartnerAuditLogs(partner.id, 10);
    assert(logs.length >= 3, `Recorded ${logs.length} partner audit events`);

    // Clean up test data
    console.log("\n--- Cleaning up temporary test fixtures ---");
    await prisma.partnerCommission.deleteMany({ where: { partnerId: partner.id } });
    await prisma.partnerPayout.deleteMany({ where: { partnerId: partner.id } });
    await prisma.partnerPayoutProfile.deleteMany({ where: { partnerId: partner.id } });
    await prisma.accountingAuditLog.deleteMany({ where: { targetId: partner.id } });
    await prisma.partner.delete({ where: { id: partner.id } });
    await prisma.transaction.delete({ where: { id: testTxn.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log("Cleanup complete.");

  } catch (err) {
    console.error("❌ Unexpected test exception:", err);
    failed++;
  }

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
