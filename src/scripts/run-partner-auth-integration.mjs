import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIRMATION = "YES_DELETE_AFTER_TEST";
const RUN_ID_PATTERN = /^[a-z0-9]{8,32}$/;
const DATABASE_PREFIX = "gsx_partner_auth_test_";
const ALLOWED_DATABASE_URL_PARAMETERS = new Map([
  ["channel_binding", new Set(["require"])],
  ["sslmode", new Set(["require", "verify-full"])],
  ["sslnegotiation", new Set(["postgres", "direct"])],
]);
const SAFE_INTEGRATION_CASE_NAMES = [
  "Manual registration creates exactly one setup-token partner",
  "New account has no primary or temporary password hash",
  "Public service result contains no credential fields",
  "Application approval creates one linked partner",
  "Repeated approval creates no duplicate",
  "Concurrent approval produces exactly one partner",
  "Resend changes the existing partner only",
  "Old setup token becomes invalid",
  "New setup token receives a fresh seven-day expiry",
  "Credential-bearing partners reject setup resend",
  "Ineligible partners reject setup resend",
  "Concurrent resend permits exactly one token rotation",
  "Activation-versus-resend cannot overwrite an established credential",
  "Valid setup succeeds exactly once",
  "Setup-token replay fails",
  "Concurrent setup submissions produce exactly one activation",
  "Suspension after token issuance prevents activation",
  "Forgot Password cannot initialize a setup-only account",
  "Reset Password cannot initialize a setup-only account",
  "Reset token cannot be consumed after account becomes ineligible",
  "Existing primary-hash partner remains compatible",
  "Legacy temporary-hash recovery promotes safely",
  "Partner and referral identity remain unchanged",
  "Financial and reconciliation records remain unchanged",
  "No real email, payment, or application network call occurs",
];
const INTEGRATION_BOOTSTRAP_START_MARKER =
  "[INFO] Integration TypeScript bootstrap started.";
const INTEGRATION_MODULE_LOADED_MARKER = "[INFO] Integration test module loaded.";
const INTEGRATION_BOOTSTRAP_FAILURE_MARKER =
  "[FAIL] Integration TypeScript bootstrap failed safely.";
const INTEGRATION_STOPPED_SUMMARY =
  "[SUMMARY] Partner Auth integration stopped safely without exposing internal details.";
const INTEGRATION_SUCCESS_SUMMARY =
  "[SUMMARY] Partner Auth integration: 25 passed, 0 failed.";
const REQUIRED_INTEGRATION_PROGRESS_MARKERS = [
  "[INFO] Integration environment contract validated.",
  "[INFO] Integration Prisma module imported.",
  "[INFO] Integration bcrypt module imported.",
  "[INFO] Integration PartnerService module imported.",
  "[INFO] Integration forgot-password route imported.",
  "[INFO] Integration reset-password route imported.",
  "[INFO] Integration dependencies imported.",
  "[INFO] Integration exports validated.",
  "[INFO] Integration database identity verified.",
  "[INFO] Integration cases starting.",
];
const SAFE_FIXED_INTEGRATION_MARKERS = new Set([
  INTEGRATION_BOOTSTRAP_START_MARKER,
  INTEGRATION_MODULE_LOADED_MARKER,
  ...REQUIRED_INTEGRATION_PROGRESS_MARKERS,
  INTEGRATION_BOOTSTRAP_FAILURE_MARKER,
  INTEGRATION_STOPPED_SUMMARY,
]);
const SAFE_PARENT_ENV_NAMES = new Set([
  "APPDATA",
  "COMSPEC",
  "HOME",
  "LOCALAPPDATA",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "PATH",
  "PATHEXT",
  "PROCESSOR_ARCHITECTURE",
  "PROCESSOR_IDENTIFIER",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
]);
const FORBIDDEN_CHILD_VARIABLES = [
  "ADMIN_ALERT_EMAIL",
  "CRON_SECRET",
  "CRON_SECRET_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
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
];

class SafeHarnessError extends Error {}

function fail(message) {
  throw new SafeHarnessError(message);
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readAndValidateContract() {
  const testUrl = process.env.PARTNER_AUTH_TEST_DATABASE_URL;
  const confirmation = process.env.PARTNER_AUTH_TEST_CONFIRM_DISPOSABLE;
  const runId = process.env.PARTNER_AUTH_TEST_RUN_ID;

  if (!testUrl) fail("PARTNER_AUTH_TEST_DATABASE_URL is required.");
  if (confirmation !== CONFIRMATION) {
    fail(`PARTNER_AUTH_TEST_CONFIRM_DISPOSABLE must equal ${CONFIRMATION}.`);
  }
  if (!runId || !RUN_ID_PATTERN.test(runId)) {
    fail("PARTNER_AUTH_TEST_RUN_ID must contain 8-32 lowercase letters or digits.");
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL) {
    fail("Vercel-marked environments are not permitted.");
  }

  let parsed;
  try {
    parsed = new URL(testUrl);
  } catch {
    fail("The dedicated test database URL is invalid.");
  }
  if (!parsed || !["postgres:", "postgresql:"].includes(parsed.protocol)) {
    fail("The dedicated test database must use PostgreSQL.");
  }
  if (!parsed.hostname || !parsed.username || !parsed.password) {
    fail("The dedicated test database URL must contain its host and credentials.");
  }

  const expectedDatabase = `${DATABASE_PREFIX}${runId}`;
  if (parsed.pathname !== `/${expectedDatabase}`) {
    fail("The target database name does not match the required disposable-test identity.");
  }
  if (parsed.hash) {
    fail("The dedicated test database URL must not contain a fragment.");
  }

  const seenParameters = new Set();
  for (const [name, value] of parsed.searchParams) {
    const allowedValues = ALLOWED_DATABASE_URL_PARAMETERS.get(name);
    if (!allowedValues || seenParameters.has(name) || !allowedValues.has(value)) {
      fail("The dedicated test database URL contains an unsupported query parameter.");
    }
    seenParameters.add(name);
  }

  return {
    expectedDatabase,
    runId,
    targetFingerprint: fingerprint(testUrl),
    testUrl,
  };
}

function assertTargetUnchanged(contract) {
  const current = process.env.PARTNER_AUTH_TEST_DATABASE_URL;
  if (!current || fingerprint(current) !== contract.targetFingerprint) {
    fail("The disposable database target changed during the workflow.");
  }
  const parsed = new URL(current);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (databaseName !== contract.expectedDatabase) {
    fail("The disposable database identity changed during the workflow.");
  }
}

function buildIsolatedEnvironment(contract, emptyDotenvPath) {
  const childEnvironment = {};
  for (const name of SAFE_PARENT_ENV_NAMES) {
    const value = process.env[name];
    if (value !== undefined) {
      childEnvironment[name] = value;
    }
  }

  Object.assign(childEnvironment, {
    DATABASE_URL: contract.testUrl,
    DOTENV_CONFIG_PATH: emptyDotenvPath,
    NODE_ENV: "test",
    PARTNER_AUTH_TEST_CONFIRM_DISPOSABLE: CONFIRMATION,
    PARTNER_AUTH_TEST_DATABASE_URL: contract.testUrl,
    PARTNER_AUTH_TEST_EXPECTED_DATABASE: contract.expectedDatabase,
    PARTNER_AUTH_TEST_NETWORK_GUARD: "ENABLED",
    PARTNER_AUTH_TEST_RUN_ID: contract.runId,
    PARTNER_AUTH_TEST_TARGET_FINGERPRINT: contract.targetFingerprint,
    PG_POOL_MAX: "8",
    SITE_URL: "http://localhost:3000",
  });

  for (const name of FORBIDDEN_CHILD_VARIABLES) {
    delete childEnvironment[name];
  }
  return childEnvironment;
}

function runIsolatedPreflight(environment) {
  const bootstrap = `
    const crypto = require("node:crypto");

    console.log = () => undefined;
    console.warn = () => undefined;
    console.error = () => undefined;

    const stop = () => {
      throw new Error("Preflight stopped safely.");
    };
    const digest = (value) =>
      crypto.createHash("sha256").update(value).digest("hex");

    (async () => {
      const testUrl = process.env.PARTNER_AUTH_TEST_DATABASE_URL;
      const expectedDatabase = process.env.PARTNER_AUTH_TEST_EXPECTED_DATABASE;
      const expectedFingerprint = process.env.PARTNER_AUTH_TEST_TARGET_FINGERPRINT;
      if (
        !testUrl ||
        !expectedDatabase ||
        process.env.DATABASE_URL !== testUrl ||
        digest(testUrl) !== expectedFingerprint
      ) {
        stop();
      }
      if (
        Object.keys(process.env).some(
          (name) => name.startsWith("PG") && name !== "PG_POOL_MAX"
        )
      ) {
        stop();
      }

      const parsed = new URL(testUrl);
      if (
        !["postgres:", "postgresql:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        !parsed.username ||
        !parsed.password ||
        parsed.pathname !== "/" + expectedDatabase
      ) {
        stop();
      }

      const { Client } = await import("pg");
      const client = new Client({ connectionString: testUrl });
      try {
        await client.connect();
        const identity = await client.query(
          "SELECT current_database() AS database_name"
        );
        if (identity.rows[0]?.database_name !== expectedDatabase) stop();

        const tableCheck = await client.query(
          "SELECT COUNT(*)::integer AS table_count " +
            "FROM information_schema.tables " +
            "WHERE table_type = 'BASE TABLE' " +
            "AND table_schema NOT IN ('pg_catalog', 'information_schema')"
        );
        if (Number(tableCheck.rows[0]?.table_count) !== 0) stop();

        const objectCheck = await client.query(
          "SELECT COUNT(*)::integer AS object_count " +
            "FROM pg_catalog.pg_class AS object " +
            "JOIN pg_catalog.pg_namespace AS namespace " +
            "ON namespace.oid = object.relnamespace " +
            "WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema') " +
            "AND namespace.nspname NOT LIKE 'pg_toast%' " +
            "AND namespace.nspname NOT LIKE 'pg_temp_%'"
        );
        if (Number(objectCheck.rows[0]?.object_count) !== 0) stop();

        const schemaCheck = await client.query(
          "SELECT COUNT(*)::integer AS schema_count " +
            "FROM information_schema.schemata " +
            "WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public') " +
            "AND schema_name NOT LIKE 'pg_toast%' " +
            "AND schema_name NOT LIKE 'pg_temp_%'"
        );
        if (Number(schemaCheck.rows[0]?.schema_count) !== 0) stop();
      } finally {
        await client.end().catch(() => undefined);
      }

      process.stdout.write("[PASS] Disposable database preflight passed.\\n");
    })().catch(() => {
      process.stderr.write("[FAIL] Disposable database preflight failed safely.\\n");
      process.exitCode = 1;
    });
  `;

  try {
    new Function(bootstrap);
  } catch {
    fail("Disposable database preflight could not be prepared safely.");
  }

  const result = spawnSync(process.execPath, ["--eval", bootstrap], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment,
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  const passed = result.stdout
    ?.split(/\r?\n/)
    .some((line) => line === "[PASS] Disposable database preflight passed.");
  if (result.status !== 0 || !passed) {
    fail("Disposable database preflight failed safely.");
  }
}

function runLocalNode(scriptPath, args, environment, label, showHarnessOutput = false) {
  if (!existsSync(scriptPath)) {
    fail(`${label} local executable is unavailable.`);
  }

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: environment,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (showHarnessOutput && result.stdout) {
    for (const line of result.stdout.split(/\r?\n/)) {
      if (/^\[(?:PASS|FAIL|INFO|SUMMARY)\]/.test(line)) console.log(line);
    }
  }
  if (result.status !== 0) fail(`${label} failed safely.`);
}

function isSafeIntegrationMarker(line) {
  if (SAFE_FIXED_INTEGRATION_MARKERS.has(line)) return true;

  const caseMarker = line.match(/^\[(?:PASS|FAIL)\] (\d+)\. (.+)$/);
  if (caseMarker) {
    const caseNumber = Number(caseMarker[1]);
    return SAFE_INTEGRATION_CASE_NAMES[caseNumber - 1] === caseMarker[2];
  }

  const summaryMarker = line.match(
    /^\[SUMMARY\] Partner Auth integration: (\d+) passed, (\d+) failed\.$/
  );
  if (!summaryMarker) return false;
  const passed = Number(summaryMarker[1]);
  const failed = Number(summaryMarker[2]);
  return passed >= 0 && failed >= 0 && passed + failed === SAFE_INTEGRATION_CASE_NAMES.length;
}

function getCapturedIntegrationLines(stdout, stderr) {
  return [stdout, stderr]
    .filter((output) => typeof output === "string")
    .flatMap((output) => output.split(/\r?\n/))
    .filter((line) => line.length > 0);
}

function isSuccessfulIntegrationResult(status, stdout, stderr) {
  if (status !== 0) return false;

  const lines = getCapturedIntegrationLines(stdout, stderr);
  const countExact = (marker) => lines.filter((line) => line === marker).length;
  if (countExact(INTEGRATION_BOOTSTRAP_FAILURE_MARKER) !== 0) return false;
  if (countExact(INTEGRATION_STOPPED_SUMMARY) !== 0) return false;
  if (
    REQUIRED_INTEGRATION_PROGRESS_MARKERS.some(
      (marker) => countExact(marker) !== 1
    )
  ) {
    return false;
  }

  const resultSummaries = lines.filter((line) =>
    line.startsWith("[SUMMARY] Partner Auth integration:")
  );
  if (
    resultSummaries.length !== 1 ||
    resultSummaries[0] !== INTEGRATION_SUCCESS_SUMMARY
  ) {
    return false;
  }

  const successSummaryIndex = lines.indexOf(INTEGRATION_SUCCESS_SUMMARY);
  let previousProgressIndex = -1;
  for (const marker of REQUIRED_INTEGRATION_PROGRESS_MARKERS) {
    const markerIndex = lines.indexOf(marker);
    if (markerIndex <= previousProgressIndex || markerIndex >= successSummaryIndex) {
      return false;
    }
    previousProgressIndex = markerIndex;
  }

  const caseLines = lines.filter((line) => /^\[(?:PASS|FAIL)\] \d+\. /.test(line));
  if (caseLines.length !== SAFE_INTEGRATION_CASE_NAMES.length) return false;

  const seenCaseNumbers = new Set();
  for (const line of caseLines) {
    const match = line.match(/^\[(PASS|FAIL)\] (\d+)\. (.+)$/);
    if (!match || match[1] !== "PASS") return false;
    const caseNumber = Number(match[2]);
    if (
      caseNumber < 1 ||
      caseNumber > SAFE_INTEGRATION_CASE_NAMES.length ||
      seenCaseNumbers.has(caseNumber) ||
      SAFE_INTEGRATION_CASE_NAMES[caseNumber - 1] !== match[3]
    ) {
      return false;
    }
    seenCaseNumbers.add(caseNumber);
  }

  return (
    seenCaseNumbers.size === SAFE_INTEGRATION_CASE_NAMES.length &&
    caseLines.every((line) => {
      const lineIndex = lines.indexOf(line);
      return lineIndex > previousProgressIndex && lineIndex < successSummaryIndex;
    })
  );
}

function runLocalTypeScript(tsxCli, testPath, tsconfigPath, environment) {
  if (
    !path.isAbsolute(tsxCli) ||
    !existsSync(tsxCli) ||
    !path.isAbsolute(testPath) ||
    !existsSync(testPath)
  ) {
    fail("Partner Auth integration local executable is unavailable.");
  }
  if (!path.isAbsolute(tsconfigPath) || !existsSync(tsconfigPath)) {
    fail("Integration TypeScript bootstrap failed safely.");
  }

  const result = spawnSync(
    process.execPath,
    [tsxCli, "--tsconfig", tsconfigPath, testPath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
      windowsHide: true,
    }
  );

  const succeeded = isSuccessfulIntegrationResult(
    result.status,
    result.stdout,
    result.stderr
  );
  const forwardedMarkers = new Set();
  if (result.status !== null) {
    for (const line of getCapturedIntegrationLines(result.stdout, result.stderr)) {
      if (isSafeIntegrationMarker(line) && !forwardedMarkers.has(line)) {
        console.log(line);
        forwardedMarkers.add(line);
      }
    }
  }
  if (!succeeded) fail("Partner Auth integration suite failed safely.");
}

async function main() {
  const contract = readAndValidateContract();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (process.cwd() !== root) {
    fail("Run the integration launcher from the repository root.");
  }
  const tsconfigPath = path.resolve(root, "tsconfig.json");
  if (!path.isAbsolute(tsconfigPath) || !existsSync(tsconfigPath)) {
    fail("Integration TypeScript bootstrap failed safely.");
  }
  const tsxCli = path.resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
  const testPath = path.resolve(
    root,
    "src",
    "scripts",
    "test-partner-auth-integration.ts"
  );
  if (
    !path.isAbsolute(tsxCli) ||
    !existsSync(tsxCli) ||
    !path.isAbsolute(testPath) ||
    !existsSync(testPath)
  ) {
    fail("Partner Auth integration local executable is unavailable.");
  }

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "gsx-partner-auth-integration-")
  );
  const emptyDotenvPath = path.join(temporaryDirectory, "empty.env");
  await writeFile(emptyDotenvPath, "", { encoding: "utf8", flag: "wx" });

  try {
    const environment = buildIsolatedEnvironment(contract, emptyDotenvPath);
    assertTargetUnchanged(contract);
    runIsolatedPreflight(environment);
    assertTargetUnchanged(contract);
    console.log("[INFO] Disposable database preflight passed.");
    if (process.argv.includes("--preflight-only")) return;

    const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
    const configPath = path.join(root, "prisma.integration.config.ts");

    assertTargetUnchanged(contract);
    runLocalNode(
      prismaCli,
      ["generate", "--config", configPath],
      environment,
      "Prisma client generation"
    );
    console.log("[INFO] Prisma client generation completed.");

    assertTargetUnchanged(contract);
    runLocalNode(
      prismaCli,
      ["migrate", "deploy", "--config", configPath],
      environment,
      "Disposable database migration"
    );
    console.log("[INFO] Existing migrations were applied to the disposable database.");

    assertTargetUnchanged(contract);
    runLocalNode(
      prismaCli,
      ["migrate", "status", "--config", configPath],
      environment,
      "Disposable database migration status"
    );
    console.log("[INFO] Disposable database migration status passed.");

    assertTargetUnchanged(contract);
    runLocalTypeScript(tsxCli, testPath, tsconfigPath, environment);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  if (error instanceof SafeHarnessError) {
    console.error(`[FAIL] ${error.message}`);
  } else {
    console.error("[FAIL] Integration launcher stopped without exposing internal details.");
  }
  process.exitCode = 1;
});
