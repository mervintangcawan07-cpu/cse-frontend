/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- This standalone security harness evaluates selected production helpers in isolation.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const localRequire = createRequire(import.meta.url);

let passed = 0;
let failed = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`PASS: ${description}`);
    passed++;
  } else {
    console.error(`FAIL: ${description}`);
    failed++;
  }
}

function loadProductionPolicyFunctions(serviceSource) {
  const sourceFile = ts.createSourceFile(
    "partnerService.ts",
    serviceSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const functionNames = new Set([
    "isPartnerSetupStatusEligible",
    "hasEstablishedPartnerCredential",
    "isUsablePartnerContactEmail",
    "canResendPartnerSetupLink",
    "canUsePartnerPasswordRecovery",
    "createPartnerSetupCredential",
    "buildPartnerSetupDeliveryResult",
    "sanitizePartnerOnboardingPartner",
    "executePartnerSetupResend",
  ]);
  const selected = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "ELIGIBLE_PARTNER_SETUP_STATUSES"
      )
    ) {
      selected.push(statement.getText(sourceFile));
    } else if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text === "PartnerOnboardingError"
    ) {
      selected.push(statement.getText(sourceFile));
    } else if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      functionNames.has(statement.name.text)
    ) {
      selected.push(statement.getText(sourceFile));
    }
  }

  const transpiled = ts.transpileModule(selected.join("\n\n"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleExports = {};
  const evaluate = new Function(
    "exports",
    "require",
    "Buffer",
    `const crypto = require("node:crypto");\n${transpiled}\nreturn exports;`
  );
  return evaluate(moduleExports, localRequire, Buffer);
}

function containsSensitiveResultData(value) {
  const serialized = JSON.stringify(value).toLowerCase();
  return (
    serialized.includes("setuptoken") ||
    serialized.includes("passwordhash") ||
    serialized.includes("temppasswordhash") ||
    serialized.includes("initialpassword") ||
    serialized.includes("/partner-portal/setup?token=")
  );
}

async function expectErrorCode(operation, expectedCode, description) {
  try {
    await operation();
    assert(false, description);
  } catch (error) {
    assert(error?.code === expectedCode, description);
  }
}

async function run() {
  const repoRoot = process.cwd();
  const read = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  const serviceSource = read("src/lib/accounting/partnerService.ts");
  const policy = loadProductionPolicyFunctions(serviceSource);

  const basePartner = {
    id: "partner-1",
    partnerId: "PT-000001",
    code: "PT-000001",
    name: "Test Partner",
    status: "ACTIVE",
    contactEmail: "partner@example.test",
    passwordHash: null,
    tempPasswordHash: null,
    setupToken: "old-token",
  };

  assert(
    !policy.canResendPartnerSetupLink({ ...basePartner, passwordHash: "primary-hash" }),
    "primary password accounts cannot receive setup resend"
  );
  assert(
    !policy.canResendPartnerSetupLink({ ...basePartner, tempPasswordHash: "legacy-hash" }),
    "legacy temporary-password accounts cannot receive setup resend"
  );
  assert(
    policy.canUsePartnerPasswordRecovery({
      ...basePartner,
      tempPasswordHash: "legacy-hash",
    }),
    "legacy temporary-password accounts remain eligible for Forgot Password"
  );
  assert(
    policy.canResendPartnerSetupLink(basePartner),
    "credential-free setup-only accounts can receive setup resend"
  );
  assert(
    !policy.canResendPartnerSetupLink({ ...basePartner, contactEmail: "not-an-email" }),
    "setup resend requires a usable contact email"
  );

  for (const status of ["SUSPENDED", "EXPIRED", "TERMINATED", "ARCHIVED"]) {
    assert(
      !policy.canResendPartnerSetupLink({ ...basePartner, status }),
      `${status} accounts cannot receive setup resend`
    );
  }

  let storedToken = basePartner.setupToken;
  let deliveredToken = null;
  const credential = {
    token: "11".repeat(32),
    expiresAt: new Date("2030-01-08T00:00:00.000Z"),
  };
  const resendResult = await policy.executePartnerSetupResend(basePartner.id, {
    findPartner: async () => ({ ...basePartner, setupToken: storedToken }),
    rotateSetupToken: async ({ expectedSetupToken, nextSetupToken }) => {
      if (storedToken !== expectedSetupToken) return false;
      storedToken = nextSetupToken;
      return true;
    },
    deliverSetupEmail: async ({ setupToken }) => {
      deliveredToken = setupToken;
      return "SENT";
    },
    createCredential: () => credential,
  });
  assert(storedToken === credential.token, "resend replaces and invalidates the previous setup token");
  assert(deliveredToken === credential.token, "email delivery occurs with the newly committed token");
  assert(!containsSensitiveResultData(resendResult), "resend result exposes no authentication secret");

  let conflictDeliveryCalls = 0;
  await expectErrorCode(
    () =>
      policy.executePartnerSetupResend(basePartner.id, {
        findPartner: async () => basePartner,
        rotateSetupToken: async () => false,
        deliverSetupEmail: async () => {
          conflictDeliveryCalls++;
          return "SENT";
        },
        createCredential: () => credential,
      }),
    "CONFLICT",
    "conditional rotation reports a safe conflict"
  );
  assert(conflictDeliveryCalls === 0, "a failed conditional rotation sends no email");

  const thrownDeliveryResult = await policy.executePartnerSetupResend(basePartner.id, {
    findPartner: async () => basePartner,
    rotateSetupToken: async () => true,
    deliverSetupEmail: async () => {
      throw new Error("simulated delivery failure");
    },
    createCredential: () => credential,
  });
  assert(
    thrownDeliveryResult.deliveryStatus === "FAILED",
    "post-commit email exception remains a safe delivery warning"
  );
  assert(
    !containsSensitiveResultData(thrownDeliveryResult),
    "post-commit delivery failure exposes no authentication secret"
  );

  await expectErrorCode(
    () =>
      policy.executePartnerSetupResend(basePartner.id, {
        findPartner: async () => ({ ...basePartner, tempPasswordHash: "legacy-hash" }),
        rotateSetupToken: async () => true,
        deliverSetupEmail: async () => "SENT",
      }),
    "ALREADY_CREDENTIALED",
    "legacy temporary credentials are preserved and routed to Forgot Password"
  );

  const warning = policy.buildPartnerSetupDeliveryResult("CREATED", "Test Partner", "FAILED");
  assert(warning.success === true && warning.deliveryStatus === "FAILED", "committed creation reports delivery failure as success with warning");
  assert(!containsSensitiveResultData(warning), "delivery warning exposes no authentication secret");

  const safeServicePartner = policy.sanitizePartnerOnboardingPartner({
    ...basePartner,
    slug: "test-partner",
    type: "SCHOOL",
    setupTokenExpires: new Date("2030-01-08T00:00:00.000Z"),
    resetToken: "reset-secret",
    resetTokenExpires: new Date("2030-01-02T00:00:00.000Z"),
    mustChangePassword: true,
  });
  assert(
    !containsSensitiveResultData(safeServicePartner),
    "public service partner shape exposes no authentication secret fields"
  );
  assert(
    Object.keys(safeServicePartner).sort().join(",") ===
      "code,contactEmail,id,name,partnerId,slug,status,type",
    "public service partner shape contains only the explicit onboarding allowlist"
  );
  assert(
    serviceSource.includes("...sanitizePartnerOnboardingPartner(partner)") &&
      serviceSource.includes("partner: sanitizePartnerOnboardingPartner(result.partner)"),
    "creation and approval return the sanitized service partner shape"
  );

  const credentialSample = policy.createPartnerSetupCredential(
    new Date("2030-01-01T00:00:00.000Z"),
    () => Buffer.alloc(32, 0xab)
  );
  assert(credentialSample.token.length === 64, "setup token contains 32 random bytes encoded as hex");
  assert(
    credentialSample.expiresAt.toISOString() === "2030-01-08T00:00:00.000Z",
    "setup token expiration is refreshed for seven days"
  );

  const adminPage = read("src/app/admin/accounting/page.tsx");
  const partnersRoute = read("src/app/api/admin/accounting/partners/route.ts");
  const approvalRoute = read("src/app/api/admin/accounting/applications/[id]/route.ts");
  const resendRoute = read("src/app/api/admin/accounting/partners/[id]/resend-setup/route.ts");
  const forgotRoute = read("src/app/api/partner/auth/forgot-password/route.ts");
  const resetRoute = read("src/app/api/partner/auth/reset-password/route.ts");
  const emailSource = read("src/lib/email.ts");

  assert(!adminPage.includes("Initial Portal Password"), "admin onboarding UI has no initial-password field");
  assert(!adminPage.includes("initialPassword"), "admin approval payload sends no initial password");
  assert(!adminPage.includes('name="password"'), "manual registration sends no password field");
  assert(partnersRoute.includes('hasOwnProperty.call(body, "password")'), "manual creation rejects the legacy password property");
  assert(approvalRoute.includes('hasOwnProperty.call(body, "initialPassword")'), "approval rejects the legacy initialPassword property");
  assert(!approvalRoute.includes("effectivePassword"), "approval generates no plaintext initial password");
  assert(!emailSource.includes("sendPartnerApplicationApprovedEmail"), "plaintext approval email helper is removed");
  assert(!emailSource.includes("Initial Password"), "partner email templates contain no initial password");
  assert(!emailSource.includes("console.log(setupUrl)"), "setup bearer URL is never logged");
  assert(!emailSource.includes("console.log(resetUrl)"), "partner reset bearer URL is never logged");

  assert(
    serviceSource.includes('status: { in: [...ELIGIBLE_PARTNER_SETUP_STATUSES] }') &&
      serviceSource.includes("const consumed = await prisma.partner.updateMany"),
    "setup consumption condition rechecks eligible current status atomically"
  );
  assert(
    forgotRoute.includes("canUsePartnerPasswordRecovery") &&
      forgotRoute.includes("tempPasswordHash: { not: null }") &&
      forgotRoute.includes("updateMany"),
    "Forgot Password requires an established credential and current ACTIVE status"
  );
  assert(
    resetRoute.includes("canUsePartnerPasswordRecovery") &&
      resetRoute.includes('status: "ACTIVE"') &&
      resetRoute.includes("updateMany"),
    "Reset Password rechecks credential establishment and current ACTIVE status"
  );
  assert(
    serviceSource.includes('status: "PENDING"') &&
      serviceSource.includes("createdPartnerId: null") &&
      serviceSource.includes("claimed.count !== 1"),
    "application approval condition prevents duplicate partner creation"
  );
  assert(
    serviceSource.includes("await this.recordPostCommitAudit({") &&
      serviceSource.includes("deliveryStatus: result.deliveryStatus"),
    "post-commit setup audits are contained and resend records either delivery outcome"
  );
  assert(
    partnersRoute.includes('{ error: "Failed to create partner." }') &&
      approvalRoute.includes('{ error: "Failed to process partner application." }'),
    "unexpected onboarding API failures use generic client-safe messages"
  );

  for (const [name, source] of [
    ["manual creation response", partnersRoute],
    ["approval response", approvalRoute],
    ["resend response", resendRoute],
  ]) {
    assert(!source.includes("passwordHash:"), `${name} does not expose password hashes`);
    assert(!source.includes("setupToken:"), `${name} does not expose setup tokens`);
    assert(!source.includes("/partner-portal/setup?token="), `${name} does not expose setup URLs`);
  }

  assert(
    !read("src/scripts/test-partner-onboarding-auth.ts").includes("@/lib/" + "prisma") &&
      !read("src/scripts/test-partner-onboarding-auth.ts").includes(
        "sendPartner" + "SetupEmail("
      ),
    "focused regression cannot call Prisma or send real email"
  );

  console.log(`Partner onboarding regression: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error("Partner onboarding regression failed.", error);
  process.exit(1);
});
