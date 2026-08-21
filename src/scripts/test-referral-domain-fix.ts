// Relative Path: src/scripts/test-referral-domain-fix.ts
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/config/site";
import { PartnerService } from "@/lib/accounting/partnerService";
import { ReferralService } from "@/lib/referral/referralService";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
    failed++;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("GOVSTUDYX REFERRAL & CANONICAL DOMAIN VERIFICATION TEST");
  console.log("============================================================");

  try {
    // TEST 1: Canonical Site URL Resolution
    console.log("\n--- TEST 1: Canonical Site URL Resolution ---");
    const siteUrlDev = getSiteUrl();
    console.log(`Resolved URL: ${siteUrlDev}`);
    assert(siteUrlDev.startsWith("http"), "Resolves a valid HTTP/HTTPS base URL");

    // In production mode simulation
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    const siteUrlProd = getSiteUrl();
    console.log(`Production URL: ${siteUrlProd}`);
    assert(siteUrlProd === "https://govstudyx.com", "Resolves to canonical https://govstudyx.com in production");
    (process.env as any).NODE_ENV = prevNodeEnv;

    // TEST 2: Lookup partner 'azeltrial'
    console.log("\n--- TEST 2: Partner 'azeltrial' Resolution ---");
    const partner = await prisma.partner.findFirst({
      where: {
        OR: [
          { slug: { equals: "azeltrial", mode: "insensitive" } },
          { code: { equals: "azeltrial", mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        status: true,
      },
    });

    if (partner) {
      console.log(`Found partner in database:`, partner);
      assert(partner.status === "ACTIVE", "Partner 'azeltrial' status is ACTIVE");
    } else {
      console.log("Partner 'azeltrial' not found in test DB; creating a temporary test partner...");
      const created = await PartnerService.createPartner({
        name: "Azeltrial CSE Review",
        code: "AZELTRIAL",
        slug: "azeltrial",
        contactEmail: "azel@test.com",
        type: "CONTENT_CREATOR",
        commissionRate: 15.0,
      });
      console.log(`Created test partner: ${created.code} (${created.slug})`);
      assert(created.slug === "azeltrial" || created.code === "AZELTRIAL", "Partner created for testing");
    }

    // TEST 3: Check Partner Overview Referral Link
    console.log("\n--- TEST 3: Partner Overview Referral Link ---");
    const targetPartner = await prisma.partner.findFirst({
      where: {
        OR: [
          { slug: { equals: "azeltrial", mode: "insensitive" } },
          { code: { equals: "azeltrial", mode: "insensitive" } },
        ],
      },
    });

    if (targetPartner) {
      const overview = await PartnerService.getPartnerFinancialOverview(targetPartner.id);
      console.log(`Partner Referral Link: ${overview.referralLink}`);
      assert(
        overview.referralLink.includes("/p/"),
        "Partner overview contains /p/ referral link"
      );
      assert(
        !overview.referralLink.includes("cseonlinereview.vercel.app"),
        "Referral link does NOT contain old domain 'cseonlinereview.vercel.app'"
      );
    }

    // TEST 4: Non-existent Partner Handling
    console.log("\n--- TEST 4: Non-existent Partner Lookup ---");
    const missing = await prisma.partner.findFirst({
      where: {
        OR: [
          { slug: { equals: "this-partner-does-not-exist-xyz", mode: "insensitive" } },
          { code: { equals: "this-partner-does-not-exist-xyz", mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
    });
    assert(missing === null, "Gracefully returns null for non-existent partner without throwing");

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
