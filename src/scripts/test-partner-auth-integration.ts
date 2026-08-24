import crypto from "node:crypto";
import { statSync } from "node:fs";
import type { Prisma } from "@prisma/client";

const CONFIRMATION = "YES_DELETE_AFTER_TEST";
const RUN_ID_PATTERN = /^[a-z0-9]{8,32}$/;
const DATABASE_PREFIX = "gsx_partner_auth_test_";
const FORBIDDEN_ENVIRONMENT_VARIABLES = [
  "ADMIN_ALERT_EMAIL",
  "CRON_SECRET",
  "CRON_SECRET_KEY",
  "ENABLE_PARTNER_COMMISSION_EMAILS",
  "ENCRYPTION_KEY",
  "ENCRYPTION_KEY_V1",
  "GEMINI_API_KEY",
  "JWT_SECRET",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LOG_INGESTION_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_LIVEKIT_URL",
  "NEXT_PUBLIC_SITE_URL",
  "PAYMONGO_SECRET_KEY",
  "PAYMONGO_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "SUDO_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
] as const;
const SENSITIVE_RESULT_KEYS = new Set([
  "mustChangePassword",
  "passwordHash",
  "resetToken",
  "resetTokenExpires",
  "setupToken",
  "setupTokenExpires",
  "tempPasswordHash",
]);

class IntegrationAssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new IntegrationAssertionError(message);
}

function fingerprint(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readEnvironmentContract() {
  const testUrl = process.env.PARTNER_AUTH_TEST_DATABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const confirmation = process.env.PARTNER_AUTH_TEST_CONFIRM_DISPOSABLE;
  const runId = process.env.PARTNER_AUTH_TEST_RUN_ID;
  const expectedDatabase = process.env.PARTNER_AUTH_TEST_EXPECTED_DATABASE;
  const expectedFingerprint = process.env.PARTNER_AUTH_TEST_TARGET_FINGERPRINT;
  const dotenvPath = process.env.DOTENV_CONFIG_PATH;
  const poolSize = Number(process.env.PG_POOL_MAX);

  assert(testUrl, "Dedicated test database URL is absent.");
  assert(databaseUrl === testUrl, "Application database URL is not the dedicated test target.");
  assert(confirmation === CONFIRMATION, "Disposable confirmation is invalid.");
  assert(runId && RUN_ID_PATTERN.test(runId), "Run ID is invalid.");
  assert(
    expectedDatabase === `${DATABASE_PREFIX}${runId}`,
    "Expected database identity is invalid."
  );
  assert(
    expectedFingerprint === fingerprint(testUrl),
    "Database target fingerprint is invalid."
  );
  assert(process.env.NODE_ENV === "test", "NODE_ENV must be test.");
  assert(Number.isInteger(poolSize) && poolSize >= 2 && poolSize <= 16, "Pool size is unsafe.");
  assert(process.env.PARTNER_AUTH_TEST_NETWORK_GUARD === "ENABLED", "Network guard is absent.");
  assert(dotenvPath && statSync(dotenvPath).size === 0, "Isolated dotenv file is not empty.");

  const parsed = new URL(testUrl);
  assert(["postgres:", "postgresql:"].includes(parsed.protocol), "Target is not PostgreSQL.");
  assert(
    decodeURIComponent(parsed.pathname.replace(/^\//, "")) === expectedDatabase,
    "Database name does not match the disposable identity."
  );
  for (const name of FORBIDDEN_ENVIRONMENT_VARIABLES) {
    assert(!process.env[name], `Forbidden environment variable is present: ${name}.`);
  }

  return { expectedDatabase, expectedFingerprint, runId, testUrl };
}

function createBarrier(participants: number) {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrivals += 1;
    if (arrivals === participants) release?.();
    await released;
  };
}

function isSensitiveResult(value: object): boolean {
  return Object.keys(value).some((key) => SENSITIVE_RESULT_KEYS.has(key));
}

async function main() {
  const contract = readEnvironmentContract();
  console.log("[INFO] Integration environment contract validated.");
  let httpAttempts = 0;
  let stubDeliveryCalls = 0;
  globalThis.fetch = async () => {
    httpAttempts += 1;
    throw new IntegrationAssertionError("Unexpected application HTTP request was blocked.");
  };

  const { prisma } = await import("@/lib/prisma");
  console.log("[INFO] Integration Prisma module imported.");
  const bcryptModule = await import("bcryptjs");
  console.log("[INFO] Integration bcrypt module imported.");
  const partnerModule = await import("@/lib/accounting/partnerService");
  console.log("[INFO] Integration PartnerService module imported.");
  const forgotModule = await import("@/app/api/partner/auth/forgot-password/route");
  console.log("[INFO] Integration forgot-password route imported.");
  const resetModule = await import("@/app/api/partner/auth/reset-password/route");
  console.log("[INFO] Integration reset-password route imported.");
  console.log("[INFO] Integration dependencies imported.");
  const bcrypt = bcryptModule.default;
  const {
    ELIGIBLE_PARTNER_SETUP_STATUSES,
    PartnerService,
    executePartnerSetupResend,
  } = partnerModule;
  assert(
    typeof prisma?.$queryRaw === "function" &&
      typeof bcrypt?.hash === "function" &&
      typeof bcrypt?.compare === "function" &&
      Array.isArray(ELIGIBLE_PARTNER_SETUP_STATUSES) &&
      typeof PartnerService?.createPartner === "function" &&
      typeof PartnerService?.approvePartnerApplication === "function" &&
      typeof PartnerService?.resendPartnerSetupLink === "function" &&
      typeof PartnerService?.activatePartnerWithSetupToken === "function" &&
      typeof executePartnerSetupResend === "function" &&
      typeof forgotModule.POST === "function" &&
      typeof resetModule.POST === "function",
    "Integration exports are unavailable."
  );
  console.log("[INFO] Integration exports validated.");

  const created = {
    applications: new Set<string>(),
    attributions: new Set<string>(),
    commissions: new Set<string>(),
    ledgerEntries: new Set<string>(),
    partners: new Set<string>(),
    payoutProfiles: new Set<string>(),
    payouts: new Set<string>(),
    reconciliations: new Set<string>(),
    transactions: new Set<string>(),
    users: new Set<string>(),
  };
  let sequence = 0;
  let passed = 0;
  let failed = 0;

  const tag = (label: string) => {
    sequence += 1;
    const clean = label.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
    return `${contract.runId}${sequence.toString(36)}${clean}`;
  };

  const assertTargetUnchanged = () => {
    assert(
      process.env.DATABASE_URL === contract.testUrl &&
        process.env.PARTNER_AUTH_TEST_DATABASE_URL === contract.testUrl &&
        fingerprint(contract.testUrl) === contract.expectedFingerprint,
      "Database target changed during the integration suite."
    );
  };

  const createPartnerFixture = async (
    label: string,
    overrides: Partial<Prisma.PartnerUncheckedCreateInput> = {}
  ) => {
    const suffix = tag(label);
    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const data: Prisma.PartnerUncheckedCreateInput = {
      partnerId: `PTX-${suffix}`,
      code: `TEST-${suffix.toUpperCase()}`,
      slug: `test-${suffix}`,
      name: `Partner ${suffix}`,
      contactEmail: `${suffix}@example.test`,
      status: "ACTIVE",
      setupToken,
      setupTokenExpires,
      mustChangePassword: true,
      ...overrides,
    };
    const partner = await prisma.partner.create({ data });
    created.partners.add(partner.id);
    return partner;
  };

  const createApplicationFixture = async (label: string) => {
    const suffix = tag(label);
    const application = await prisma.partnerApplication.create({
      data: {
        applicantName: `Applicant ${suffix}`,
        organizationName: `Organization ${suffix}`,
        email: `${suffix}@example.test`,
        socialUrl: "https://example.test/channel",
        proposedSlug: `application-${suffix}`,
        type: "SCHOOL",
      },
    });
    created.applications.add(application.id);
    return application;
  };

  const findPartnersForApplication = (application: {
    email: string;
    proposedSlug: string | null;
  }) => {
    const identityFilters: Prisma.PartnerWhereInput[] = [
      { contactEmail: application.email },
    ];
    if (application.proposedSlug) {
      identityFilters.push({ slug: application.proposedSlug });
    }
    return prisma.partner.findMany({
      where: { OR: identityFilters },
      select: { id: true },
    });
  };

  const setupResendDependencies = (barrier?: () => Promise<void>) => ({
    findPartner: (partnerId: string) =>
      prisma.partner.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          partnerId: true,
          code: true,
          name: true,
          status: true,
          contactEmail: true,
          passwordHash: true,
          tempPasswordHash: true,
          setupToken: true,
        },
      }),
    rotateSetupToken: async ({
      partnerId,
      expectedSetupToken,
      nextSetupToken,
      setupTokenExpires,
    }: {
      partnerId: string;
      expectedSetupToken: string | null;
      nextSetupToken: string;
      setupTokenExpires: Date;
    }) => {
      if (barrier) await barrier();
      const rotated = await prisma.partner.updateMany({
        where: {
          id: partnerId,
          passwordHash: null,
          tempPasswordHash: null,
          status: { in: [...ELIGIBLE_PARTNER_SETUP_STATUSES] },
          setupToken: expectedSetupToken,
        },
        data: { setupToken: nextSetupToken, setupTokenExpires, mustChangePassword: true },
      });
      return rotated.count === 1;
    },
    deliverSetupEmail: async () => {
      stubDeliveryCalls += 1;
      return "SENT" as const;
    },
  });

  const runCase = async (number: number, name: string, operation: () => Promise<void>) => {
    assertTargetUnchanged();
    try {
      await operation();
      passed += 1;
      console.log(`[PASS] ${number}. ${name}`);
    } catch {
      failed += 1;
      console.log(`[FAIL] ${number}. ${name}`);
    }
  };

  const cleanup = async () => {
    const ids = (values: Set<string>) => [...values];
    const partnerIds = ids(created.partners);
    if (ids(created.ledgerEntries).length) {
      await prisma.financialLedgerEntry.deleteMany({
        where: { id: { in: ids(created.ledgerEntries) } },
      });
    }
    if (ids(created.reconciliations).length) {
      await prisma.reconciliationRecord.deleteMany({
        where: { id: { in: ids(created.reconciliations) } },
      });
    }
    if (ids(created.payouts).length) {
      await prisma.partnerPayout.deleteMany({ where: { id: { in: ids(created.payouts) } } });
    }
    if (ids(created.payoutProfiles).length) {
      await prisma.partnerPayoutProfile.deleteMany({
        where: { id: { in: ids(created.payoutProfiles) } },
      });
    }
    if (ids(created.commissions).length) {
      await prisma.partnerCommission.deleteMany({
        where: { id: { in: ids(created.commissions) } },
      });
    }
    if (ids(created.attributions).length) {
      await prisma.partnerAttribution.deleteMany({
        where: { id: { in: ids(created.attributions) } },
      });
    }
    if (partnerIds.length) {
      await prisma.accountingAuditLog.deleteMany({
        where: { targetId: { in: partnerIds } },
      });
    }
    if (ids(created.applications).length) {
      await prisma.partnerApplication.deleteMany({
        where: { id: { in: ids(created.applications) } },
      });
    }
    if (partnerIds.length) {
      await prisma.partnerRateHistory.deleteMany({ where: { partnerId: { in: partnerIds } } });
      await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    }
    if (ids(created.transactions).length) {
      await prisma.transaction.deleteMany({
        where: { id: { in: ids(created.transactions) } },
      });
    }
    if (ids(created.users).length) {
      await prisma.user.deleteMany({ where: { id: { in: ids(created.users) } } });
    }
    await prisma.partnerSequence.deleteMany({ where: { id: "PARTNER_SEQ" } });
  };

  const databaseIdentity = await prisma.$queryRaw<Array<{ database_name: string }>>`
    SELECT current_database() AS database_name
  `;
  assert(
    databaseIdentity[0]?.database_name === contract.expectedDatabase,
    "Connected Prisma client has an unexpected database identity."
  );
  console.log("[INFO] Integration database identity verified.");

  let manualResult: Awaited<ReturnType<typeof PartnerService.createPartner>> | undefined;
  let manualEmail = "";
  let resendContext:
    | { id: string; oldToken: string; newToken: string; expiresAt: Date }
    | undefined;

  try {
    console.log("[INFO] Integration cases starting.");
    await runCase(1, "Manual registration creates exactly one setup-token partner", async () => {
      const suffix = tag("manual");
      manualEmail = `${suffix}@example.test`;
      manualResult = await PartnerService.createPartner({
        name: `Manual ${suffix}`,
        code: `MANUAL-${suffix.toUpperCase()}`,
        slug: `manual-${suffix}`,
        contactEmail: manualEmail,
        type: "SCHOOL",
        commissionRate: 12.5,
        adminUserId: `admin-${contract.runId}`,
      });
      created.partners.add(manualResult.id);
      const records = await prisma.partner.findMany({ where: { contactEmail: manualEmail } });
      assert(records.length === 1 && Boolean(records[0].setupToken), "Manual creation mismatch.");
    });

    await runCase(2, "New account has no primary or temporary password hash", async () => {
      assert(manualResult, "Manual fixture is unavailable.");
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: manualResult.id } });
      assert(!partner.passwordHash && !partner.tempPasswordHash, "Password hash was initialized.");
    });

    await runCase(3, "Public service result contains no credential fields", async () => {
      assert(manualResult && !isSensitiveResult(manualResult), "Service result contains credentials.");
      assert(
        Object.keys(manualResult).sort().join(",") ===
          "code,contactEmail,deliveryStatus,id,name,partnerId,slug,status,type",
        "Service result allowlist changed."
      );
    });

    let approvedApplication:
      | { id: string; email: string; proposedSlug: string | null }
      | undefined;
    await runCase(4, "Application approval creates one linked partner", async () => {
      const application = await createApplicationFixture("approval");
      approvedApplication = {
        id: application.id,
        email: application.email,
        proposedSlug: application.proposedSlug,
      };
      const result = await PartnerService.approvePartnerApplication({
        applicationId: application.id,
        commissionRate: 10,
        adminUserId: `admin-${contract.runId}`,
      });
      created.partners.add(result.partner.id);
      const stored = await prisma.partnerApplication.findUniqueOrThrow({
        where: { id: application.id },
      });
      assert(stored.status === "APPROVED", "Application was not approved.");
      assert(stored.createdPartnerId === result.partner.id, "Application linkage is incorrect.");
      assert(!isSensitiveResult(result.partner), "Approval service result contains credentials.");
    });

    await runCase(5, "Repeated approval creates no duplicate", async () => {
      assert(approvedApplication, "Approved application fixture is unavailable.");
      const before = await findPartnersForApplication(approvedApplication);
      const outcome = await Promise.allSettled([
        PartnerService.approvePartnerApplication({
          applicationId: approvedApplication.id,
          commissionRate: 10,
          adminUserId: `admin-${contract.runId}`,
        }),
      ]);
      const stored = await prisma.partnerApplication.findUniqueOrThrow({
        where: { id: approvedApplication.id },
      });
      const matchingPartners = await findPartnersForApplication(approvedApplication);
      matchingPartners.forEach((partner) => created.partners.add(partner.id));
      assert(
        outcome[0].status === "rejected" &&
          before.length === 1 &&
          matchingPartners.length === 1 &&
          stored.createdPartnerId === matchingPartners[0].id,
        "Repeated approval created or linked a duplicate partner."
      );
    });

    await runCase(6, "Concurrent approval produces exactly one partner", async () => {
      const application = await createApplicationFixture("concurrentapproval");
      const start = createBarrier(2);
      const approve = async () => {
        await start();
        return PartnerService.approvePartnerApplication({
          applicationId: application.id,
          commissionRate: 11,
          adminUserId: `admin-${contract.runId}`,
        });
      };
      const outcomes = await Promise.allSettled([approve(), approve()]);
      for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") created.partners.add(outcome.value.partner.id);
      }
      const stored = await prisma.partnerApplication.findUniqueOrThrow({ where: { id: application.id } });
      const matchingPartners = await findPartnersForApplication(application);
      matchingPartners.forEach((partner) => created.partners.add(partner.id));
      const successfulCalls = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
      const failedCalls = outcomes.filter((outcome) => outcome.status === "rejected").length;
      assert(
        successfulCalls === 1 &&
          failedCalls === 1 &&
          matchingPartners.length === 1 &&
          stored.createdPartnerId === matchingPartners[0].id,
        "Concurrent approval was not single-winner."
      );
    });

    await runCase(7, "Resend changes the existing partner only", async () => {
      const partner = await createPartnerFixture("resend");
      assert(partner.setupToken, "Setup token fixture is absent.");
      const result = await PartnerService.resendPartnerSetupLink({
        partnerId: partner.id,
        adminUserId: `admin-${contract.runId}`,
      });
      const refreshed = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(refreshed.setupToken && refreshed.setupToken !== partner.setupToken, "Token did not rotate.");
      assert(result.partnerId === partner.id, "Resend changed partner identity.");
      assert(await prisma.partner.count({ where: { id: partner.id } }) === 1, "Partner was duplicated.");
      resendContext = {
        id: partner.id,
        oldToken: partner.setupToken,
        newToken: refreshed.setupToken,
        expiresAt: refreshed.setupTokenExpires!,
      };
    });

    await runCase(8, "Old setup token becomes invalid", async () => {
      assert(resendContext, "Resend fixture is unavailable.");
      const result = await PartnerService.activatePartnerWithSetupToken({
        token: resendContext.oldToken,
        password: "OldTokenMustFail9!",
      });
      assert(!result.success, "Old token remained usable.");
    });

    await runCase(9, "New setup token receives a fresh seven-day expiry", async () => {
      assert(resendContext, "Resend fixture is unavailable.");
      const remaining = resendContext.expiresAt.getTime() - Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      assert(remaining > sevenDays - 120_000 && remaining <= sevenDays, "Expiry is not seven days.");
    });

    await runCase(10, "Credential-bearing partners reject setup resend", async () => {
      const primary = await createPartnerFixture("primaryresend", {
        passwordHash: await bcrypt.hash("PrimaryPassword9!", 4),
      });
      const legacy = await createPartnerFixture("legacyresend", {
        tempPasswordHash: await bcrypt.hash("LegacyPassword9!", 4),
      });
      const outcomes = await Promise.allSettled([
        PartnerService.resendPartnerSetupLink({ partnerId: primary.id, adminUserId: "admin-test" }),
        PartnerService.resendPartnerSetupLink({ partnerId: legacy.id, adminUserId: "admin-test" }),
      ]);
      assert(outcomes.every((outcome) => outcome.status === "rejected"), "Credentialed resend succeeded.");
    });

    await runCase(11, "Ineligible partners reject setup resend", async () => {
      for (const status of ["SUSPENDED", "TERMINATED", "EXPIRED", "ARCHIVED"] as const) {
        const partner = await createPartnerFixture(`resend${status}`, { status });
        const outcome = await Promise.allSettled([
          PartnerService.resendPartnerSetupLink({ partnerId: partner.id, adminUserId: "admin-test" }),
        ]);
        assert(outcome[0].status === "rejected", `${status} resend succeeded.`);
      }
    });

    await runCase(12, "Concurrent resend permits exactly one token rotation", async () => {
      const partner = await createPartnerFixture("resendrace");
      assert(partner.setupToken, "Concurrent resend token is absent.");
      const originalToken = partner.setupToken;
      const deliveryCallsBeforeRace = stubDeliveryCalls;
      const barrier = createBarrier(2);
      const dependencies = setupResendDependencies(barrier);
      const outcomes = await Promise.allSettled([
        executePartnerSetupResend(partner.id, dependencies),
        executePartnerSetupResend(partner.id, dependencies),
      ]);
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(
        outcomes.filter((outcome) => outcome.status === "fulfilled").length === 1 &&
          outcomes.filter((outcome) => outcome.status === "rejected").length === 1 &&
          stubDeliveryCalls - deliveryCallsBeforeRace === 1 &&
          stored.id === partner.id &&
          Boolean(stored.setupToken) &&
          stored.setupToken !== originalToken &&
          !stored.passwordHash &&
          !stored.tempPasswordHash,
        "Concurrent resend did not produce one winner."
      );
    });

    await runCase(13, "Activation-versus-resend cannot overwrite an established credential", async () => {
      const partner = await createPartnerFixture("activationresendrace");
      assert(partner.setupToken, "Race fixture token is absent.");
      let signalRotation: (() => void) | undefined;
      let releaseRotation: (() => void) | undefined;
      const rotationReached = new Promise<void>((resolve) => { signalRotation = resolve; });
      const mayRotate = new Promise<void>((resolve) => { releaseRotation = resolve; });
      const dependencies = setupResendDependencies(async () => {
        signalRotation?.();
        await mayRotate;
      });
      const resend = executePartnerSetupResend(partner.id, dependencies);
      await rotationReached;
      const activation = await PartnerService.activatePartnerWithSetupToken({
        token: partner.setupToken,
        password: "ActivationWins9!",
      });
      releaseRotation?.();
      const resendOutcome = await Promise.allSettled([resend]);
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(activation.success, "Activation did not establish the credential.");
      assert(resendOutcome[0].status === "rejected", "Resend overwrote activation.");
      assert(Boolean(stored.passwordHash) && !stored.setupToken, "Final credential state is unsafe.");
    });

    let singleUseToken = "";
    await runCase(14, "Valid setup succeeds exactly once", async () => {
      const partner = await createPartnerFixture("singleactivation");
      assert(partner.setupToken, "Activation token is absent.");
      singleUseToken = partner.setupToken;
      const result = await PartnerService.activatePartnerWithSetupToken({
        token: singleUseToken,
        password: "SingleActivation9!",
      });
      assert(result.success, "Valid setup failed.");
    });

    await runCase(15, "Setup-token replay fails", async () => {
      const result = await PartnerService.activatePartnerWithSetupToken({
        token: singleUseToken,
        password: "ReplayMustFail9!",
      });
      assert(!result.success, "Consumed setup token was replayed.");
    });

    await runCase(16, "Concurrent setup submissions produce exactly one activation", async () => {
      const partner = await createPartnerFixture("concurrentactivation");
      assert(partner.setupToken, "Concurrent token is absent.");
      const passwords = ["ConcurrentFirst9!", "ConcurrentSecond9!"] as const;
      const start = createBarrier(2);
      const activate = async (password: string) => {
        await start();
        return PartnerService.activatePartnerWithSetupToken({ token: partner.setupToken!, password });
      };
      const results = await Promise.all(passwords.map((password) => activate(password)));
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      const finalHash = stored.passwordHash;
      assert(finalHash, "Concurrent setup did not establish a password hash.");
      const passwordMatches = await Promise.all(
        passwords.map((password) => bcrypt.compare(password, finalHash))
      );
      assert(
        results.filter((result) => result.success).length === 1 &&
          stored.tempPasswordHash === null &&
          stored.setupToken === null &&
          stored.setupTokenExpires === null &&
          passwordMatches.filter(Boolean).length === 1,
        "Concurrent setup did not persist exactly one clean activation."
      );
    });

    await runCase(17, "Suspension after token issuance prevents activation", async () => {
      const partner = await createPartnerFixture("suspendedactivation");
      await prisma.partner.update({ where: { id: partner.id }, data: { status: "SUSPENDED" } });
      const result = await PartnerService.activatePartnerWithSetupToken({
        token: partner.setupToken!,
        password: "SuspendedMustFail9!",
      });
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(!result.success && !stored.passwordHash, "Suspended partner was activated.");
    });

    let setupOnlyRecoveryId = "";
    await runCase(18, "Forgot Password cannot initialize a setup-only account", async () => {
      const partner = await createPartnerFixture("forgotsetuponly");
      setupOnlyRecoveryId = partner.id;
      const response = await forgotModule.POST(
        new Request("http://localhost/partner/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: partner.contactEmail }),
        })
      );
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(response.status === 200 && !stored.resetToken, "Forgot Password issued a first credential.");
    });

    await runCase(19, "Reset Password cannot initialize a setup-only account", async () => {
      const resetToken = crypto.randomBytes(32).toString("hex");
      await prisma.partner.update({
        where: { id: setupOnlyRecoveryId },
        data: { resetToken, resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const response = await resetModule.POST(
        new Request("http://localhost/partner/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword: "MustNotInitialize9!" }),
        })
      );
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: setupOnlyRecoveryId } });
      assert(response.status === 400 && !stored.passwordHash, "Reset initialized a setup-only account.");
    });

    await runCase(20, "Reset token cannot be consumed after account becomes ineligible", async () => {
      const oldHash = await bcrypt.hash("ExistingPrimary9!", 4);
      const partner = await createPartnerFixture("ineligiblereset", {
        passwordHash: oldHash,
        setupToken: null,
        setupTokenExpires: null,
        mustChangePassword: false,
        status: "ACTIVE",
      });
      assert(
        partner.resetToken === null && partner.resetTokenExpires === null,
        "Reset lifecycle did not start without a reset credential."
      );
      const forgotResponse = await forgotModule.POST(
        new Request("http://localhost/partner/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: partner.contactEmail }),
        })
      );
      const issued = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(
        forgotResponse.status === 200 && issued.resetToken && issued.resetTokenExpires,
        "Forgot Password did not issue a reset credential to the active partner."
      );
      const issuedResetToken = issued.resetToken;
      await prisma.partner.update({
        where: { id: partner.id },
        data: { status: "SUSPENDED" },
      });
      const response = await resetModule.POST(
        new Request("http://localhost/partner/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: issuedResetToken,
            newPassword: "IneligibleMustFail9!",
          }),
        })
      );
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(
        response.status === 400 &&
          stored.passwordHash === oldHash &&
          stored.tempPasswordHash === null &&
          stored.setupToken === null &&
          stored.setupTokenExpires === null &&
          !(await bcrypt.compare("IneligibleMustFail9!", stored.passwordHash)),
        "A reset token issued while active changed an ineligible account."
      );
    });

    await runCase(21, "Existing primary-hash partner remains compatible", async () => {
      const partner = await createPartnerFixture("primaryrecovery", {
        passwordHash: await bcrypt.hash("OldPrimary9!", 4),
        setupToken: null,
        setupTokenExpires: null,
        mustChangePassword: false,
      });
      await forgotModule.POST(
        new Request("http://localhost/partner/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: partner.contactEmail }),
        })
      );
      const issued = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(issued.resetToken, "Primary account did not receive a reset token.");
      const response = await resetModule.POST(
        new Request("http://localhost/partner/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: issued.resetToken, newPassword: "NewPrimary9!" }),
        })
      );
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(response.status === 200 && await bcrypt.compare("NewPrimary9!", stored.passwordHash!), "Primary recovery failed.");
    });

    await runCase(22, "Legacy temporary-hash recovery promotes safely", async () => {
      const partner = await createPartnerFixture("legacyrecovery", {
        passwordHash: null,
        tempPasswordHash: await bcrypt.hash("LegacyTemporary9!", 4),
        setupToken: null,
        setupTokenExpires: null,
      });
      await forgotModule.POST(
        new Request("http://localhost/partner/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: partner.contactEmail }),
        })
      );
      const issued = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(issued.resetToken, "Legacy account did not receive a reset token.");
      const response = await resetModule.POST(
        new Request("http://localhost/partner/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: issued.resetToken, newPassword: "PromotedLegacy9!" }),
        })
      );
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      assert(
        response.status === 200 &&
          !stored.tempPasswordHash &&
          Boolean(stored.passwordHash) &&
          await bcrypt.compare("PromotedLegacy9!", stored.passwordHash!),
        "Legacy recovery did not promote safely."
      );
    });

    await runCase(23, "Partner and referral identity remain unchanged", async () => {
      const partner = await createPartnerFixture("identity");
      const attribution = await prisma.partnerAttribution.create({
        data: {
          referredUserId: `referred-${tag("identity")}`,
          partnerId: partner.id,
          campaignSource: "integration",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      created.attributions.add(attribution.id);
      const identity = { id: partner.id, partnerId: partner.partnerId, code: partner.code, slug: partner.slug };
      await PartnerService.resendPartnerSetupLink({ partnerId: partner.id, adminUserId: "admin-test" });
      const refreshed = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      await PartnerService.activatePartnerWithSetupToken({
        token: refreshed.setupToken!,
        password: "IdentityPreserved9!",
      });
      const stored = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      const storedAttribution = await prisma.partnerAttribution.findUniqueOrThrow({ where: { id: attribution.id } });
      assert(
        JSON.stringify({ id: stored.id, partnerId: stored.partnerId, code: stored.code, slug: stored.slug }) === JSON.stringify(identity) &&
          storedAttribution.partnerId === partner.id,
        "Partner or referral identity changed."
      );
    });

    await runCase(24, "Financial and reconciliation records remain unchanged", async () => {
      const suffix = tag("financialinvariant");
      const result = await PartnerService.createPartner({
        name: `Financial ${suffix}`,
        code: `FIN-${suffix.toUpperCase()}`,
        slug: `financial-${suffix}`,
        contactEmail: `${suffix}@example.test`,
        type: "ORGANIZATION",
        commissionRate: 13,
        fixedCommissionCentavos: 125,
        holdingPeriodDays: 5,
        minPayoutCentavos: 20000,
      });
      created.partners.add(result.id);
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: result.id } });
      const user = await prisma.user.create({
        data: { email: `${tag("financialuser")}@example.test`, password: "FixtureOnly", name: "Fixture User" },
      });
      created.users.add(user.id);
      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          checkoutSessionId: `fixture-${tag("transaction")}`,
          amount: 299,
          grossAmountCentavos: 29900,
          netSettlementCentavos: 28400,
          feeAmountCentavos: 1500,
          planType: "INTEGRATION_TEST",
          status: "COMPLETED",
        },
      });
      created.transactions.add(transaction.id);
      const commission = await prisma.partnerCommission.create({
        data: {
          partnerId: partner.id,
          transactionId: transaction.id,
          purchaseAmountCentavos: 29900,
          commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
          effectiveRate: 13,
          commissionAmountCentavos: 3887,
          status: "AVAILABLE",
          campaignSource: "integration",
        },
      });
      created.commissions.add(commission.id);
      const attribution = await prisma.partnerAttribution.create({
        data: {
          referredUserId: `referred-${tag("financial")}`,
          partnerId: partner.id,
          campaignSource: "integration",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      created.attributions.add(attribution.id);
      const profile = await prisma.partnerPayoutProfile.create({
        data: {
          partnerId: partner.id,
          method: "GCASH",
          accountHolderName: "Integration Fixture",
          accountNumberEncrypted: "fixture-only",
          isDefault: true,
        },
      });
      created.payoutProfiles.add(profile.id);
      const payout = await prisma.partnerPayout.create({
        data: {
          partnerId: partner.id,
          amountCentavos: 2000,
          method: "GCASH",
          accountNumberEncrypted: "fixture-only",
          accountName: "Integration Fixture",
          status: "RESERVED",
        },
      });
      created.payouts.add(payout.id);
      for (const [entryType, category] of [
        ["DEBIT", "EXPENSE_PARTNER"],
        ["CREDIT", "LIABILITY_PARTNER_PAYABLE"],
      ] as const) {
        const ledger = await prisma.financialLedgerEntry.create({
          data: {
            entryNumber: `LED-${tag(entryType)}`,
            transactionId: transaction.id,
            transactionType: "PARTNER_COMMISSION",
            accountCategory: category,
            entryType,
            amountCentavos: 3887,
            sourceEntity: "PartnerCommission",
            sourceId: commission.id,
            description: "Disposable integration fixture",
          },
        });
        created.ledgerEntries.add(ledger.id);
      }
      const reconciliation = await prisma.reconciliationRecord.create({
        data: {
          sourceType: "PARTNER_COMMISSION",
          sourceId: commission.id,
          matchedTransactionId: transaction.id,
          status: "MATCHED",
        },
      });
      created.reconciliations.add(reconciliation.id);

      const snapshot = async () => JSON.stringify({
        partner: await prisma.partner.findUnique({
          where: { id: partner.id },
          select: {
            id: true,
            partnerId: true,
            code: true,
            slug: true,
            commissionModel: true,
            commissionRate: true,
            fixedCommissionCentavos: true,
            holdingPeriodDays: true,
            minPayoutCentavos: true,
          },
        }),
        rateHistory: await prisma.partnerRateHistory.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } }),
        attributions: await prisma.partnerAttribution.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } }),
        commissions: await prisma.partnerCommission.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } }),
        payouts: await prisma.partnerPayout.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } }),
        profiles: await prisma.partnerPayoutProfile.findMany({ where: { partnerId: partner.id }, orderBy: { id: "asc" } }),
        ledger: await prisma.financialLedgerEntry.findMany({ where: { sourceId: commission.id }, orderBy: { id: "asc" } }),
        reconciliation: await prisma.reconciliationRecord.findMany({ where: { sourceId: commission.id }, orderBy: { id: "asc" } }),
      });
      const before = await snapshot();
      await PartnerService.resendPartnerSetupLink({ partnerId: partner.id, adminUserId: "admin-test" });
      const rotated = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
      const activation = await PartnerService.activatePartnerWithSetupToken({
        token: rotated.setupToken!,
        password: "FinancialInvariant9!",
      });
      const after = await snapshot();
      assert(activation.success && before === after, "Financial records changed during authentication.");
    });

    await runCase(25, "No real email, payment, or application network call occurs", async () => {
      assert(httpAttempts === 0, "Unexpected HTTP request occurred.");
      assert(stubDeliveryCalls >= 1, "In-process delivery stub was not exercised.");
      for (const name of FORBIDDEN_ENVIRONMENT_VARIABLES) {
        assert(!process.env[name], `Forbidden provider environment variable is present: ${name}.`);
      }
    });
  } finally {
    await cleanup().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  console.log(`[SUMMARY] Partner Auth integration: ${passed} passed, ${failed} failed.`);
  if (failed > 0) throw new IntegrationAssertionError("One or more integration cases failed.");
}

main().catch(() => {
  console.error("[SUMMARY] Partner Auth integration stopped safely without exposing internal details.");
  process.exitCode = 1;
});
